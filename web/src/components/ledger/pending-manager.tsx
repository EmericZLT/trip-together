"use client";
import { useState } from "react";
import type { TripData } from "@/lib/models";
import { api } from "@/lib/api";
import { Sheet } from "../ui";
import { Field, CurrencyField } from "../editors/fields";
export function PendingManager({
  data,
  onRefresh,
}: {
  data: TripData;
  onRefresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [title, setTitle] = useState(""),
    [amount, setAmount] = useState(""),
    [currency, setCurrency] = useState<string>(data.trip.currency),
    [note, setNote] = useState(""),
    [doc, setDoc] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <button className="text-action" onClick={() => setOpen(true)}>
        管理待核对预订
      </button>
      {open && (
        <Sheet open title="待核对预订" onClose={() => !busy && setOpen(false)}>
          <form
            className="editor-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                if (amount && !/^\d+(\.\d{1,2})?$/.test(amount))
                  throw new Error("金额最多两位小数");
                await api("/pending-costs", {
                  method: "POST",
                  body: JSON.stringify({
                    title,
                    amount: amount ? Math.round(Number(amount) * 100) : 0,
                    currency,
                    note,
                    document_id: doc || null,
                  }),
                });
                await onRefresh();
                setTitle("");
                setAmount("");
                setNote("");
                setDoc("");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="muted">
              尚未确认付款人或支付情况的预订先保存在这里。确认实际付款人与金额后才计入账本。
            </p>
            <Field
              label="预订名称"
              value={title}
              required
              onChange={setTitle}
            />
            <Field
              label="预订金额（未知可留空）"
              value={amount}
              onChange={setAmount}
            />
            <CurrencyField
              label="预订币种"
              value={currency}
              onChange={setCurrency}
            />
            <Field label="待核对说明" value={note} onChange={setNote} />
            <label>
              关联凭证
              <select value={doc} onChange={(e) => setDoc(e.target.value)}>
                <option value="">无</option>
                {data.documents
                  .filter((d) => !d.owner_id && d.trip_id === data.trip.id)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </label>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            <button className="primary-button" disabled={busy}>
              保存待核对预订
            </button>
          </form>
          <div className="editor-form">
            {data.pendingCosts.map((p) => (
              <PendingRow
                key={p.id}
                title={p.title}
                remove={async () => {
                  await api(`/pending-costs/${p.id}`, { method: "DELETE" });
                  await onRefresh();
                }}
              />
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}
function PendingRow({
  title,
  remove,
}: {
  title: string;
  remove: () => Promise<void>;
}) {
  const [confirm, setConfirm] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="surface editor-form">
      <strong>{title}</strong>
      <button
        className="text-action"
        disabled={busy}
        onClick={async () => {
          if (!confirm) {
            setConfirm(true);
            return;
          }
          setBusy(true);
          try {
            await remove();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {confirm ? "确认删除此预订" : "删除预订"}
      </button>
      {confirm && (
        <button className="text-action" onClick={() => setConfirm(false)}>
          取消
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
