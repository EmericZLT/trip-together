import { HttpError, json } from "../http";
import { readUpload } from "../storage/read-upload";
export async function uploadReceipt(
  request: Request,
  env: Env,
  memberId: string,
  tripId: string,
  id: string,
) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(400, "凭证编号无效");
  const existing = await env.DB.prepare(
    "SELECT id,uploaded_by,trip_id FROM receipts WHERE id=?",
  )
    .bind(id)
    .first<{ id: string; uploaded_by: string; trip_id: string }>();
  if (existing) {
    if (existing.uploaded_by !== memberId || existing.trip_id !== tripId)
      throw new HttpError(409, "凭证编号冲突");
    return json({ id });
  }
  const { bytes, name, mime, size } = await readUpload(request);
  const key = `trips/${tripId}/receipts/${id}/${crypto.randomUUID()}`;
  await env.FILES.put(key, bytes, { httpMetadata: { contentType: mime } });
  try {
    await env.DB.prepare(
      "INSERT INTO receipts (id,trip_id,uploaded_by,name,mime,size,r2_key) VALUES (?,?,?,?,?,?,?)",
    )
      .bind(id, tripId, memberId, name, mime, size, key)
      .run();
  } catch (e) {
    await env.FILES.delete(key);
    throw e;
  }
  return json({ id });
}
export async function deleteDraftReceipt(
  env: Env,
  memberId: string,
  tripId: string,
  id: string,
) {
  const deleted = await env.DB.prepare(
    "DELETE FROM receipts WHERE id=? AND trip_id=? AND uploaded_by=? AND expense_id IS NULL RETURNING r2_key",
  )
    .bind(id, tripId, memberId)
    .first<{ r2_key: string }>();
  if (deleted) await env.FILES.delete(deleted.r2_key);
  return json({ ok: true });
}
