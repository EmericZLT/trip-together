"use client";
import { useState } from "react";
import {
  Plus,
  ArrowUpRight,
  MapPin,
  Phone,
  Clock3,
  CalendarDays,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import type { TripData, TripDocument, TripEvent } from "@/lib/models";
import { localDate, dateLabel, clockTime, zoneName } from "@/lib/time";
import { TravelSticker } from "../travel-sticker";
import { EventIcon, Sheet, SectionTitle } from "../ui";
import { PreparationChecklist } from "../preparation/checklist";
import { EventEditor } from "../editors/event-editor";
import { api } from "@/lib/api";
import { DocumentRow } from "./documents";
export function Itinerary({
  data,
  onRefresh,
  now,
  onEvent,
  onPreview,
}: {
  data: TripData;
  onRefresh: () => Promise<void>;
  now: number;
  onEvent: (e: TripEvent) => void;
  onPreview: (date: number) => void;
}) {
  const { events } = data;
  const [editing, setEditing] = useState(false);
  const days = [...new Set(events.map((e) => localDate(e.start, e.timezone)))];
  const [selected, setSelected] = useState(
    now < Date.parse(events[0]?.start ?? data.trip.start_date)
      ? "preparation"
      : days.includes(localDate(now, data.trip.timezone))
        ? localDate(now, data.trip.timezone)
        : (days[0] ?? "preparation"),
  );
  const filtered = events.filter(
    (e) => localDate(e.start, e.timezone) === selected,
  );
  return (
    <section className="page-content">
      <div className="page-title">
        <div className="page-heading-row">
          <h1>完整行程</h1>
          <button
            className="icon-button page-add-button"
            aria-label="添加事项"
            onClick={() => setEditing(true)}
          >
            <Plus size={23} />
          </button>
        </div>
        <p className="muted">
          {data.trip.start_date} — {data.trip.end_date} · 完整行程
        </p>
      </div>
      {editing && (
        <EventEditor
          data={data}
          onClose={() => setEditing(false)}
          onSaved={onRefresh}
        />
      )}
      <div className="day-picker" aria-label="选择行程日期">
        <button
          className={`day-chip ${selected === "preparation" ? "selected" : ""}`}
          aria-pressed={selected === "preparation"}
          onClick={() => setSelected("preparation")}
        >
          <small>准备清单</small>
          <strong>出发前</strong>
          <span>随时查看</span>
        </button>
        {days.map((day, i) => (
          <button
            key={day}
            onClick={() => setSelected(day)}
            aria-pressed={selected === day}
            className={`day-chip ${selected === day ? "selected" : ""}`}
          >
            <small>第 {i + 1} 天</small>
            <strong>{day.slice(5).replace("-", ".")}</strong>
            <span>
              {new Intl.DateTimeFormat("zh-CN", {
                weekday: "short",
                timeZone: "UTC",
              }).format(new Date(day))}
            </span>
          </button>
        ))}
      </div>
      {selected === "preparation" ? (
        <PreparationChecklist
          items={data.preparation}
          checked={data.packing}
          onRefresh={onRefresh}
        />
      ) : (
        <>
          <div className="section-heading">
            <h2>{filtered[0]?.place}</h2>
            <span className="list-caption">{filtered.length} 项安排</span>
          </div>
          <div className="timeline">
            {filtered.map((e) => (
              <button
                key={e.id}
                className="timeline-event"
                onClick={() => onEvent(e)}
              >
                <div className="timeline-time">
                  <strong>{clockTime(e.start, e.timezone)}</strong>
                  <span>{e.certainty === "suggested" ? "建议" : "已确认"}</span>
                </div>
                <div className={`timeline-icon ${e.kind}`}>
                  <TravelSticker kind={e.kind} />
                </div>
                <div className="timeline-card">
                  <small>
                    {zoneName(e.timezone)}
                    {e.code ? ` · ${e.code}` : ""}
                  </small>
                  <h3>{e.title}</h3>
                  <p>{e.subtitle}</p>
                  <span className="timeline-link">
                    查看详情与凭证
                    <ArrowUpRight size={15} />
                  </span>
                </div>
              </button>
            ))}
          </div>
          {filtered.length > 0 && (
            <button
              className="secondary-button w-full"
              onClick={() => onPreview(Date.parse(filtered[0].start) + 60000)}
            >
              <Clock3 size={17} />
              预览这一天的首页
            </button>
          )}
          <p className="preview-hint">
            预览仅改变显示时间，随时可以返回实时行程。
          </p>
        </>
      )}
    </section>
  );
}
export function EventDetail({
  event,
  data,
  onClose,
  onDocument,
  onEdit,
  onDelete,
}: {
  event: TripEvent | null;
  data: TripData;
  onClose: () => void;
  onDocument: (d: TripDocument) => void;
  onEdit: (e: TripEvent) => void;
  onDelete: (e: TripEvent) => void;
}) {
  if (!event) return null;
  const docs = data.documents.filter((d) => event.documents.includes(d.id));
  return (
    <Sheet
      open
      onClose={onClose}
      title={event.title}
      description={event.subtitle}
    >
      <div className="event-detail">
        <span className="detail-kind">
          <EventIcon kind={event.kind} />
          {event.certainty === "confirmed"
            ? "凭证已确认"
            : "建议安排 · 时间待确认"}
        </span>
        {event.from && (
          <div className="flight-route">
            <div>
              <strong>{event.from}</strong>
              <span>{clockTime(event.start, event.timezone)}</span>
            </div>
            <div className="flight-line">
              <span>{event.code}</span>
              <ArrowRight size={24} />
            </div>
            <div>
              <strong>{event.to}</strong>
              <span>
                {clockTime(event.end, event.endTimezone ?? event.timezone)}
              </span>
            </div>
          </div>
        )}
        <div className="detail-row">
          <CalendarDays size={19} />
          <span>
            {dateLabel(event.start, event.timezone)}
            <small>
              {clockTime(event.start, event.timezone)} ·{" "}
              {zoneName(event.timezone)}
              {event.certainty === "suggested" ? "（建议时段）" : ""}
            </small>
          </span>
        </div>
        {event.kind === "flight" && (
          <div className="detail-row">
            <Clock3 size={19} />
            <span>
              抵达：{dateLabel(event.end, event.endTimezone ?? event.timezone)}
              <small>
                {clockTime(event.end, event.endTimezone ?? event.timezone)} ·{" "}
                {zoneName(event.endTimezone ?? event.timezone)}
              </small>
            </span>
          </div>
        )}
        <div className="detail-row">
          <MapPin size={19} />
          <span>
            {event.place}
            <small>{event.address}</small>
          </span>
        </div>
        {event.address && (
          <a
            className="secondary-button w-full"
            target="_blank"
            rel="noreferrer"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`}
          >
            地图导航
            <ArrowUpRight size={16} />
          </a>
        )}
        {event.phone && (
          <a className="detail-row text-action" href={`tel:${event.phone}`}>
            <Phone size={18} />
            {event.phone}
          </a>
        )}
        {event.note && (
          <div className="detail-note">
            <AlertCircle size={18} />
            <p>{event.note}</p>
          </div>
        )}
        <SectionTitle>相关凭证</SectionTitle>
        {docs.length ? (
          <div className="surface divided">
            {docs.map((d) => (
              <DocumentRow key={d.id} doc={d} onOpen={onDocument} />
            ))}
          </div>
        ) : (
          <div className="surface empty-state">
            <h3>尚未关联凭证</h3>
            <p>上传旅行资料后，可以在修改事项时关联。</p>
            <button className="text-action" onClick={() => onEdit(event)}>
              关联凭证
            </button>
          </div>
        )}
        <p className="source-note">资料来源：{event.source || "尚未填写"}</p>
        <div className="form-actions">
          <button className="secondary-button" onClick={() => onEdit(event)}>
            修改事项
          </button>
          <button className="secondary-button" onClick={() => onDelete(event)}>
            删除事项
          </button>
        </div>
      </div>
    </Sheet>
  );
}
