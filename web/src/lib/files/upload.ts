export function uploadFile(
  url: string,
  file: File,
  onProgress: (progress: number) => void,
) {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<void>((resolve, reject) => {
    xhr.open("PUT", url);
    xhr.timeout = 120000;
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
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
    xhr.send(file);
  });
  return { promise, abort: () => xhr.abort() };
}
export function validateFiles(files: File[]) {
  for (const file of files) {
    if (
      !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
        file.type,
      )
    )
      throw new Error("支持 JPG、PNG、WebP 或 PDF 文件");
    if (file.size > 10 * 1024 * 1024) throw new Error("每份文件不能超过 10 MB");
    if (!file.size) throw new Error("不能上传空文件");
  }
}
