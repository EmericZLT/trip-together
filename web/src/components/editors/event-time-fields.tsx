"use client";
import { useId } from "react";
import { ConfigProvider, Select, Switch, TimePicker } from "antd";
import zhCN from "antd/locale/zh_CN";
import dayjs from "dayjs";
import { Field } from "./fields";
import { zonedChoices } from "@/lib/zoned-input";
import { destinations, readableZone } from "../../../../shared/travel-options";
import type { Timing } from "./event/timing";
export { resolveLocal, type Timing } from "./event/timing";
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
    <div className="time-control">
      <span>{label}在当地出现两次</span>
      <Select
        aria-label={`${label}出现次数`}
        value={choice || undefined}
        placeholder="请选择"
        onChange={onChange}
        options={[
          { value: "0", label: "第一次（时钟回拨前）" },
          { value: "1", label: "第二次（时钟回拨后）" },
        ]}
      />
    </div>
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
  const id = useId();
  const stay = kind === "stay",
    flight = kind === "flight";
  const zones = [
    ...new Set([
      v.timezone,
      v.endTimezone,
      ...destinations.map((d) => d.timezone),
      "UTC",
      ...Intl.supportedValuesOf("timeZone"),
    ]),
  ].map((value) => ({ value, label: readableZone(value) }));
  function set(key: keyof Timing, value: string | boolean) {
    onChange({
      ...v,
      [key]: value,
      ...(["date", "startTime", "timezone"].includes(key)
        ? { firstChoice: "" }
        : {}),
      ...(["endDate", "endTime", "endTimezone"].includes(key)
        ? { lastChoice: "" }
        : {}),
      ...(key === "startTime" ? { timeMode: value ? "timed" : "date" } : {}),
    });
  }
  const row = (end: boolean) => {
    const label = end
      ? stay
        ? "退房时间"
        : flight
          ? "落地时间"
          : "结束时间"
      : stay
        ? "入住时间"
        : flight
          ? "起飞时间"
          : "开始时间";
    const time = end ? v.endTime : v.startTime;
    const zoneLabel = end ? "到达地当地时间" : "当地时间";
    return (
      <div className="time-controls">
        <div className="time-control">
          <label htmlFor={`${id}-${end}`}>{label}</label>
          <TimePicker
            id={`${id}-${end}`}
            aria-label={label}
            format="HH:mm"
            inputReadOnly
            minuteStep={1}
            needConfirm={false}
            showNow={false}
            placeholder="时间待定"
            value={time ? dayjs(`2000-01-01T${time}:00`) : null}
            onChange={(value) =>
              set(end ? "endTime" : "startTime", value?.format("HH:mm") ?? "")
            }
          />
        </div>
        <div className="time-control">
          <label htmlFor={`${id}-zone-${end}`}>{zoneLabel}</label>
          <Select
            id={`${id}-zone-${end}`}
            aria-label={zoneLabel}
            showSearch={false}
            value={end ? v.endTimezone : v.timezone}
            options={zones}
            onChange={(zone) =>
              onChange({
                ...v,
                ...(end
                  ? { endTimezone: zone, lastChoice: "" }
                  : {
                      timezone: zone,
                      firstChoice: "",
                      ...(v.endTimezone === v.timezone
                        ? { endTimezone: zone, lastChoice: "" }
                        : {}),
                    }),
              })
            }
          />
        </div>
      </div>
    );
  };
  return (
    <ConfigProvider
      locale={zhCN}
      getPopupContainer={(trigger) =>
        trigger?.closest<HTMLElement>(".sheet") ?? document.body
      }
      theme={{
        token: {
          colorPrimary: "#9685b0",
          motion: false,
          borderRadius: 12,
          controlHeight: 44,
          fontSize: 15,
          fontFamily: "inherit",
        },
      }}
    >
      <div className="event-timing">
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
        {row(false)}
        <div className="time-range-toggle">
          <span id={`${id}-range`}>时间段</span>
          <Switch
            aria-labelledby={`${id}-range`}
            checked={v.range}
            onChange={(checked) => set("range", checked)}
          />
        </div>
        {v.range && (
          <div className="time-range-end">
            <Field
              label={stay ? "退房日期" : flight ? "落地日期" : "结束日期"}
              type="date"
              required
              value={v.endDate}
              onChange={(date) => set("endDate", date)}
            />
            {row(true)}
          </div>
        )}
        <p className="muted time-help">
          不选择时间时，仅记录日期，显示为时间待定。
        </p>
        {v.timeMode === "timed" && (
          <>
            <RepeatedTime
              label="开始时间"
              value={`${v.date}T${v.startTime}`}
              zone={v.timezone}
              choice={v.firstChoice}
              onChange={(s) => set("firstChoice", s)}
            />
            {v.range && (
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
    </ConfigProvider>
  );
}
