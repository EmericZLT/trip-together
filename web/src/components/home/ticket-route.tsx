import { ArrowRight } from "lucide-react";
import type { TripEvent } from "@/lib/models";
import { eventRoute } from "@/lib/event-route";
import { clockTime, dateLabel, zoneName } from "@/lib/time";
import { TravelSticker } from "../travel-sticker";

export function TicketRoute({ event }: { event: TripEvent }) {
  const route = eventRoute(event);
  if (!route) return null;
  const endZone = event.endTimezone ?? event.timezone;
  return (
    <div className="ticket-route">
      <div className="route-endpoint">
        <small>起点</small>
        <strong>{route.from.name}</strong>
        <span>
          {route.from.code}
          {route.from.code && " · "}
          {route.from.detail}
        </span>
        <time>{clockTime(event.start, event.timezone)}</time>
        <small>
          {dateLabel(event.start, event.timezone).split("星期")[0]} ·{" "}
          {zoneName(event.timezone)}
        </small>
      </div>
      <div className="ticket-route-direction" aria-hidden="true">
        <TravelSticker kind={event.kind} />
        <ArrowRight size={22} />
      </div>
      <div className="route-endpoint">
        <small>终点</small>
        <strong>{route.to.name}</strong>
        <span>
          {route.to.code}
          {route.to.code && " · "}
          {route.to.detail}
        </span>
        <time>{clockTime(event.end, endZone)}</time>
        <small>
          {dateLabel(event.end, endZone).split("星期")[0]} · {zoneName(endZone)}
        </small>
      </div>
    </div>
  );
}
