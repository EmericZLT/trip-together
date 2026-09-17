"use client";
import { useState } from "react";
import type { TripDocument } from "@/lib/models";
import { api, apiUrl } from "@/lib/api";
import { uploadFile, validateFiles } from "@/lib/files/upload";
import { Sheet } from "../ui";
export function DocumentUpload({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null),
    [category, setCategory] = useState("行程"),
    [privateFile, setPrivate] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(0),
    [id] = useState(() => crypto.randomUUID());
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      validateFiles([file]);
      await uploadFile(
        apiUrl(
          `/documents/${id}?category=${encodeURIComponent(category)}&private=${privateFile ? 1 : 0}`,
        ),
        file,
        setProgress,
      ).promise;
      await onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet open title="上传旅行资料" onClose={() => !busy && onClose()}>
      <form className="editor-form" onSubmit={save}>
        <label>
          文件
          <input
            type="file"
            required
            disabled={busy}
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label>
          分类
          <input
            required
            maxLength={60}
            aria-label="分类"
            list="document-categories"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <datalist id="document-categories">
            {["行程", "交通", "住宿", "我的机票", "其他"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </datalist>
        </label>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={privateFile}
            onChange={(e) => setPrivate(e.target.checked)}
          />
          仅本人可见
        </label>
        <p className="muted">
          共享资料供本行程成员查看，可关联到事项。图片 / PDF，每份最多 10 MB。
        </p>
        {file?.type.startsWith("image/") && <FilePreview file={file} />}
        <progress value={progress} max={100} aria-label="资料上传进度" />
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <button className="primary-button" disabled={busy || !file}>
          {busy ? `上传中 ${progress}%` : error ? "重试上传" : "上传资料"}
        </button>
      </form>
    </Sheet>
  );
}
import { useEffect } from "react";
function FilePreview({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url ? (
    <img className="upload-preview" src={url} alt="待上传文件预览" />
  ) : null;
}
export function DeleteDocument({
  doc,
  onClose,
  onSaved,
}: {
  doc: TripDocument;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Sheet open title="删除旅行资料" onClose={() => !busy && onClose()}>
      <div className="editor-form">
        <p>确认删除「{doc.name}」？相关事项将不再关联这份文件。</p>
        {error && <p role="alert">{error}</p>}
        <button
          className="primary-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api(`/documents/${doc.id}`, { method: "DELETE" });
              await onSaved();
              onClose();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          确认删除资料
        </button>
      </div>
    </Sheet>
  );
}
