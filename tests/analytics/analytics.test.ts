import { test } from "node:test";
import assert from "node:assert/strict";
import { timingSafeEqual } from "node:crypto";
import { fixture } from "./fixture";
import {
  productSummary,
  summaryResponse,
} from "../../worker/analytics/summary";
import { deliverEvents } from "../../worker/analytics/delivery";
import { anonymousId } from "../../worker/analytics/config";
import { trackResponse } from "../../worker/analytics/track";
Object.defineProperty(crypto.subtle, "timingSafeEqual", {
  value: timingSafeEqual,
  configurable: true,
});
test("统计总量、数据库成功事件、重复加入和文件上传不会重复记录", async () => {
  const f = await fixture();
  try {
    await f.member("a", true);
    await f.member("b");
    await f.trip("trip", "a");
    await f.DB.prepare(
      "INSERT OR IGNORE INTO trip_members VALUES ('trip','b',CURRENT_TIMESTAMP)",
    ).run();
    await f.DB.prepare(
      "INSERT OR IGNORE INTO trip_members VALUES ('trip','b',CURRENT_TIMESTAMP)",
    ).run();
    await f.DB.prepare(
      "INSERT INTO events(id,trip_id,data,created_by) VALUES ('event','trip',?, 'b')",
    )
      .bind(JSON.stringify({ kind: "explore", title: "Private place" }))
      .run();
    await f.DB.prepare(
      "INSERT OR IGNORE INTO documents(id,trip_id,name,category,r2_key,mime,size,uploaded_by) VALUES ('doc','trip','Private File','Private Category','key','image/png',1,'b')",
    ).run();
    await f.DB.prepare(
      "INSERT OR IGNORE INTO documents(id,trip_id,name,category,r2_key,mime,size,uploaded_by) VALUES ('doc','trip','Private File','Private Category','key','image/png',1,'b')",
    ).run();
    const snapshot = await productSummary(f.env);
    assert.equal(snapshot.metrics.users, 2);
    assert.equal(snapshot.metrics.verified_users, 1);
    assert.equal(snapshot.metrics.trip_creators, 1);
    assert.equal(snapshot.metrics.events, 1);
    assert.equal(snapshot.metrics.activities, 1);
    assert.equal(snapshot.metrics.multiplayer_trips, 1);
    assert.equal(snapshot.metrics.documents, 1);
    const events = (await f.DB.prepare("SELECT * FROM analytics_events").all())
      .results;
    for (const name of [
      "trip_joined",
      "trip_became_multiplayer",
      "document_uploaded",
    ])
      assert.equal(events.filter((e) => e.name === name).length, 1);
    assert.ok(!JSON.stringify(events).includes("Private"));
    await f.DB.prepare("UPDATE members SET email_verified_at=? WHERE id='b'")
      .bind(Date.now())
      .run();
    await f.DB.prepare("UPDATE members SET email_verified_at=? WHERE id='b'")
      .bind(Date.now())
      .run();
    assert.equal(
      (await f.DB.prepare(
        "SELECT count(*) n FROM analytics_events WHERE name='email_verified'",
      ).first())!.n,
      2,
    );
    await assert.rejects(
      summaryResponse(
        new Request("https://example.test/api/analytics/summary"),
        f.env,
      ),
    );
  } finally {
    await f.close();
  }
});
test("Umami 失败持久重试、并发租约、本地停用与匿名数据白名单", async () => {
  const f = await fixture();
  const original = globalThis.fetch;
  try {
    await f.member("private-user");
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return new Response("failed", { status: 503 });
    };
    assert.deepEqual(await deliverEvents({ ...f.env, APP_ENV: "local" }), {
      sent: 0,
      failed: 0,
    });
    assert.equal(calls, 0);
    await deliverEvents(f.env);
    assert.equal(
      (await f.DB.prepare("SELECT attempts FROM analytics_events").first())!
        .attempts,
      1,
    );
    await deliverEvents(f.env);
    assert.equal(calls, 1);
    await f.DB.prepare("UPDATE analytics_events SET next_attempt_at=0").run();
    const bodies: string[] = [];
    globalThis.fetch = async (_url, init) => {
      bodies.push(String(init?.body));
      return Response.json({ sessionId: crypto.randomUUID() });
    };
    await Promise.all([deliverEvents(f.env), deliverEvents(f.env)]);
    assert.equal(bodies.length, 1);
    assert.ok(!bodies[0].includes("private-user"));
    assert.ok(!bodies[0].includes("@"));
    assert.equal(
      (await f.DB.prepare(
        "SELECT count(*) n FROM analytics_events WHERE delivered_at IS NULL",
      ).first())!.n,
      0,
    );
    assert.equal(await anonymousId("key", "a"), await anonymousId("key", "a"));
    assert.notEqual(
      await anonymousId("key", "a"),
      await anonymousId("key", "b"),
    );
  } finally {
    globalThis.fetch = original;
    await f.close();
  }
});
test("浏览事件拒绝自由文本，重复 ID 去重，匿名访问不计活跃账号", async () => {
  const f = await fixture();
  try {
    const event = {
      id: crypto.randomUUID(),
      anonymousId: crypto.randomUUID(),
      name: "page_viewed",
      page: "login",
    };
    const request = (data: unknown) =>
      new Request("https://example.test/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    await trackResponse(request(event), f.env);
    await trackResponse(request(event), f.env);
    await assert.rejects(
      trackResponse(
        request({ ...event, email: "private@example.test" }),
        f.env,
      ),
    );
    assert.equal((await productSummary(f.env)).metrics.active_1d, 0);
    assert.equal(
      (await f.DB.prepare("SELECT count(*) n FROM analytics_events").first())!
        .n,
      1,
    );
  } finally {
    await f.close();
  }
});

test("历史账号进入总量但不伪造新增事件；看板快照只更新指定区域", async () => {
  const f = await fixture(async (db) => {
    await db
      .prepare(
        "INSERT INTO members(id,email,name,password_hash,salt,email_verified_at) VALUES ('old','old@example.test','Old','hash','salt',1)",
      )
      .run();
  });
  const original = globalThis.fetch;
  try {
    assert.equal((await productSummary(f.env)).metrics.users, 1);
    assert.equal(
      (await f.DB.prepare("SELECT count(*) n FROM analytics_events").first())!
        .n,
      0,
    );
    const { updateBoard } = await import("../../worker/analytics/board");
    const env = {
      ...f.env,
      UMAMI_API_ORIGIN: "https://analytics.example.test/api",
      UMAMI_API_TOKEN: "secret-test-token",
      UMAMI_BOARD_ID: "board",
    };
    let updated: any;
    globalThis.fetch = async (_url, init) => {
      if (init?.method === "POST") {
        updated = JSON.parse(String(init.body));
        return Response.json({ id: "board" });
      }
      return Response.json({
        parameters: {
          websiteId: env.UMAMI_WEBSITE_ID,
          rows: [
            {
              columns: [
                {
                  id: "trip-product-totals",
                  component: { type: "TextBlock", props: { text: "old" } },
                },
              ],
            },
            {
              columns: [
                {
                  id: "user-custom",
                  component: { type: "TextBlock", props: { text: "keep me" } },
                },
              ],
            },
          ],
        },
      });
    };
    await updateBoard(env);
    assert.match(
      updated.parameters.rows[0].columns[0].component.props.text,
      /用户数 1/,
    );
    assert.equal(
      updated.parameters.rows[1].columns[0].component.props.text,
      "keep me",
    );
  } finally {
    globalThis.fetch = original;
    await f.close();
  }
});
