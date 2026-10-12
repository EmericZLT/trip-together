import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { timingSafeEqual } from "node:crypto";
import { Miniflare } from "miniflare";
import worker from "../worker/index";
import { passwordHash } from "../worker/accounts/password";
Object.defineProperty(crypto.subtle, "timingSafeEqual", {
  value: timingSafeEqual,
  configurable: true,
});
async function fixture(approval = true) {
  const mf = new Miniflare({
    workers: [
      {
        config: {
          name: "registration-test",
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
          env: { DB: { type: "d1", id: "registration-test" } },
        },
      },
    ],
  });
  const DB = await mf.getD1Database("DB");
  for (const file of (await readdir("infra/schema")).sort()) {
    const sql = await readFile(`infra/schema/${file}`, "utf8");
    await DB.exec(sql.replace(/--[^\n]*/g, "").replace(/\n/g, " "));
  }
  const salt = "approver-salt";
  await DB.prepare(
    "INSERT INTO members (id,email,name,password_hash,salt) VALUES ('owner',?,'管理员',?,?)",
  )
    .bind("zhangleiting", await passwordHash("Owner-pass", salt), salt)
    .run();
  const env = {
    DB,
    APP_ENV: "production",
    SKIP_EMAIL_VERIFICATION: "true",
    SESSION_SIGNING_KEY: "a-test-key-that-is-at-least-32-characters",
    REGISTRATION_APPROVER: approval ? "zhangleiting" : "",
    ALLOWED_ORIGINS: "",
  } as unknown as Env;
  const call = async (
    path: string,
    data?: unknown,
    status = 200,
    cookie = "",
    ip = "203.0.113.8",
  ) => {
    const response = await worker.fetch(
      new Request(`https://travel.example.test/api/${path}`, {
        method: data ? "POST" : "GET",
        headers: {
          Origin: "https://travel.example.test",
          "Content-Type": "application/json",
          "CF-Connecting-IP": ip,
          ...(cookie ? { Cookie: cookie } : {}),
        },
        ...(data ? { body: JSON.stringify(data) } : {}),
      }),
      env,
    );
    const body = await response.json();
    assert.equal(response.status, status, JSON.stringify(body));
    return {
      body: body as {
        pending?: boolean;
        requests?: { id: string; email: string }[];
        error?: string;
      },
      cookie: response.headers.get("set-cookie")?.split(";")[0] ?? cookie,
    };
  };
  return { mf, call, DB, salt };
}
test("注册申请需管理员通过后才能登录，其他人不能审批", async () => {
  const { mf, call, DB, salt } = await fixture();
  try {
    const applied = await call("register", {
      email: "newtraveler",
      password: "Travel-1",
    });
    assert.equal(applied.body.pending, true);
    assert.equal(applied.cookie.includes("travel_session="), false);
    await call("register", { email: "newtraveler", password: "Travel-1" }, 409);
    await call("login", { email: "newtraveler", password: "Travel-1" }, 403);
    await call("login", { email: "newtraveler", password: "wrong-pass" }, 401);
    const owner = await call("login", {
      email: "zhangleiting",
      password: "Owner-pass",
    });
    const outsider = await call("register", {
      email: "outsider",
      password: "Travel-1",
    });
    assert.equal(outsider.body.pending, true);
    const outsiderLogin = await call(
      "login",
      {
        email: "outsider",
        password: "Travel-1",
      },
      403,
    );
    assert.equal(outsiderLogin.cookie.includes("travel_session="), false);
    await call("registrations", undefined, 401);
    await call("login", { email: "outsider", password: "Travel-1" }, 403);
    const pending = await call("registrations", undefined, 200, owner.cookie);
    assert.deepEqual(pending.body.requests?.map((row) => row.email).sort(), [
      "newtraveler",
      "outsider",
    ]);
    const target = pending.body.requests!.find(
      (row) => row.email === "newtraveler",
    )!;
    await DB.prepare(
      "INSERT INTO members (id,email,name,password_hash,salt) VALUES ('guest','guest','客人',?,?)",
    )
      .bind(await passwordHash("Owner-pass", salt), salt)
      .run();
    const guest = await call("login", {
      email: "guest",
      password: "Owner-pass",
    });
    await call(`registrations/${target.id}/approve`, {}, 403, guest.cookie);
    await call(`registrations/${target.id}/approve`, {}, 200, owner.cookie);
    const rejected = pending.body.requests!.find(
      (row) => row.email === "outsider",
    )!;
    await call(`registrations/${rejected.id}/reject`, {}, 200, owner.cookie);
    const left = await call("registrations", undefined, 200, owner.cookie);
    assert.deepEqual(left.body.requests, []);
    const session = await call("login", {
      email: "newtraveler",
      password: "Travel-1",
    });
    assert.match(session.cookie, /^travel_session=/);
    await call("login", { email: "outsider", password: "Travel-1" }, 401);
  } finally {
    await mf.dispose();
  }
});
test("同一地址连续猜测邀请口令会被拦住", async () => {
  const { mf, call } = await fixture(false);
  try {
    const owner = await call("login", {
      email: "zhangleiting",
      password: "Owner-pass",
    });
    for (let i = 0; i < 5; i++)
      await call("join", { token: "ABCDEF" }, 404, owner.cookie, "203.0.113.9");
    await call("join", { token: "ABCDEF" }, 429, owner.cookie, "203.0.113.9");
  } finally {
    await mf.dispose();
  }
});
