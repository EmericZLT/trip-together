"use client";
import {
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
export { Sheet, SheetForm, SheetFooter } from "./sheets/sheet";
