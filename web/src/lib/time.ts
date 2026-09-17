import type { TripEvent } from "./models";
export function localDate(date: Date | string | number, timezone = "UTC") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}
export function clockTime(
  date: Date | string | number,
  timezone: string,
  seconds = false,
) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...(seconds ? { second: "2-digit" as const } : {}),
  }).format(new Date(date));
}
export function dateLabel(date: Date | string | number, timezone = "UTC") {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: timezone,
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(date));
}
export function selectEvents(events: TripEvent[], now: number) {
  const sorted = [...events].sort(
    (a, b) => Date.parse(a.start) - Date.parse(b.start),
  );
  const current = sorted
    .filter((e) => Date.parse(e.start) <= now && now < Date.parse(e.end))
    .at(-1);
  const next = sorted.find((e) => Date.parse(e.start) > now);
  return {
    current,
    next,
    featured: current ?? next,
    finished:
      sorted.length > 0 && sorted.every((e) => now >= Date.parse(e.end)),
  };
}
export function countdown(target: string, now: number) {
  const remaining = Math.max(0, Math.ceil((Date.parse(target) - now) / 1000));
  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const mins = Math.floor((remaining % 3600) / 60);
  const secs = remaining % 60;
  const clock = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  return days > 0 ? `${days} 天 ${clock}` : clock;
}
export function zoneName(zone: string) {
  const labels: Record<string, string> = {
    "Asia/Shanghai": "北京时间",
    "Pacific/Auckland": "新西兰时间",
    "Asia/Singapore": "新加坡时间",
    UTC: "UTC",
  };
  return labels[zone] ?? zone;
}
