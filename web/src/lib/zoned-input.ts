export function localInput(instant: string, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
export function zonedInstant(value: string, zone: string, offsetHint = "") {
  const base = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(base)) throw new Error("请填写完整日期和时间");
  const matches: string[] = [];
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const instant = new Date(base - offset * 60000).toISOString();
    if (localInput(instant, zone) === value) {
      const sign = offset < 0 ? "-" : "+";
      const hint = `${sign}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0")}:${String(Math.abs(offset) % 60).padStart(2, "0")}`;
      if (!offsetHint || offsetHint === hint) matches.push(instant);
    }
  }
  if (!matches.length)
    throw new Error(
      "该当地时间不存在，或 UTC 偏移与时区不符，请检查夏令时与日期",
    );
  if (matches.length > 1)
    throw new Error("该时间因夏令时回拨出现两次，请填写 UTC 偏移以确定时间");
  return matches[0];
}
