"use client";
import { Check, FileText, Plus } from "lucide-react";
import type { TripDocument } from "@/lib/models";
import { fileUrl } from "@/lib/api";
export function DocumentChoices({
  documents,
  selected,
  onChange,
  onUpload,
}: {
  onUpload?: () => void;
  documents: TripDocument[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="document-choice-grid" role="group" aria-label="关联资料">
      {onUpload && (
        <button
          type="button"
          className="document-choice document-upload-choice"
          aria-label="上传并关联资料"
          onClick={onUpload}
        >
          <span className="document-choice-image">
            <Plus size={28} />
          </span>
          <span className="document-choice-name">上传资料</span>
        </button>
      )}
      {documents.map((doc) => {
        const checked = selected.includes(doc.id);
        return (
          <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-label={doc.name}
            className="document-choice"
            key={doc.id}
            onClick={() =>
              onChange(
                checked
                  ? selected.filter((id) => id !== doc.id)
                  : [...selected, doc.id],
              )
            }
          >
            <span className="document-choice-image">
              <span
                className={`file-icon ${doc.mime.startsWith("image/") ? "file-thumbnail" : ""}`}
              >
                {doc.mime.startsWith("image/") ? (
                  <img src={fileUrl(doc.id)} alt="" loading="lazy" />
                ) : (
                  <FileText size={30} />
                )}
              </span>
              <span className="document-choice-check">
                {checked && <Check size={14} />}
              </span>
            </span>
            <span className="document-choice-name">{doc.name}</span>
            {doc.owner_id && <small>仅自己可见</small>}
          </button>
        );
      })}
    </div>
  );
}
