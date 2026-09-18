"use client";
import { useId, useRef, useState } from "react";
import type { TripDocument } from "@/lib/models";
import { api, apiUrl } from "@/lib/api";
import { uploadFile } from "@/lib/files/upload";
import { Sheet } from "../ui";
import { FilePreview } from "./file-preview";
type UploadItem = {
  id: string;
  file: File;
  progress: number;
  done: boolean;
  error: string;
};
export function DocumentUpload({
  onClose,
  onSaved,
  onUploaded,
  category: initialCategory = "行程",
  categories = [],
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
  onUploaded?: (docs: TripDocument[]) => void;
  category?: string;
  categories?: string[];
}) {
  const categoryId = useId();
  const [items, setItems] = useState<UploadItem[]>([]),
    [category, setCategory] = useState(initialCategory),
    [privateFile, setPrivate] = useState(false),
    [started, setStarted] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [active, setActive] = useState("");
  const cancel = useRef<(() => void) | null>(null),
    cancelled = useRef(false);
  const locked = started,
    remaining = items.filter((i) => !i.done);
  function update(id: string, patch: Partial<UploadItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!category.trim()) {
      setError("请选择或输入资料分类");
      return;
    }
    cancelled.current = false;
    setStarted(true);
    setBusy(true);
    setError("");
    let failed = false;
    for (const item of remaining) {
      if (cancelled.current) {
        failed = true;
        break;
      }
      setActive(item.id);
      update(item.id, { error: "", progress: 0 });
      try {
        const task = uploadFile(
          apiUrl(
            `/documents/${item.id}?category=${encodeURIComponent(category.trim())}&private=${privateFile ? 1 : 0}`,
          ),
          item.file,
          (progress) => update(item.id, { progress }),
        );
        cancel.current = task.abort;
        await task.promise;
        update(item.id, { done: true });
        onUploaded?.([
          {
            id: item.id,
            name: item.file.name,
            category,
            owner_id: privateFile ? "self" : null,
            mime: item.file.type,
            size: item.file.size,
          },
        ]);
      } catch (e) {
        failed = true;
        update(item.id, { error: (e as Error).message });
      }
    }
    try {
      await onSaved();
      if (!failed) onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setActive("");
      cancel.current = null;
    }
  }
  return (
    <Sheet
      hasChanges={remaining.length > 0}
      open
      title="上传旅行资料"
      onClose={() => !busy && onClose()}
    >
      <form className="editor-form" onSubmit={save}>
        <label>
          资料分类
          <input
            aria-label="资料分类"
            required
            maxLength={60}
            list={categoryId}
            value={category}
            disabled={busy || locked}
            placeholder="选择分类，或输入新分类"
            onChange={(e) => setCategory(e.target.value)}
          />
          <datalist id={categoryId}>
            {[
              ...new Set([
                "行程",
                "交通",
                "住宿",
                "活动",
                "其他",
                ...categories,
              ]),
            ].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <small>可以选择已有分类，也可以直接输入名称新建分类。</small>
        </label>
        <label className="file-drop">
          ＋ 选择照片或文件
          <input
            type="file"
            aria-label="选择照片或文件"
            multiple
            disabled={busy}
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => {
              const selected = Array.from(e.target.files ?? []);
              setItems((prev) => [
                ...prev,
                ...selected.map((file) => ({
                  id: crypto.randomUUID(),
                  file,
                  progress: 0,
                  done: false,
                  error: "",
                })),
              ]);
              e.target.value = "";
            }}
          />
          <small>可多选，照片自动压缩；支持图片和 PDF。</small>
        </label>
        {items.map((item) => (
          <div className="upload-item" key={item.id}>
            <FilePreview file={item.file} />
            <div>
              <strong>{item.file.name}</strong>
              {item.done ? (
                <small>上传完成</small>
              ) : (
                <small>
                  {active === item.id ? `上传中 ${item.progress}%` : "等待上传"}
                </small>
              )}
              {!item.done && active === item.id && (
                <progress
                  value={item.progress}
                  max={100}
                  aria-label={`${item.file.name}上传进度`}
                />
              )}{" "}
              {item.error && (
                <p role="alert" className="error-message">
                  {item.error}
                </p>
              )}
            </div>
            {!busy && !item.done && (
              <button
                type="button"
                className="text-action"
                aria-label={`移除${item.file.name}`}
                onClick={() =>
                  setItems((prev) => prev.filter((i) => i.id !== item.id))
                }
              >
                移除
              </button>
            )}
          </div>
        ))}
        <details className="upload-visibility">
          <summary>
            可见范围：{privateFile ? "仅自己可见" : "同行成员可见"}
          </summary>
          <div
            role="group"
            aria-label="谁可以查看"
            className="segmented-choice"
          >
            {[
              [false, "同行成员可见"],
              [true, "仅自己可见"],
            ].map(([value, label]) => (
              <button
                type="button"
                key={String(value)}
                disabled={busy || locked}
                aria-pressed={privateFile === value}
                onClick={() => setPrivate(Boolean(value))}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="muted">
            {privateFile
              ? "只有你能查看这些文件。"
              : "当前行程的同行成员可以查看，请勿上传私人证件。"}
          </p>
        </details>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        {busy && (
          <button
            type="button"
            className="text-action"
            onClick={() => {
              cancelled.current = true;
              cancel.current?.();
            }}
          >
            暂停上传
          </button>
        )}
        <button className="primary-button" disabled={busy || !items.length}>
          {busy
            ? "正在上传…"
            : remaining.length
              ? items.some((i) => i.error)
                ? "重试未完成的文件"
                : `上传 ${remaining.length} 份资料`
              : "完成"}
        </button>
      </form>
    </Sheet>
  );
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
