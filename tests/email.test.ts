import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { timingSafeEqual } from "node:crypto";
import { Miniflare } from "miniflare";
import worker from "../worker/index";
import {
  consumeCode,
  sendCode,
  verificationRequired,
} from "../worker/security/email";
import { passwordHash } from "../worker/accounts/password";
// Node's WebCrypto lacks this Workers extension.
Object.defineProperty(crypto.subtle, "timingSafeEqual", {
  value: timingSafeEqual,
  configurable: true,
});
async function fixture(legacy = false) {
  const mf = new Miniflare({
    workers: [
      {
        config: {
          name: "email-test",
          type: "worker",
          compatibilityDate: "2026-09-17",
          manifest: {
            mainModule: "index.js",
            modules: {
              "index.js": {
                type: "esm",
                contents:
                  "export default {fetch(){return new Response('test')}}",
              },
            },
          },
          env: { DB: { type: "d1", id: "email-test" } },
        },
      },
    ],
  });
  const DB = await mf.getD1Database("DB");
  for (const file of [
    "0001_initial.sql",
    "0002_email_auth.sql",
    "0003_short_invites.sql",
  ]) {
    const sql = await readFile(`infra/schema/${file}`, "utf8");
    await DB.exec(sql.replace(/--[^\n]*/g, "").replace(/\n/g, " "));
    if (legacy && file === "0001_initial.sql") {
      await DB.prepare(
        "INSERT INTO members (id,username,name,password_hash,salt,recovery_hash) VALUES ('legacy','old-account','Legacy',?,'test-salt','unused')",
      )
        .bind(await passwordHash("Password-12345", "test-salt"))
        .run();
      await DB.prepare(
        "INSERT INTO trips (id,title,owner_id,start_date,end_date,timezone,home_timezone,currency,home_currency) VALUES ('legacy-trip','Trip','legacy','2030-01-01','2030-01-02','UTC','UTC','USD','USD')",
      ).run();
    }
  }
  const mail: { to: string; text: string }[] = [];
  const env = {
    DB,
    APP_ENV: "production",
    EMAIL_FROM: "noreply@example.test",
    SESSION_SIGNING_KEY: "a-test-key-that-is-at-least-32-characters",
    EMAIL: {
      async send(message: { to: string; text: string }) {
        mail.push(message);
        return { messageId: "test" };
      },
    },
  } as unknown as Env;
  const request = (path: string, data?: unknown) =>
    new Request(`https://travel.example.test/api/${path}`, {
      method: data ? "POST" : "GET",
      headers: {
        Origin: "https://travel.example.test",
        "Content-Type": "application/json",
        "CF-Connecting-IP": crypto.randomUUID(),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
  const call = async (path: string, data?: unknown, status = 200) => {
    const r = await worker.fetch(request(path, data), env);
    assert.equal(r.status, status, await r.clone().text());
    return r;
  };
  const email = "traveler@example.test";
  async function issue(purpose: string) {
    await DB.prepare("UPDATE email_verifications SET sent_at=0").run();
    await call("email-code", { email, purpose });
    return mail.at(-1)!.text.match(/\d{6}/)![0];
  }
  return { mf, env, DB, mail, request, call, email, issue };
}
test("生产邮箱验证覆盖注册、登录、重置、旧账号绑定和会话撤销", async () => {
  const f = await fixture(true);
  try {
    const { email, call, issue, DB } = f,
      password = "Password-12345";
    assert.equal(
      (await (await call("auth-config")).json()).emailVerificationRequired,
      true,
    );
    await call("register", { email, password, name: "测试" }, 400);
    const code = await issue("register");
    const registered = await call("register", {
      email,
      password,
      name: "测试",
      code,
    });
    assert.ok(registered.headers.get("set-cookie"));
    await call(
      "register",
      { email: "second@example.test", password, name: "测试", code },
      400,
    );
    await call("login", { email, password }, 400);
    await call("login", { email, password, code }, 400);
    const loginCode = await issue("login");
    await call(
      "login",
      { email, password: "Wrong-password", code: loginCode },
      401,
    );
    await call("login", { email, password, code: loginCode });
    await call("login", { email, password, code: loginCode }, 400);
    const resetCode = await issue("recover");
    await call("recover", {
      email,
      password: password + "new",
      code: resetCode,
    });
    assert.equal(
      await DB.prepare("SELECT count(*) AS n FROM sessions").first("n"),
      0,
    );
    await call("recover", { email, password, code: resetCode }, 400);
    await call("login", { email, password, code: await issue("login") }, 401);
    await call("login", {
      email,
      password: password + "new",
      code: await issue("login"),
    });
    await DB.prepare(
      "UPDATE members SET email='other@example.test' WHERE email=?",
    )
      .bind(email)
      .run();
    await call("migrate-account", {
      email,
      password,
      legacyUsername: "old-account",
      code: await issue("migrate"),
    });
    assert.equal(
      await DB.prepare(
        "SELECT owner_id FROM trips WHERE id='legacy-trip'",
      ).first("owner_id"),
      "legacy",
    );
    assert.equal(
      await DB.prepare("SELECT email FROM members WHERE id='legacy'").first(
        "email",
      ),
      email,
    );
  } finally {
    await f.mf.dispose();
  }
});
test("验证码用途隔离、失效、最多五次、并发单次消费、发送失败和本地配置保护", async () => {
  const f = await fixture();
  try {
    const { env, email, request, issue, DB, call } = f;
    let code = await issue("register");
    await call("email-code", { email, purpose: "register" }, 429);
    await assert.rejects(
      consumeCode(request("register"), env, email, "recover", code),
    );
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++)
      await assert.rejects(
        consumeCode(request("register"), env, email, "register", wrong),
      );
    await assert.rejects(
      consumeCode(request("register"), env, email, "register", code),
    );
    code = await issue("register");
    await DB.prepare("UPDATE email_verifications SET expires_at=0").run();
    await assert.rejects(
      consumeCode(request("register"), env, email, "register", code),
    );
    code = await issue("register");
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        consumeCode(request("register"), env, email, "register", code),
      ),
    );
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    code = await issue("register");
    const newer = await issue("register");
    if (code !== newer)
      await assert.rejects(
        consumeCode(request("register"), env, email, "register", code),
      );
    await consumeCode(request("register"), env, email, "register", newer);
    env.EMAIL.send = async () => {
      throw new Error("fake delivery failure");
    };
    await DB.prepare("UPDATE email_verifications SET sent_at=0").run();
    await call("email-code", { email, purpose: "register" }, 503);
    assert.equal(
      await DB.prepare(
        "SELECT count(*) AS n FROM email_verifications WHERE purpose='register'",
      ).first("n"),
      0,
    );
    env.APP_ENV = "local";
    assert.throws(() => verificationRequired(request("auth-config"), env));
    const local = new Request("http://localhost/api/email-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, purpose: "register" }),
    });
    assert.equal(verificationRequired(local, env), false);
    await sendCode(local, env);
    await consumeCode(local, env, email, "register");
    env.APP_ENV = "production";
    assert.equal(verificationRequired(local, env), true);
  } finally {
    await f.mf.dispose();
  }
});
