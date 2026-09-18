import { HttpError } from "./http";
export async function fileResponse(
  request: Request,
  env: Env,
  memberId: string,
  id: string,
) {
  let doc = await env.DB.prepare(
    "SELECT * FROM documents d WHERE id=? AND ((trip_id IS NULL AND owner_id=?) OR (EXISTS(SELECT 1 FROM trip_members m WHERE m.trip_id=d.trip_id AND m.member_id=?) AND (owner_id IS NULL OR owner_id=?)))",
  )
    .bind(id, memberId, memberId, memberId)
    .first<{ r2_key: string; mime: string; name: string; size: number }>();
  if (!doc)
    doc = await env.DB.prepare(
      "SELECT r2_key,mime,name,size FROM receipts r WHERE id=? AND EXISTS(SELECT 1 FROM trip_members m WHERE m.trip_id=r.trip_id AND m.member_id=?) AND (expense_id IS NOT NULL OR uploaded_by=?)",
    )
      .bind(id, memberId, memberId)
      .first<{ r2_key: string; mime: string; name: string; size: number }>();
  if (!doc) throw new HttpError(404, "没有找到可以访问的文件");
  const range = request.headers.get("range");
  const head = await env.FILES.head(doc.r2_key);
  if (!head) throw new HttpError(404, "文件尚未导入，请完成资料初始化");
  const extension =
    (
      {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/webp": ".webp",
        "application/pdf": ".pdf",
      } as Record<string, string>
    )[doc.mime] ?? "";
  const filename =
    doc.name.toLowerCase().endsWith(extension) ||
    (doc.mime === "image/jpeg" && /\.jpe?g$/i.test(doc.name))
      ? doc.name
      : doc.name + extension;
  const headers = new Headers({
    "Content-Type": doc.mime,
    "Cache-Control": "private, no-store",
    "Accept-Ranges": "bytes",
    "Content-Disposition": `${new URL(request.url).searchParams.has("download") ? "attachment" : "inline"}; filename="document${extension}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  });
  let offset = 0,
    length = head.size,
    status = 200;
  if (range) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!match || (!match[1] && !match[2]))
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${head.size}` },
      });
    if (match[1]) {
      offset = Number(match[1]);
      length =
        Math.min(match[2] ? Number(match[2]) + 1 : head.size, head.size) -
        offset;
    } else {
      length = Math.min(Number(match[2]), head.size);
      offset = head.size - length;
    }
    if (offset >= head.size || length <= 0)
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${head.size}` },
      });
    status = 206;
    headers.set(
      "Content-Range",
      `bytes ${offset}-${offset + length - 1}/${head.size}`,
    );
  }
  headers.set("Content-Length", String(length));
  if (request.method === "HEAD") return new Response(null, { status, headers });
  const object = await env.FILES.get(doc.r2_key, { range: { offset, length } });
  if (!object) throw new HttpError(404, "文件不存在");
  return new Response(object.body, { status, headers });
}
