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
import type { ReactNode } from "react";
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
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(value) => !value && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay" />
        <Dialog.Content
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
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
