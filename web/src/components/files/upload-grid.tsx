"use client";
import { useRef } from "react";
import { Progress } from "antd";
import { Plus, X } from "lucide-react";
import { FilePreview } from "./file-preview";
export type UploadItem = {
  id: string;
  file: File;
  progress: number;
  done: boolean;
  error: string;
};
export function UploadGrid({
  items,
  busy,
  active,
  onAdd,
  onRemove,
}: {
  items: UploadItem[];
  busy: boolean;
  active: string;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input
        ref={input}
        hidden
        type="file"
        aria-label="选择照片或文件"
        multiple
        disabled={busy}
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={(event) => {
          onAdd(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      <div
        className="document-choice-grid upload-grid"
        role="group"
        aria-label="上传文件"
      >
        {items.map((item) => (
          <div className="document-choice" key={item.id}>
            <div className="document-choice-image">
              <span
                className={`file-icon ${item.file.type.startsWith("image/") ? "file-thumbnail" : ""}`}
              >
                <FilePreview file={item.file} />
              </span>
              {active === item.id && !item.done && (
                <div className="upload-progress-overlay">
                  <Progress
                    aria-label={`${item.file.name}上传进度`}
                    type="circle"
                    percent={item.progress}
                    size={58}
                    strokeColor="#786391"
                  />
                </div>
              )}
              {!busy && !item.done && (
                <button
                  type="button"
                  className="upload-remove"
                  aria-label={`移除${item.file.name}`}
                  onClick={() => onRemove(item.id)}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <span className="document-choice-name" title={item.file.name}>
              {item.file.name}
            </span>
            <small>
              {item.done
                ? "上传完成"
                : item.error
                  ? "上传失败"
                  : active === item.id
                    ? "正在上传"
                    : "等待上传"}
            </small>
            {item.error && (
              <p role="alert" className="error-message">
                {item.error}
              </p>
            )}
          </div>
        ))}
        <button
          type="button"
          className="document-choice document-upload-choice"
          aria-label="添加照片或文件"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <span className="document-choice-image">
            <Plus size={28} />
          </span>
          <span className="document-choice-name">添加照片或文件</span>
        </button>
      </div>
      <small className="muted">可多选，照片自动压缩；支持图片和 PDF。</small>
    </div>
  );
}
