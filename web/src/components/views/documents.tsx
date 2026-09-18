"use client";
import { useState } from "react";
import {
  Plus,
  FileText,
  Download,
  Search,
  ImageIcon,
  ExternalLink,
  Plane,
  FolderOpen,
  Trash2,
} from "lucide-react";
import type { TripDocument } from "@/lib/models";
import { DocumentUpload, DeleteDocument } from "../files/document-manager";
import { SheetFooter, Sheet } from "../ui";
function documentTitle(doc: TripDocument) {
  return doc.name;
}
export function documentUrl(doc: TripDocument, download = false) {
  return `/api/files/${doc.id}${download ? "?download=1" : ""}`;
}
export function DocumentRow({
  doc,
  onOpen,
  onRemove,
}: {
  doc: TripDocument;
  onOpen: (doc: TripDocument) => void;
  onRemove?: () => void;
}) {
  const Icon = doc.mime === "application/pdf" ? FileText : ImageIcon;
  return (
    <div className="document-row">
      <button
        onClick={() => onOpen(doc)}
        className="document-main"
        aria-label={`查看${documentTitle(doc)}`}
      >
        <span
          className={`file-icon ${doc.mime.startsWith("image/") ? "file-thumbnail" : ""}`}
        >
          {doc.mime.startsWith("image/") ? (
            <img src={documentUrl(doc)} alt="" loading="lazy" />
          ) : (
            <Icon size={22} strokeWidth={1.5} />
          )}
        </span>
        <span>
          <strong>{documentTitle(doc)}</strong>
          <small>
            {doc.mime === "application/pdf" ? "PDF" : "图片"} ·{" "}
            {(doc.size / 1024 / 1024).toFixed(1)} MB
            {doc.owner_id ? " · 本人专属" : ""}
          </small>
        </span>
      </button>
      <a
        className="icon-button"
        href={documentUrl(doc, true)}
        aria-label={`下载${doc.name}`}
      >
        <Download size={19} />
      </a>
      {onRemove && (
        <button
          className="icon-button"
          aria-label={`移除${doc.name}`}
          onClick={onRemove}
        >
          <Trash2 size={17} />
        </button>
      )}
    </div>
  );
}
export function Documents({
  onRefresh,
  documents,
  onOpen,
}: {
  documents: TripDocument[];
  onRefresh: () => Promise<void>;
  onOpen: (doc: TripDocument) => void;
}) {
  const [uploading, setUploading] = useState(false),
    [deleting, setDeleting] = useState<TripDocument | null>(null);
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("全部");
  const filtered = documents.filter(
    (d) =>
      (filter === "全部" || d.category === filter) &&
      `${documentTitle(d)} ${d.name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <section className="page-content">
      <div className="page-title">
        <div className="page-heading-row">
          <h1>旅行资料</h1>
          <button
            className="icon-button page-add-button"
            aria-label="上传旅行资料"
            onClick={() => setUploading(true)}
          >
            <Plus size={23} />
          </button>
        </div>
        <p className="muted">查看、出示或下载机票、酒店凭证和行程文件。</p>
      </div>
      {uploading && (
        <DocumentUpload
          categories={documents.map((d) => d.category)}
          onClose={() => setUploading(false)}
          onSaved={onRefresh}
        />
      )}
      {deleting && (
        <DeleteDocument
          doc={deleting}
          onClose={() => setDeleting(null)}
          onSaved={onRefresh}
        />
      )}
      <label className="search-field">
        <Search size={18} />
        <input
          aria-label="搜索文件"
          placeholder="搜索机票、酒店、行程…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="chips" aria-label="文件分类">
        {["全部", ...new Set(documents.map((d) => d.category))].map((c) => (
          <button
            key={c}
            aria-pressed={filter === c}
            className={filter === c ? "chip active" : "chip"}
            onClick={() => setFilter(c)}
          >
            {c}
          </button>
        ))}
      </div>
      {documents.length > 0 && filter === "全部" && !query && (
        <div className="info-strip">
          <Plane size={19} />
          <span>“我的机票”中可以查看和出示本人的机票。</span>
        </div>
      )}
      <p className="list-caption">{filtered.length} 份文件</p>
      {filtered.length > 0 && (
        <div className="surface divided">
          {filtered.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              onOpen={onOpen}
              onRemove={doc.trip_id ? () => setDeleting(doc) : undefined}
            />
          ))}
        </div>
      )}
      {!filtered.length && (
        <div className="surface empty-state">
          <FolderOpen size={30} />
          <h3>{documents.length ? "没有找到这份资料" : "还没有旅行资料"}</h3>
          <p>
            {documents.length
              ? "尝试其他关键词或分类。"
              : "上传机票、住宿凭证或行程文件，方便旅行时查看。"}
          </p>
          <button
            className="text-action"
            onClick={() => {
              if (documents.length) {
                setQuery("");
                setFilter("全部");
              } else setUploading(true);
            }}
          >
            {documents.length ? "清除筛选" : "上传第一份资料"}
          </button>
        </div>
      )}
    </section>
  );
}
export function DocumentPreview({
  doc,
  onClose,
  sourceUrl,
}: {
  doc: TripDocument | null;
  sourceUrl?: string;
  onClose: () => void;
}) {
  if (!doc) return null;
  return (
    <Sheet
      open
      onClose={onClose}
      title={documentTitle(doc)}
      wide
      className="document-sheet"
    >
      <SheetFooter className="preview-actions">
        <a
          className="secondary-button"
          target="_blank"
          rel="noreferrer"
          href={sourceUrl ?? documentUrl(doc)}
        >
          <ExternalLink size={16} />
          单独打开
        </a>
        <a
          className="secondary-button"
          href={sourceUrl ?? documentUrl(doc, true)}
          download={sourceUrl ? doc.name : undefined}
        >
          <Download size={16} />
          下载
        </a>
      </SheetFooter>
      <div className="document-preview presenting">
        {doc.mime === "application/pdf" ? (
          <iframe
            title={documentTitle(doc)}
            src={(sourceUrl ?? documentUrl(doc)) + "#toolbar=0&view=FitH"}
          />
        ) : (
          /* Original private document needs a same-origin authenticated URL. */ <img
            src={sourceUrl ?? documentUrl(doc)}
            alt={doc.name}
          />
        )}
      </div>
      <p className="preview-hint">
        如手机浏览器未显示完整 PDF，请选择“单独打开”或下载后出示。
      </p>
    </Sheet>
  );
}
