import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { Client, createTrip } from "./support/api";
import { invite, join } from "../worker/trips/invitations";
import { sha } from "../worker/accounts/password";
import type { Trip } from "../worker/trips/access";
test("六位邀请口令唯一、可重新读取、大小写加入、轮换撤销及权限", async () => {
  const owner = await new Client().register(),
    guest = await new Client().register();
  const codes = new Set<string>();
  for (let i = 0; i < 6; i++) {
    const id = await createTrip(owner),
      path = `/trips/${id}/invites`;
    const result = await owner.request(path, "POST", {});
    assert.match(result.token, /^[A-HJ-NP-Z]{6}$/);
    assert.equal(codes.has(result.token), false);
    codes.add(result.token);
    assert.equal((await owner.request(path)).token, result.token);
    assert.equal(
      (
        await guest.request("/join", "POST", {
          token: ` ${result.token.toLowerCase()} `,
        })
      ).id,
      id,
    );
    await guest.request(path, "GET", undefined, 403);
    await guest.request(path, "POST", {}, 403);
    const next = await owner.request(path, "POST", {});
    assert.notEqual(next.token, result.token);
    await guest.request("/join", "POST", { token: result.token }, 404);
    assert.equal((await owner.request(path)).token, next.token);
    await owner.request(path, "DELETE");
    assert.equal((await owner.request(path)).token, null);
    await guest.request("/join", "POST", { token: next.token }, 404);
  }
});
test("数据库碰撞时重试且保留原口令；过期口令不能读取或加入", async () => {
  const mf = new Miniflare({
    workers: [
      {
        config: {
          name: "invite-test",
          type: "worker",
          compatibilityDate: "2026-09-17",
          manifest: {
            mainModule: "index.js",
            modules: {
              "index.js": {
                type: "esm",
                contents: "export default {fetch(){return new Response('ok')}}",
              },
            },
          },
          env: { DB: { type: "d1", id: "invite-test" } },
        },
      },
    ],
  });
  try {
    const DB = await mf.getD1Database("DB");
    for (const file of [
      "0001_initial.sql",
      "0002_email_auth.sql",
      "0003_short_invites.sql",
    ]) {
      const sql = await readFile(`infra/schema/${file}`, "utf8");
      await DB.exec(sql.replace(/\n/g, " "));
    }
    await DB.prepare(
      "INSERT INTO members (id,email,name,password_hash,salt) VALUES ('owner','test@example.test','Test','hash','salt')",
    ).run();
    for (const id of ["one", "two"])
      await DB.prepare(
        "INSERT INTO trips (id,title,owner_id,start_date,end_date,timezone,home_timezone,currency,home_currency) VALUES (?,'Trip','owner','2030-01-01','2030-01-02','UTC','UTC','USD','USD')",
      )
        .bind(id)
        .run();
    for (const [id, code] of [
      ["one", "BBBBBB"],
      ["two", "AAAAAA"],
    ])
      await DB.prepare(
        "INSERT INTO trip_invites (token_hash,trip_id,expires_at,code) VALUES (?,?,?,?)",
      )
        .bind(await sha(code), id, Date.now() + 60000, code)
        .run();
    const env = { DB } as unknown as Env,
      trip = { id: "one", owner_id: "owner" } as Trip;
    const req = new Request("http://localhost/api/trips/one/invites", {
      method: "POST",
    });
    const random = mock.method(
      crypto,
      "getRandomValues",
      (value: Uint8Array) => {
        value.fill(0);
        return value;
      },
    );
    try {
      await assert.rejects(invite(req, env, trip, "owner"), /暂时无法生成/);
    } finally {
      random.mock.restore();
    }
    assert.equal(
      await DB.prepare(
        "SELECT code FROM trip_invites WHERE trip_id='one'",
      ).first("code"),
      "BBBBBB",
    );
    let calls = 0;
    const retry = mock.method(
      crypto,
      "getRandomValues",
      (value: Uint8Array) => {
        value.fill(calls++ === 0 ? 0 : 2);
        return value;
      },
    );
    try {
      assert.equal(
        (await (await invite(req, env, trip, "owner")).json()).token,
        "CCCCCC",
      );
      assert.equal(calls, 2);
    } finally {
      retry.mock.restore();
    }
    await DB.prepare(
      "UPDATE trip_invites SET expires_at=0 WHERE trip_id='one'",
    ).run();
    assert.equal(
      (await (await invite(new Request(req.url), env, trip, "owner")).json())
        .token,
      null,
    );
    await assert.rejects(
      join(
        new Request("http://localhost/api/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: "CCCCCC" }),
        }),
        env,
        "owner",
      ),
      /邀请已失效或不存在/,
    );
  } finally {
    await mf.dispose();
  }
});
