"use client";
import { useState } from "react";
import { ArrowUpRight, ClipboardCheck, Copy } from "lucide-react";
import { mapCopyText, mapLink, mapSearchLink } from "../../../shared/places";
import type { TripEvent } from "@/lib/models";

export function MapPlaceActions({ event }: { event: TripEvent }) {
  const [copied, setCopied] = useState<"ok" | "fail" | "">("");
  const copyText = eventCopyText(event);
  const mapQuery = eventMapQuery(event);
  const mapHref = event.location
    ? mapLink(event.location)
    : mapQuery
      ? mapSearchLink(mapQuery)
      : "";
  if (!mapHref && !copyText) return null;
  return (
    <div className="event-map-actions">
      {mapHref && (
        <a
          className="secondary-button"
          target="_blank"
          rel="noreferrer"
          href={mapHref}
        >
          Google 地图
          <ArrowUpRight size={16} />
        </a>
      )}
      {copyText && (
        <button
          type="button"
          className="secondary-button"
          onClick={async () => {
            const ok = await copyToClipboard(copyText);
            setCopied(ok ? "ok" : "fail");
            window.setTimeout(() => setCopied(""), 2000);
          }}
        >
          {copied === "ok" ? <ClipboardCheck size={16} /> : <Copy size={16} />}
          {copied === "ok"
            ? "已复制"
            : copied === "fail"
              ? "复制失败"
              : "复制地点"}
        </button>
      )}
    </div>
  );
}

export function eventMapQuery(event: TripEvent) {
  return (
    [event.address, event.place, event.to].find((value) => value?.trim())?.trim() ??
    ""
  );
}

export function eventCopyText(event: TripEvent) {
  return mapCopyText({
    name: [event.place, event.to].find((value) => value?.trim())?.trim(),
    address: event.address,
    latitude: event.location?.latitude,
    longitude: event.location?.longitude,
  });
}

async function copyToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await Promise.race([
        navigator.clipboard.writeText(text),
        new Promise<never>((_, reject) =>
          window.setTimeout(() => reject(new Error("clipboard-timeout")), 800),
        ),
      ]);
      return true;
    }
  } catch {
    /* fall through to execCommand */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
