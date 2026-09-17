"use client";
import { useRef } from "react";
import { Plus } from "lucide-react";
import { FileTiles } from "../files/file-tiles";
import { useReceipts } from "./use-receipts";
export { useReceipts } from "./use-receipts";
export function ReceiptPicker({
  receipts,
  disabled,
  onError,
}: {
  receipts: ReturnType<typeof useReceipts>;
  disabled: boolean;
  onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="receipt-picker">
      <input
        ref={input}
        hidden
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,application/pdf"
        aria-label="上传支出凭证"
        disabled={disabled}
        onChange={(e) => {
          try {
            receipts.add(Array.from(e.target.files || []));
            onError("");
          } catch (error) {
            onError((error as Error).message);
          }
          e.target.value = "";
        }}
      />
      <div className="receipt-caption">
        <span>凭证</span>
        <small>图片 / PDF · 单份 ≤10 MB</small>
      </div>
      <FileTiles
        files={receipts.files}
        disabled={disabled}
        onRetry={receipts.retry}
        onRemove={(id) =>
          void receipts.remove(id).catch((error) => onError(error.message))
        }
      >
        {receipts.files.length < 5 && (
          <button
            type="button"
            className="file-tile-preview receipt-add"
            aria-label="添加凭证"
            title="添加凭证"
            disabled={disabled}
            onClick={() => input.current?.click()}
          >
            <Plus size={26} strokeWidth={1.5} aria-hidden="true" />
          </button>
        )}
      </FileTiles>
    </div>
  );
}
