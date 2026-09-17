import { z } from "zod";
import { body, HttpError, json } from "../http";
import { hex } from "../accounts/password";
import { rateLimit } from "./rate-limit";
export const emailAddress = z
  .string()
  .trim()
  .toLowerCase()
  .email("请输入有效的邮箱地址")
  .max(254);
const purposes = z.enum(["register", "recover", "migrate"]);
type Purpose = z.infer<typeof purposes>;
const labels: Record<Purpose, string> = {
  register: "注册账号",
  recover: "重置密码",
  migrate: "绑定邮箱",
};
export function verificationRequired(request: Request, env: Env) {
  if (env.APP_ENV !== "local") return true;
  const url = new URL(request.url);
  const local =
    /^(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(
      url.hostname,
    );
  if (url.protocol !== "http:" || !local)
    throw new HttpError(503, "邮箱验证环境配置不正确");
  return false;
}
async function digest(
  env: Env,
  email: string,
  purpose: Purpose,
  nonce: string,
  code: string,
) {
  if (!env.SESSION_SIGNING_KEY || env.SESSION_SIGNING_KEY.length < 32)
    throw new HttpError(503, "邮件验证服务尚未配置");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.SESSION_SIGNING_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(JSON.stringify([email, purpose, nonce, code])),
    ),
  );
}
function randomCode() {
  const value = new Uint32Array(1);
  do {
    crypto.getRandomValues(value);
  } while (value[0] >= 4294000000);
  return String(value[0] % 1000000).padStart(6, "0");
}
export async function sendCode(request: Request, env: Env) {
  const required = verificationRequired(request, env);
  const input = await body(
    request,
    z.object({ email: emailAddress, purpose: purposes }),
  );
  if (!required) return json({ ok: true, emailVerificationRequired: false });
  if (!env.EMAIL || !emailAddress.safeParse(env.EMAIL_FROM).success)
    throw new HttpError(503, "邮件发送服务尚未配置");
  await rateLimit(request, env, "email", 10);
  await rateLimit(request, env, "email-recipient", 10, input.email);
  const now = Date.now(),
    nonce = crypto.randomUUID(),
    code = randomCode();
  const hash = await digest(env, input.email, input.purpose, nonce, code);
  await env.DB.prepare("DELETE FROM email_verifications WHERE expires_at < ?")
    .bind(now - 86400000)
    .run();
  const inserted = await env.DB.prepare(
    "INSERT INTO email_verifications (email,purpose,nonce,code_hash,sent_at,expires_at) VALUES (?,?,?,?,?,?) ON CONFLICT(email,purpose) DO UPDATE SET nonce=excluded.nonce,code_hash=excluded.code_hash,sent_at=excluded.sent_at,expires_at=excluded.expires_at,attempts=0,ready=0 WHERE email_verifications.sent_at <= ?",
  )
    .bind(
      input.email,
      input.purpose,
      nonce,
      hash,
      now,
      now + 600000,
      now - 60000,
    )
    .run();
  if (!inserted.meta.changes)
    throw new HttpError(429, "请等待 60 秒后再发送验证码");
  try {
    await env.EMAIL.send({
      from: env.EMAIL_FROM,
      to: input.email,
      subject: `${labels[input.purpose]}验证码`,
      text: `您的${labels[input.purpose]}验证码是：${code}。验证码在 10 分钟内有效，仅可使用一次。如果不是您本人操作，请忽略此邮件。`,
    });
    await env.DB.prepare(
      "UPDATE email_verifications SET ready=1 WHERE email=? AND purpose=? AND nonce=?",
    )
      .bind(input.email, input.purpose, nonce)
      .run();
  } catch (error) {
    const serviceCode =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "unknown";
    // Never log the payload, recipient, verification code, or provider message.
    console.error(
      JSON.stringify({
        event: "email_send_failed",
        type: error instanceof TypeError ? "TypeError" : "Error",
        code: /^E_[A-Z_]{1,60}$/.test(serviceCode) ? serviceCode : "unknown",
      }),
    );
    await env.DB.prepare(
      "DELETE FROM email_verifications WHERE email=? AND purpose=? AND nonce=?",
    )
      .bind(input.email, input.purpose, nonce)
      .run();
    throw new HttpError(503, "验证码发送失败，请稍后重试");
  }
  return json({ ok: true, retryAfter: 60 });
}
export async function consumeCode(
  request: Request,
  env: Env,
  email: string,
  purpose: Purpose,
  code?: string,
) {
  if (!verificationRequired(request, env)) return;
  if (!code || !/^\d{6}$/.test(code))
    throw new HttpError(400, "请输入 6 位邮箱验证码");
  // Each attempt reserves its slot atomically; only one successful request can consume a challenge.
  const challenge = await env.DB.prepare(
    "UPDATE email_verifications SET attempts=attempts+1 WHERE email=? AND purpose=? AND ready=1 AND attempts<5 AND expires_at>? RETURNING nonce,code_hash",
  )
    .bind(email, purpose, Date.now())
    .first<{ nonce: string; code_hash: string }>();
  const invalid = () =>
    new HttpError(400, "验证码不正确、已经失效或尝试次数过多，请重新发送");
  if (!challenge) throw invalid();
  const hash = await digest(env, email, purpose, challenge.nonce, code);
  if (hash !== challenge.code_hash) throw invalid();
  const used = await env.DB.prepare(
    "UPDATE email_verifications SET ready=0 WHERE email=? AND purpose=? AND nonce=? AND ready=1 AND expires_at>?",
  )
    .bind(email, purpose, challenge.nonce, Date.now())
    .run();
  if (!used.meta.changes) throw invalid();
}
