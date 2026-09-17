import { HttpError, json } from "../http";
import { readUpload } from "./read-upload";
export async function tripDocument(
  request: Request,
  env: Env,
  memberId: string,
  tripId: string,
  id: string,
) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(400, "文件编号无效");
  if (request.method === "DELETE") {
    const doc = await env.DB.prepare(
      "SELECT r2_key FROM documents WHERE id=? AND trip_id=? AND (owner_id IS NULL OR owner_id=?)",
    )
      .bind(id, tripId, memberId)
      .first<{ r2_key: string }>();
    if (!doc) throw new HttpError(404, "文件不存在");
    await env.FILES.delete(doc.r2_key);
    await env.DB.prepare("DELETE FROM documents WHERE id=? AND trip_id=?")
      .bind(id, tripId)
      .run();
    // Remove obsolete references from event JSON, advancing versions to avoid stale edits.
    await env.DB.prepare(
      "UPDATE events SET data=json_set(data,'$.documents',json(COALESCE((SELECT json_group_array(value) FROM json_each(events.data,'$.documents') WHERE value<>?), '[]'))),version=version+1 WHERE trip_id=? AND EXISTS(SELECT 1 FROM json_each(events.data,'$.documents') WHERE value=?)",
    )
      .bind(id, tripId, id)
      .run();
    return json({ ok: true });
  }
  const existing = await env.DB.prepare(
    "SELECT trip_id,uploaded_by FROM documents WHERE id=?",
  )
    .bind(id)
    .first<{ trip_id: string; uploaded_by: string }>();
  if (existing) {
    if (existing.trip_id !== tripId || existing.uploaded_by !== memberId)
      throw new HttpError(409, "文件编号冲突");
    return json({ id });
  }
  const { bytes, name, mime, size } = await readUpload(request),
    url = new URL(request.url);
  const category =
    (url.searchParams.get("category") ?? "行程").trim().slice(0, 60) || "行程";
  const owner = url.searchParams.get("private") === "1" ? memberId : null;
  const key = `trips/${tripId}/documents/${id}/${crypto.randomUUID()}`;
  await env.FILES.put(key, bytes, { httpMetadata: { contentType: mime } });
  try {
    await env.DB.prepare(
      "INSERT INTO documents (id,trip_id,name,category,owner_id,r2_key,mime,size,uploaded_by) VALUES (?,?,?,?,?,?,?,?,?)",
    )
      .bind(id, tripId, name, category, owner, key, mime, size, memberId)
      .run();
  } catch (e) {
    await env.FILES.delete(key);
    throw e;
  }
  return json({ id });
}
