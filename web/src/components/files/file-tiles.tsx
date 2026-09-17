"use client";
import { useState, type ReactNode } from "react";
import { FileText, X, RotateCw, LoaderCircle } from "lucide-react";
import type { TripDocument } from "@/lib/models";
import { DocumentPreview } from "../views/documents";
export type FileTile = {
  id: string;
  name: string;
  mime: string;
  size: number;
  url: string;
  status?: "uploading" | "ready" | "error";
  progress?: number;
  error?: string;
};
export function FileTiles({
  files,
  children,
  onRemove,
  onRetry,
  disabled = false,
}: {
  files: FileTile[];
  children?: ReactNode;
  onRemove?: (id: string) => void;
  onRetry?: (id: string) => void;
  disabled?: boolean;
}) {
  const [preview, setPreview] = useState<FileTile | null>(null);
  return (
    <>
      <div className="file-tiles">
        {files.map((file) => (
          <div className="file-tile" key={file.id}>
            <button
              className="file-tile-preview"
              type="button"
              aria-label={`查看${file.name}`}
              onClick={() => setPreview(file)}
            >
              {file.mime.startsWith("image/") ? (
                <img src={file.url} alt={file.name} />
              ) : (
                <FileText size={30} />
              )}
            </button>
            {onRemove && (
              <button
                type="button"
                className="file-tile-remove"
                aria-label={`移除${file.name}`}
                disabled={disabled}
                onClick={() => {
                  if (preview?.id === file.id) setPreview(null);
                  onRemove(file.id);
                }}
              >
                <X size={13} />
              </button>
            )}
            <span className="file-tile-name">{file.name}</span>
            {file.status === "uploading" && (
              <div className="upload-status" role="status">
                <LoaderCircle size={12} className="animate-spin" />
                上传中 {file.progress ?? 0}%
                <progress
                  aria-label={`${file.name}上传进度`}
                  value={file.progress ?? 0}
                  max={100}
                />
              </div>
            )}
            {file.status === "ready" && (
              <small className="upload-ready">已上传</small>
            )}
            {file.status === "error" && (
              <button
                type="button"
                className="upload-retry"
                disabled={disabled}
                onClick={() => onRetry?.(file.id)}
                title={file.error}
              >
                <RotateCw size={12} />
                上传失败，重试
              </button>
            )}
          </div>
        ))}
        {children}
      </div>
      {preview && (
        <DocumentPreview
          doc={{ ...preview, category: "文件", owner_id: null } as TripDocument}
          sourceUrl={preview.url}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}
