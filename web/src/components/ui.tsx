"use client";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  Plane,
  Car,
  BedDouble,
  Compass,
  ArrowRightLeft,
  ChevronRight,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { TripEvent } from "@/lib/models";
export const eventIcons = {
  flight: Plane,
  drive: Car,
  stay: BedDouble,
  explore: Compass,
  transfer: ArrowRightLeft,
};
export function EventIcon({
  kind,
  size = 22,
}: {
  kind: TripEvent["kind"];
  size?: number;
}) {
  const Icon = eventIcons[kind];
  return <Icon size={size} strokeWidth={1.6} />;
}
export function SectionTitle({
  children,
  action,
  onClick,
}: {
  children: ReactNode;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="section-heading">
      <h2>{children}</h2>
      {action && (
        <button className="text-action" onClick={onClick}>
          {action}
          <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
  className = "",
  hasChanges,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
  className?: string;
  hasChanges?: boolean;
}) {
  const [dirty, setDirty] = useState(false),
    [discard, setDiscard] = useState(false);
  const changed = hasChanges ?? dirty;
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!changed) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [changed]);
  function requestClose() {
    if (changed && content.current?.querySelector("form")) setDiscard(true);
    else onClose();
  }
  return (
    <Dialog.Root open={open} onOpenChange={(value) => !value && requestClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay" />
        <Dialog.Content
          ref={content}
          onInputCapture={(e) => {
            if (
              !(e.target as HTMLElement)
                .getAttribute("aria-label")
                ?.startsWith("搜索")
            )
              setDirty(true);
          }}
          onClickCapture={(e) => {
            if (
              (e.target as HTMLElement).closest(
                'button[aria-pressed], button[role="checkbox"]',
              )
            )
              setDirty(true);
          }}
          className={`sheet ${wide ? "sheet-wide" : ""} ${className}`}
          aria-describedby={description ? "sheet-description" : undefined}
        >
          <div className="sheet-handle" />
          <header className="sheet-header">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              {description && (
                <Dialog.Description id="sheet-description">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close className="icon-button" aria-label="关闭">
              <X size={22} />
            </Dialog.Close>
          </header>
          {discard && (
            <div className="discard-prompt" role="alert">
              <p>还有未保存的内容，要继续编辑吗？</p>
              <div className="form-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setDiscard(false)}
                >
                  继续编辑
                </button>
                <button type="button" className="text-action" onClick={onClose}>
                  放弃修改并关闭
                </button>
              </div>
            </div>
          )}
          <div hidden={discard}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
