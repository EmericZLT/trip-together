import { sha } from "../accounts/password";
import { HttpError } from "../http";
export async function rateLimit(
  request: Request,
  env: Env,
  scope: string,
  limit = 20,
  subject = request.headers.get("cf-connecting-ip") ?? "local",
) {
  const now = Date.now(),
    key = await sha(`${scope}:${subject}`);
  const count = await env.DB.prepare(
    "INSERT INTO login_attempts (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at < ? THEN 1 ELSE count+1 END,expires_at=CASE WHEN expires_at < ? THEN excluded.expires_at ELSE expires_at END RETURNING count",
  )
    .bind(key, now + 900000, now, now)
    .first<number>("count");
  if ((count ?? 0) > limit)
    throw new HttpError(429, "操作过于频繁，请在 15 分钟后重试");
}
