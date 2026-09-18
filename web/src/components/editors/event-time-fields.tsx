"use client";
import { Field, ZoneField } from "./fields";
import { zonedChoices } from "@/lib/zoned-input";
export type Timing = {
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
  endTimezone: string;
  timeMode: "date" | "timed";
  firstChoice: string;
  lastChoice: string;
};
export function resolveLocal(value: string, zone: string, choice: string) {
  const options = zonedChoices(value, zone);
  if (options.length > 1 && !choice)
    throw new Error("当地时钟回拨，这个时间出现两次，请选择第一次或第二次");
  return options[Math.max(0, Number(choice) || 0)];
}
function RepeatedTime({
  value,
  zone,
  choice,
  onChange,
  label,
}: {
  value: string;
  zone: string;
  choice: string;
  onChange: (s: string) => void;
  label: string;
}) {
  let options: string[] = [];
  try {
    options = zonedChoices(value, zone);
  } catch {}
  if (options.length < 2) return null;
  return (
    <label>
      {label}在当地出现两次
      <select
        aria-label={`${label}出现次数`}
        required
        value={choice}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">请选择</option>
        <option value="0">第一次（时钟回拨前）</option>
        <option value="1">第二次（时钟回拨后）</option>
      </select>
    </label>
  );
}
export function EventTimeFields({
  v,
  kind,
  onChange,
}: {
  v: Timing;
  kind: string;
  onChange: (v: Timing) => void;
}) {
  const stay = kind === "stay",
    flight = kind === "flight";
  const transport = ["flight", "drive", "transfer"].includes(kind);
  const set = (key: keyof Timing, value: string) =>
    onChange({
      ...v,
      [key]: value,
      ...(["date", "startTime", "timezone"].includes(key)
        ? { firstChoice: "" }
        : {}),
      ...(["endDate", "endTime", "endTimezone"].includes(key)
        ? { lastChoice: "" }
        : {}),
    });
  return (
    <div className="event-time-card">
      <div className="form-grid event-date-fields">
        <Field
          label={stay ? "入住日期" : flight ? "起飞日期" : "日期"}
          type="date"
          required
          value={v.date}
          onChange={(date) =>
            onChange({
              ...v,
              date,
              endDate: v.endDate < date ? date : v.endDate,
              firstChoice: "",
              lastChoice: "",
            })
          }
        />
        {(stay || flight) && (
          <Field
            label={stay ? "退房日期" : "落地日期"}
            type="date"
            required
            min={stay ? v.date : undefined}
            value={v.endDate}
            onChange={(s) => set("endDate", s)}
          />
        )}
      </div>
      <label className="inline-check event-time-switch">
        <input
          type="checkbox"
          aria-label={
            stay
              ? "填写入住和退房时间"
              : flight
                ? "已知起飞和落地时间"
                : "填写具体时间"
          }
          checked={v.timeMode === "timed"}
          onChange={(e) => set("timeMode", e.target.checked ? "timed" : "date")}
        />
        <span>填写时间</span>
      </label>
      {v.timeMode === "timed" && (
        <div className="form-grid event-hours-fields">
          <Field
            label={stay ? "入住时间" : flight ? "起飞时间" : "开始时间"}
            type="time"
            required
            value={v.startTime}
            onChange={(s) => set("startTime", s)}
          />
          <Field
            label={stay ? "退房时间" : flight ? "落地时间" : "结束时间（选填）"}
            type="time"
            required={stay || flight}
            value={v.endTime}
            onChange={(s) => set("endTime", s)}
          />
          {!stay && !flight && v.endTime && (
            <Field
              label="结束日期"
              type="date"
              required
              value={v.endDate}
              onChange={(s) => set("endDate", s)}
            />
          )}
        </div>
      )}
      <details className="event-zone-settings">
        <summary>
          {transport ? "出发地与到达地当地时间" : "调整当地时间"}
        </summary>
        <div className="optional-fields">
          <ZoneField
            label={transport ? "出发地当地时间" : "当地时间"}
            value={v.timezone}
            onChange={(s) =>
              onChange({
                ...v,
                timezone: s,
                endTimezone: transport ? v.endTimezone : s,
                firstChoice: "",
                lastChoice: "",
              })
            }
          />
          {transport && (
            <ZoneField
              label="到达地当地时间"
              value={v.endTimezone}
              onChange={(s) => set("endTimezone", s)}
            />
          )}
        </div>
      </details>
      {v.timeMode === "timed" && (
        <>
          <RepeatedTime
            label="开始时间"
            value={`${v.date}T${v.startTime}`}
            zone={v.timezone}
            choice={v.firstChoice}
            onChange={(s) => set("firstChoice", s)}
          />
          {v.endTime && (
            <RepeatedTime
              label="结束时间"
              value={`${v.endDate}T${v.endTime}`}
              zone={v.endTimezone}
              choice={v.lastChoice}
              onChange={(s) => set("lastChoice", s)}
            />
          )}
        </>
      )}
    </div>
  );
}
