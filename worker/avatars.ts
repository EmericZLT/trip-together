import { HttpError, json } from "./http";
import { readUpload } from "./storage/read-upload";
export async function avatarResponse(
  request: Request,
  env: Env,
  id: string,
  memberId: string,
) {
  const member = await env.DB.prepare(
    "SELECT avatar_key,avatar_mime FROM members WHERE id=? AND (id=? OR EXISTS(SELECT 1 FROM trip_members a JOIN trip_members b ON b.trip_id=a.trip_id WHERE a.member_id=members.id AND b.member_id=?))",
  )
    .bind(id, memberId, memberId)
    .first<{ avatar_key: string | null; avatar_mime: string }>();
  if (!member?.avatar_key) throw new HttpError(404, "头像不存在");
  const headers = {
    "Content-Type": member.avatar_mime,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (request.method === "HEAD") {
    const object = await env.FILES.head(member.avatar_key);
    if (!object) throw new HttpError(404, "头像不存在");
    return new Response(null, { headers });
  }
  const object = await env.FILES.get(member.avatar_key);
  if (!object) throw new HttpError(404, "头像不存在");
  return new Response(object.body, { headers });
}
export async function uploadAvatar(
  request: Request,
  env: Env,
  memberId: string,
) {
  const old = await env.DB.prepare("SELECT avatar_key FROM members WHERE id=?")
    .bind(memberId)
    .first<{ avatar_key: string | null }>();
  if (request.method === "DELETE") {
    await env.DB.prepare(
      "UPDATE members SET avatar_key=NULL,avatar_mime=NULL,version=version+1 WHERE id=?",
    )
      .bind(memberId)
      .run();
    if (old?.avatar_key) await env.FILES.delete(old.avatar_key);
    return json({ ok: true });
  }
  const { bytes, mime } = await readUpload(request);
  if (!mime.startsWith("image/"))
    throw new HttpError(400, "头像需要 JPG、PNG 或 WebP 图片");
  const key = `avatars/${memberId}/${crypto.randomUUID()}`;
  await env.FILES.put(key, bytes, { httpMetadata: { contentType: mime } });
  try {
    await env.DB.prepare(
      "UPDATE members SET avatar_key=?,avatar_mime=?,version=version+1 WHERE id=?",
    )
      .bind(key, mime, memberId)
      .run();
  } catch (e) {
    await env.FILES.delete(key);
    throw e;
  }
  if (old?.avatar_key) await env.FILES.delete(old.avatar_key);
  return json({ ok: true });
}
