import { HttpError, json } from "../http";
import { rateLimit } from "../security/rate-limit";
export function approverName(env: Env) {
  return env.REGISTRATION_APPROVER?.trim().toLowerCase() ?? "";
}
export async function isApprover(env: Env, memberId: string) {
  const name = approverName(env);
  if (!name) return false;
  const email = await env.DB.prepare("SELECT email FROM members WHERE id=?")
    .bind(memberId)
    .first<string>("email");
  return email?.toLowerCase() === name;
}
async function requireApprover(env: Env, memberId: string) {
  if (!(await isApprover(env, memberId)))
    throw new HttpError(403, "只有管理员可以审批注册");
}
export async function listRegistrations(
  request: Request,
  env: Env,
  memberId: string,
) {
  await requireApprover(env, memberId);
  await rateLimit(request, env, "registration-review", 30, memberId);
  const rows = await env.DB.prepare(
    "SELECT id,email,created_at FROM registration_requests ORDER BY created_at",
  ).all<{ id: string; email: string; created_at: string }>();
  return json({ requests: rows.results });
}
export async function reviewRegistration(
  request: Request,
  env: Env,
  memberId: string,
  id: string,
  action: "approve" | "reject",
) {
  await requireApprover(env, memberId);
  await rateLimit(request, env, "registration-review", 30, memberId);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "申请不存在");
  if (action === "reject") {
    const result = await env.DB.prepare(
      "DELETE FROM registration_requests WHERE id=?",
    )
      .bind(id)
      .run();
    if (!result.meta.changes) throw new HttpError(404, "申请不存在");
    return json({ ok: true });
  }
  const row = await env.DB.prepare(
    "SELECT id,email,password_hash,salt FROM registration_requests WHERE id=?",
  )
    .bind(id)
    .first<{
      id: string;
      email: string;
      password_hash: string;
      salt: string;
    }>();
  if (!row) throw new HttpError(404, "申请不存在");
  const inserted = await env.DB.prepare(
    "INSERT INTO members (id,email,name,password_hash,salt,email_verified_at) VALUES (?,?,?,?,?,?) ON CONFLICT(email) DO NOTHING",
  )
    .bind(
      row.id,
      row.email,
      "旅行者",
      row.password_hash,
      row.salt,
      env.APP_ENV === "local" ? null : Date.now(),
    )
    .run();
  if (!inserted.meta.changes) throw new HttpError(409, "这个用户名已经注册");
  await env.DB.prepare("DELETE FROM registration_requests WHERE id=?")
    .bind(id)
    .run();
  return json({ ok: true });
}
