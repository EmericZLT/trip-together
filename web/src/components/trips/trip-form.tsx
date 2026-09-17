"use client";
import { useState } from "react";
import type { Trip } from "@/lib/models";
import { api } from "@/lib/api";
import { Sheet } from "../ui";
import { Field, ZoneField, CurrencyField } from "../editors/fields";
export function TripForm({
  trip,
  onClose,
  onSaved,
}: {
  trip?: Trip;
  onClose: () => void;
  onSaved: (id: string) => Promise<void>;
}) {
  const [v, setV] = useState({
    title: trip?.title ?? "",
    start_date: trip?.start_date ?? new Date().toISOString().slice(0, 10),
    end_date: trip?.end_date ?? new Date().toISOString().slice(0, 10),
    timezone:
      trip?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    home_timezone:
      trip?.home_timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    currency: trip?.currency ?? "CNY",
    home_currency: trip?.home_currency ?? "CNY",
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const change = (key: string, value: string) => setV({ ...v, [key]: value });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ id: string }>(
        trip ? `/trips/${trip.id}` : "/trips",
        {
          method: trip ? "PUT" : "POST",
          body: JSON.stringify({ ...v, version: trip?.version }),
        },
      );
      await onSaved(trip?.id ?? result.id);
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
      title={trip ? "行程设置" : "创建行程"}
      onClose={() => !busy && onClose()}
    >
      <form className="editor-form trip-details-form" onSubmit={save}>
        <Field
          label="行程名称"
          value={v.title}
          required
          maxLength={100}
          onChange={(x) => change("title", x)}
        />
        <fieldset>
          <legend>旅行日期</legend>
          <div className="form-grid">
            <Field
              label="开始日期"
              type="date"
              value={v.start_date}
              required
              onChange={(x) => change("start_date", x)}
            />
            <Field
              label="结束日期"
              type="date"
              value={v.end_date}
              required
              onChange={(x) => change("end_date", x)}
            />
          </div>
        </fieldset>
        <fieldset>
          <legend>目的地</legend>
          <ZoneField
            label="目的地时区"
            value={v.timezone}
            onChange={(x) => change("timezone", x)}
          />
          <CurrencyField
            label="目的地币种"
            value={v.currency}
            onChange={(x) => change("currency", x)}
          />
        </fieldset>
        <fieldset>
          <legend>常用设置</legend>
          <ZoneField
            label="常用时区"
            value={v.home_timezone}
            onChange={(x) => change("home_timezone", x)}
          />
          <CurrencyField
            label="常用币种"
            value={v.home_currency}
            onChange={(x) => change("home_currency", x)}
          />
        </fieldset>
        <p className="muted">
          每个事项可以单独设置出发与到达时区，适用于跨时区旅行。
        </p>
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <button className="primary-button" disabled={busy}>
          {busy ? "正在保存…" : "保存行程"}
        </button>
      </form>
    </Sheet>
  );
}
