import { zonedChoices } from "../../../lib/zoned-input";
export type Timing = {
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
  endTimezone: string;
  timeMode: "date" | "timed";
  range: boolean;
  firstChoice: string;
  lastChoice: string;
};
export function resolveLocal(value: string, zone: string, choice: string) {
  const options = zonedChoices(value, zone);
  if (options.length > 1 && !choice)
    throw new Error("当地时钟回拨，这个时间出现两次，请选择第一次或第二次");
  if (!options.length) throw new Error("这个当地时间不存在，请重新选择");
  return options[Math.max(0, Number(choice) || 0)];
}
export function resolveTiming(v: Timing, kind: string) {
  const timed = v.timeMode === "timed";
  if (v.range && v.endTime && !v.startTime)
    throw new Error("请选择开始时间，或清除结束时间以仅记录日期");
  if (timed && !v.startTime) throw new Error("请选择开始时间");
  if (timed && v.range && !v.endTime)
    throw new Error("请选择结束时间，或关闭时间段");
  const endDate = v.range ? v.endDate : v.date;
  const endTimezone = v.range ? v.endTimezone : v.timezone;
  const start = resolveLocal(
    `${v.date}T${timed ? v.startTime : "00:00"}`,
    v.timezone,
    v.firstChoice,
  );
  let end: string;
  if (!timed) {
    const date = new Date(`${endDate}T12:00:00Z`);
    if (kind !== "stay" || !v.range) date.setUTCDate(date.getUTCDate() + 1);
    end = resolveLocal(
      `${date.toISOString().slice(0, 10)}T00:00`,
      endTimezone,
      "0",
    );
  } else
    end = v.range
      ? resolveLocal(`${endDate}T${v.endTime}`, endTimezone, v.lastChoice)
      : new Date(Date.parse(start) + 1).toISOString();
  if (Date.parse(end) <= Date.parse(start))
    throw new Error("结束时间需要晚于开始，请检查日期与当地时间");
  return {
    start,
    end,
    timeRange: v.range,
    timeMode: v.timeMode,
    dateEnd: endDate,
    endUnspecified: timed && !v.range,
    timezone: v.timezone,
    endTimezone,
  };
}
