"use client";
import { useState } from "react";
import type { TripData, TripEvent, TripDocument } from "@/lib/models";
import { api } from "@/lib/api";
import { localInput, zonedChoices } from "@/lib/zoned-input";
import { localDate } from "@/lib/time";
import { SheetForm, SheetFooter, Sheet, EventIcon } from "../ui";
import { Field } from "./fields";
import {
  EventTimeFields,
  resolveLocal,
  type Timing,
} from "./event-time-fields";
import { DocumentChoices } from "./document-choices";
import { DocumentUpload } from "../files/document-manager";
const kinds = {
  explore: "活动",
  flight: "航班",
  stay: "住宿",
  drive: "自驾",
  transfer: "交通",
} as const;
export function EventEditor({
  event,
  data,
  initialDate,
  onClose,
  onSaved,
}: {
  event?: TripEvent;
  data: TripData;
  initialDate?: string;
  onClose: () => void;
  onSaved: (date?: string) => Promise<void>;
}) {
  const [step, setStep] = useState(event ? 2 : 1);
  const zone = event?.timezone ?? data.trip.timezone;
  const day = initialDate ?? data.trip.start_date;
  const [v, setV] = useState({
    title: event?.title ?? "",
    subtitle: event?.subtitle ?? "",
    kind: event?.kind ?? "explore",
    certainty: event?.certainty ?? "suggested",
    place: event?.place ?? "",
    address: event?.address ?? "",
    phone: event?.phone ?? "",
    note: event?.note ?? "",
    from: event?.from ?? "",
    to: event?.to ?? "",
    code: event?.code ?? "",
  });
  const [timing, setTiming] = useState<Timing>({
    date: event ? localDate(event.start, zone) : day,
    endDate: event
      ? (event.dateEnd ?? localDate(event.end, event.endTimezone ?? zone))
      : day,
    startTime:
      event && event.timeMode !== "date"
        ? localInput(event.start, zone).slice(11)
        : "",
    endTime:
      event && event.timeMode !== "date" && !event.endUnspecified
        ? localInput(event.end, event.endTimezone ?? zone).slice(11)
        : "",
    timezone: zone,
    endTimezone: event?.endTimezone ?? zone,
    timeMode: event?.timeMode ?? (event ? "timed" : "date"),
    firstChoice: event
      ? String(
          zonedChoices(localInput(event.start, zone), zone).findIndex(
            (x) => Date.parse(x) === Date.parse(event.start),
          ),
        )
      : "",
    lastChoice: event
      ? String(
          zonedChoices(
            localInput(event.end, event.endTimezone ?? zone),
            event.endTimezone ?? zone,
          ).findIndex((x) => Date.parse(x) === Date.parse(event.end)),
        )
      : "",
  });
  const [documents, setDocuments] = useState(event?.documents ?? []),
    [uploaded, setUploaded] = useState<TripDocument[]>([]),
    [uploading, setUploading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const change = (key: string, value: string) => setV({ ...v, [key]: value });
  const transport = ["flight", "drive", "transfer"].includes(v.kind),
    stay = v.kind === "stay";
  const suggested = transport && v.from && v.to ? `${v.from} → ${v.to}` : "";
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
      return;
    }
    setError("");
    setBusy(true);
    try {
      const start = resolveLocal(
        `${timing.date}T${timing.timeMode === "date" ? "00:00" : timing.startTime}`,
        timing.timezone,
        timing.firstChoice,
      );
      const endUnspecified = timing.timeMode === "timed" && !timing.endTime;
      let end: string;
      if (timing.timeMode === "date") {
        const endDay =
          stay || v.kind === "flight" ? timing.endDate : timing.date;
        const date = new Date(`${endDay}T12:00:00Z`);
        if (!stay) date.setUTCDate(date.getUTCDate() + 1);
        end = resolveLocal(
          `${date.toISOString().slice(0, 10)}T00:00`,
          timing.endTimezone,
          "0",
        );
      } else
        end = endUnspecified
          ? new Date(Date.parse(start) + 1).toISOString()
          : resolveLocal(
              `${timing.endDate}T${timing.endTime}`,
              timing.endTimezone,
              timing.lastChoice,
            );
      if (Date.parse(end) <= Date.parse(start))
        throw new Error(
          stay
            ? "退房日期或时间需要晚于入住"
            : "结束时间需要晚于开始，请检查日期与当地时间",
        );
      await api(`/events${event ? `/${event.id}` : ""}`, {
        method: event ? "PUT" : "POST",
        body: JSON.stringify({
          ...v,
          from: transport ? v.from : "",
          to: transport ? v.to : "",
          code: transport || stay ? v.code : "",
          phone: stay ? v.phone : "",
          title: v.title.trim() || suggested,
          place: stay ? v.title : v.place,
          start,
          end,
          timeMode: timing.timeMode,
          dateEnd: timing.endDate,
          endUnspecified,
          timezone: timing.timezone,
          endTimezone: timing.endTimezone,
          source: event?.source || "手动添加",
          documents,
          version: event?.version,
        }),
      });
      await onSaved(timing.date);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const docs = [
    ...data.documents.filter((d) => d.trip_id === data.trip.id),
    ...uploaded,
  ].filter((d, i, all) => all.findIndex((x) => x.id === d.id) === i);
  return (
    <Sheet
      open
      title={event ? "修改事项" : "添加事项"}
      className={
        step === 2 ? "event-entry-sheet compact-event" : "event-entry-sheet"
      }
      onClose={() => !busy && onClose()}
    >
      <SheetForm className="editor-form" onSubmit={save}>
        <p className="entry-step" aria-live="polite">
          {step === 1
            ? "1 / 2 · 选择事项类型"
            : `2 / 2 · 填写${kinds[v.kind]}信息`}
        </p>
        {step === 1 ? (
          <>
            <div
              className="event-type-picker"
              role="group"
              aria-label="事项类型"
            >
              {Object.entries(kinds).map(([kind, name]) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={v.kind === kind}
                  onClick={() => change("kind", kind)}
                >
                  <EventIcon kind={kind as TripEvent["kind"]} size={21} />
                  {name}
                </button>
              ))}
            </div>
            <SheetFooter>
              {" "}
              <button
                type="button"
                className="primary-button"
                onClick={() => setStep(2)}
              >
                下一步
              </button>
            </SheetFooter>
          </>
        ) : (
          <>
            {transport && (
              <div className="form-grid event-route-fields">
                <Field
                  label="出发地"
                  value={v.from}
                  required
                  onChange={(s) => change("from", s)}
                />
                <Field
                  label="目的地"
                  value={v.to}
                  required
                  onChange={(s) => change("to", s)}
                />
              </div>
            )}
            <Field
              label={
                stay ? "酒店名称" : transport ? "事项名称（选填）" : "活动名称"
              }
              value={v.title}
              required={!transport}
              maxLength={150}
              placeholder={suggested || undefined}
              onChange={(s) => change("title", s)}
            />
            <EventTimeFields v={timing} kind={v.kind} onChange={setTiming} />
            <div className="event-option-grid">
              <details className="optional-details event-more">
                <summary>更多信息（选填）</summary>
                <div className="optional-fields">
                  {!stay && !transport && (
                    <Field
                      label="地点"
                      value={v.place}
                      onChange={(s) => change("place", s)}
                    />
                  )}
                  <Field
                    label="详细地址"
                    value={v.address}
                    onChange={(s) => change("address", s)}
                  />
                  {(stay || transport) && (
                    <Field
                      label={v.kind === "flight" ? "航班号" : "预订编号"}
                      value={v.code}
                      onChange={(s) => change("code", s)}
                    />
                  )}
                  {stay && (
                    <Field
                      label="酒店电话"
                      type="tel"
                      value={v.phone}
                      onChange={(s) => change("phone", s)}
                    />
                  )}
                  <label>
                    说明
                    <textarea
                      aria-label="说明"
                      value={v.note}
                      maxLength={3000}
                      onChange={(e) => change("note", e.target.value)}
                    />
                  </label>
                  <label className="inline-check">
                    <input
                      type="checkbox"
                      checked={v.certainty === "confirmed"}
                      onChange={(e) =>
                        change(
                          "certainty",
                          e.target.checked ? "confirmed" : "suggested",
                        )
                      }
                    />
                    安排已确认
                  </label>
                </div>
              </details>
              <div className="attachment-entry">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setUploading(true)}
                >
                  ＋{" "}
                  {stay
                    ? "添加住宿订单"
                    : v.kind === "flight"
                      ? "添加机票"
                      : "添加图片或文件"}
                </button>
              </div>
            </div>
            {docs.length > 0 && (
              <section
                className="event-document-section"
                aria-label="关联资料选择"
              >
                <h3>
                  关联资料{" "}
                  <small>
                    {documents.length
                      ? `已选 ${documents.length} 份`
                      : "点击图片选择"}
                  </small>
                </h3>
                <DocumentChoices
                  documents={docs}
                  selected={documents}
                  onChange={setDocuments}
                />
              </section>
            )}
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            <SheetFooter className="entry-step-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => {
                  setStep(1);
                  setError("");
                }}
              >
                上一步
              </button>
              <button className="primary-button" disabled={busy}>
                {busy
                  ? "正在保存…"
                  : event
                    ? "保存修改"
                    : `添加${kinds[v.kind]}`}
              </button>
            </SheetFooter>
          </>
        )}
      </SheetForm>
      {uploading && (
        <DocumentUpload
          categories={docs.map((d) => d.category)}
          category={stay ? "住宿" : transport ? "交通" : "行程"}
          onClose={() => setUploading(false)}
          onUploaded={(docs) => {
            setUploaded((prev) => [...prev, ...docs]);
            setDocuments((prev) => [
              ...new Set([...prev, ...docs.map((d) => d.id)]),
            ]);
          }}
          onSaved={async () => {}}
        />
      )}
    </Sheet>
  );
}
