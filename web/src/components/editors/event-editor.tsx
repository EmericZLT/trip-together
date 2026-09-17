"use client";
import { useState } from "react";
import type { TripData, TripEvent } from "@/lib/models";
import { api } from "@/lib/api";
import { localInput, zonedInstant } from "@/lib/zoned-input";
import { Sheet } from "../ui";
import { Field, ZoneField } from "./fields";
export function EventEditor({
  event,
  data,
  onClose,
  onSaved,
}: {
  event?: TripEvent;
  data: TripData;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const initialZone = event?.timezone ?? data.trip.timezone;
  const [v, setV] = useState({
    title: event?.title ?? "",
    subtitle: event?.subtitle ?? "",
    kind: event?.kind ?? "explore",
    start: event
      ? localInput(event.start, initialZone)
      : `${data.trip.start_date}T09:00`,
    end: event
      ? localInput(event.end, event.endTimezone ?? initialZone)
      : `${data.trip.start_date}T10:00`,
    timezone: initialZone,
    endTimezone: event?.endTimezone ?? initialZone,
    certainty: event?.certainty ?? "suggested",
    place: event?.place ?? "",
    address: event?.address ?? "",
    phone: event?.phone ?? "",
    source: event?.source ?? "",
    note: event?.note ?? "",
    from: event?.from ?? "",
    to: event?.to ?? "",
    code: event?.code ?? "",
    startOffset: "",
    endOffset: "",
  });
  const [documents, setDocuments] = useState(event?.documents ?? []),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const change = (key: string, value: string) => setV({ ...v, [key]: value });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/events${event ? `/${event.id}` : ""}`, {
        method: event ? "PUT" : "POST",
        body: JSON.stringify({
          ...v,
          start: zonedInstant(v.start, v.timezone, v.startOffset),
          end: zonedInstant(v.end, v.endTimezone, v.endOffset),
          documents,
          version: event?.version,
        }),
      });
      await onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      open
      title={event ? "修改事项" : "添加事项"}
      onClose={() => !busy && onClose()}
    >
      <form className="editor-form" onSubmit={save}>
        <Field
          label="事项名称"
          value={v.title}
          required
          maxLength={150}
          onChange={(x) => change("title", x)}
        />
        <Field
          label="简要说明"
          value={v.subtitle}
          maxLength={250}
          onChange={(x) => change("subtitle", x)}
        />
        <div className="form-grid">
          <label>
            事项类型
            <select
              aria-label="事项类型"
              value={v.kind}
              onChange={(e) => change("kind", e.target.value)}
            >
              {Object.entries({
                flight: "航班",
                drive: "自驾",
                stay: "住宿",
                explore: "活动",
                transfer: "接驳 / 转机",
              }).map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </select>
          </label>
          <label>
            确认状态
            <select
              aria-label="确认状态"
              value={v.certainty}
              onChange={(e) => change("certainty", e.target.value)}
            >
              <option value="suggested">待确认 / 建议</option>
              <option value="confirmed">已确认</option>
            </select>
          </label>
        </div>
        <ZoneField
          label="开始地点时区"
          value={v.timezone}
          onChange={(x) => change("timezone", x)}
        />
        <Field
          label="开始当地时间"
          type="datetime-local"
          required
          value={v.start}
          onChange={(x) => change("start", x)}
        />
        <ZoneField
          label="结束地点时区"
          value={v.endTimezone}
          onChange={(x) => change("endTimezone", x)}
        />
        <Field
          label="结束当地时间"
          type="datetime-local"
          required
          value={v.end}
          onChange={(x) => change("end", x)}
        />
        <details>
          <summary>夏令时重复时间设置</summary>
          <p className="muted">
            仅当地时间因夏令时回拨出现两次时填写，例如 +12:00。
          </p>
          <Field
            label="开始 UTC 偏移"
            value={v.startOffset}
            onChange={(x) => change("startOffset", x)}
          />
          <Field
            label="结束 UTC 偏移"
            value={v.endOffset}
            onChange={(x) => change("endOffset", x)}
          />
        </details>
        <div className="form-grid">
          <Field
            label="起点"
            value={v.from}
            onChange={(x) => change("from", x)}
          />
          <Field label="终点" value={v.to} onChange={(x) => change("to", x)} />
        </div>
        <Field
          label="航班号 / 预订编号"
          value={v.code}
          onChange={(x) => change("code", x)}
        />
        <Field
          label="地点"
          value={v.place}
          onChange={(x) => change("place", x)}
        />
        <Field
          label="详细地址"
          value={v.address}
          onChange={(x) => change("address", x)}
        />
        <Field
          label="联系电话"
          type="tel"
          value={v.phone}
          onChange={(x) => change("phone", x)}
        />
        <Field
          label="资料来源"
          value={v.source}
          onChange={(x) => change("source", x)}
        />
        <label>
          事项提醒
          <textarea
            value={v.note}
            maxLength={3000}
            onChange={(e) => change("note", e.target.value)}
          />
        </label>
        <fieldset>
          <legend>关联资料</legend>
          {data.documents
            .filter((d) => d.trip_id === data.trip.id)
            .map((d) => (
              <label className="inline-check" key={d.id}>
                <input
                  type="checkbox"
                  checked={documents.includes(d.id)}
                  onChange={(e) =>
                    setDocuments(
                      e.target.checked
                        ? [...documents, d.id]
                        : documents.filter((id) => id !== d.id),
                    )
                  }
                />
                {d.name}
              </label>
            ))}
          <small>共享文件供同行成员查看，本人专属文件仅本人可以查看。</small>
        </fieldset>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <button className="primary-button sticky-save" disabled={busy}>
          {busy ? "正在保存…" : "保存事项"}
        </button>
      </form>
    </Sheet>
  );
}
