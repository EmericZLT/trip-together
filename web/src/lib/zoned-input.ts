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
export function zonedChoices(value: string, zone: string, offsetHint = "") {
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
    throw new Error("这个时间因当地调整时钟而不存在，请选择其他时间");
  return matches;
}

export function zonedInstant(value: string, zone: string, offsetHint = "") {
  const matches = zonedChoices(value, zone, offsetHint);
  if (matches.length > 1)
    throw new Error("当地时钟回拨，这个时间出现两次，请选择第一次或第二次");
  return matches[0];
}
