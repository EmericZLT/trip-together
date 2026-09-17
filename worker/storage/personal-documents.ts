import { HttpError, json } from "../http";
import { readUpload } from "./read-upload";
export async function personalDocument(
  request: Request,
  env: Env,
  memberId: string,
  id: string,
) {
  if (!/^personal-[0-9a-f-]{36}$/.test(id))
    throw new HttpError(400, "证件编号无效");
  if (request.method === "DELETE") {
    const deleted = await env.DB.prepare(
      "DELETE FROM documents WHERE id=? AND owner_id=? AND category='个人证件' RETURNING r2_key",
    )
      .bind(id, memberId)
      .first<{ r2_key: string }>();
    if (!deleted) throw new HttpError(404, "证件不存在");
    await env.FILES.delete(deleted.r2_key);
    return json({ ok: true });
  }
  const existing = await env.DB.prepare(
    "SELECT owner_id FROM documents WHERE id=?",
  )
    .bind(id)
    .first<{ owner_id: string }>();
  if (existing) {
    if (existing.owner_id !== memberId)
      throw new HttpError(409, "证件编号冲突");
    return json({ id });
  }
  const { bytes, name, mime, size } = await readUpload(request);
  const key = `personal/${memberId}/${id}/${crypto.randomUUID()}`;
  await env.FILES.put(key, bytes, { httpMetadata: { contentType: mime } });
  try {
    await env.DB.prepare(
      "INSERT INTO documents (id,name,category,owner_id,r2_key,mime,size,uploaded_by) VALUES (?,?,'个人证件',?,?,?,?,?)",
    )
      .bind(id, name, memberId, key, mime, size, memberId)
      .run();
  } catch (error) {
    await env.FILES.delete(key);
    throw error;
  }
  return json({ id });
}
