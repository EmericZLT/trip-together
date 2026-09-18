import { prepareFile } from "./prepare";
export function uploadFile(
  url: string,
  file: File,
  onProgress: (progress: number) => void,
) {
  const xhr = new XMLHttpRequest();
  let aborted = false;
  const promise = new Promise<void>((resolve, reject) => {
    xhr.open("PUT", url);
    xhr.timeout = 120000;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(
          Math.min(99, Math.round((event.loaded / event.total) * 100)),
        );
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        let message = "上传失败，请重试";
        try {
          message = JSON.parse(xhr.responseText).error || message;
        } catch {}
        reject(new Error(message));
      }
    };
    xhr.onerror = () => reject(new Error("网络连接失败，请重试"));
    xhr.ontimeout = () => reject(new Error("上传超时，请重试"));
    xhr.onabort = () => reject(new Error("上传已取消"));
    void prepareFile(file)
      .then((prepared) => {
        if (aborted) {
          reject(new Error("上传已取消"));
          return;
        }
        validateFiles([prepared]);
        xhr.setRequestHeader("Content-Type", prepared.type);
        xhr.setRequestHeader("X-File-Name", encodeURIComponent(prepared.name));
        xhr.send(prepared);
      })
      .catch(reject);
  });
  return {
    promise,
    abort: () => {
      aborted = true;
      xhr.abort();
    },
  };
}
export function validateFiles(files: File[], allowCompression = false) {
  for (const file of files) {
    if (
      !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
        file.type,
      )
    )
      throw new Error(
        "请选择 JPG、PNG、WebP 图片或 PDF；HEIC 照片请先导出为 JPG",
      );
    if (
      file.size > 10 * 1024 * 1024 &&
      !(allowCompression && file.type.startsWith("image/"))
    )
      throw new Error("文件处理后仍超过 10 MB，请选择较小文件或拆分 PDF");
    if (!file.size) throw new Error("不能上传空文件");
  }
}
