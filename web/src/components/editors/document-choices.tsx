"use client";
import { Check, FileText } from "lucide-react";
import type { TripDocument } from "@/lib/models";
export function DocumentChoices({
  documents,
  selected,
  onChange,
}: {
  documents: TripDocument[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="document-choice-grid" role="group" aria-label="关联资料">
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
              {doc.mime.startsWith("image/") ? (
                <img src={`/api/files/${doc.id}`} alt="" loading="lazy" />
              ) : (
                <FileText size={30} />
              )}
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
