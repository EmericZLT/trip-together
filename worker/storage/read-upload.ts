import { HttpError } from "../http";
const LIMIT = 10 * 1024 * 1024;
const accepted = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export async function readUpload(request: Request) {
  const mime = request.headers.get("content-type") || "";
  if (!accepted.includes(mime))
    throw new HttpError(415, "支持 JPG、PNG、WebP 或 PDF 文件");
  let name: string;
  try {
    name = decodeURIComponent(request.headers.get("x-file-name") || "凭证");
  } catch {
    throw new HttpError(400, "文件名无效");
  }
  if (!name.trim() || name.length > 180 || /[\r\n]/.test(name))
    throw new HttpError(400, "文件名无效或过长");
  if (Number(request.headers.get("content-length")) > LIMIT)
    throw new HttpError(413, "每份凭证不能超过 10 MB");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "请选择文件");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > LIMIT) {
      await reader.cancel();
      throw new HttpError(413, "每份凭证不能超过 10 MB");
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const prefix = new TextDecoder().decode(bytes.slice(0, 12));
  const valid =
    mime === "image/jpeg"
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : mime === "image/png"
        ? [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)
        : mime === "image/webp"
          ? prefix.startsWith("RIFF") && prefix.slice(8, 12) === "WEBP"
          : prefix.startsWith("%PDF-");
  if (!valid) throw new HttpError(400, "文件内容与格式不符");
  return { bytes, name, mime, size };
}
