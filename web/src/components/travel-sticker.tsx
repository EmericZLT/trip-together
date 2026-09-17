import type { TripEvent } from "@/lib/models";

export function TravelSticker({
  kind,
  className = "",
}: {
  kind: TripEvent["kind"] | "luggage";
  className?: string;
}) {
  return (
    <span
      className={`travel-sticker sticker-${kind} ${className}`}
      aria-hidden="true"
    />
  );
}
