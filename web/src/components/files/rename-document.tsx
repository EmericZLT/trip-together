"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import type { TripDocument } from "@/lib/models";
import { Sheet, SheetForm, SheetFooter } from "../ui";
export function RenameDocument({
  doc,
  onClose,
  onSaved,
}: {
  doc: TripDocument;
  onClose: () => void;
  onSaved: (doc: TripDocument) => void;
}) {
  const [name, setName] = useState(doc.name),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Sheet
      open
      title="修改资料名称"
      onClose={() => !busy && onClose()}
      hasChanges={name !== doc.name}
    >
      <SheetForm
        className="editor-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!name.trim()) {
            setError("请输入资料名称");
            return;
          }
          setBusy(true);
          setError("");
          try {
            const result = await api<{ name: string }>(
              `/trips/${doc.trip_id}/documents/${doc.id}`,
              {
                method: "PATCH",
                body: JSON.stringify({
                  name: name.trim(),
                  previousName: doc.name,
                }),
              },
            );
            onSaved({ ...doc, name: result.name });
            onClose();
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          资料名称
          <input
            aria-label="资料名称"
            value={name}
            maxLength={200}
            required
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <small>
          使用容易记住的名称，之后可以直接搜索；不需要填写文件扩展名。
        </small>
        <SheetFooter>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <button className="primary-button" disabled={busy || !name.trim()}>
            {busy ? "正在保存…" : "保存名称"}
          </button>
        </SheetFooter>
      </SheetForm>
    </Sheet>
  );
}
