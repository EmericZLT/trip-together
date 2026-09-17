"use client";
import { MemberSelect } from "./members/member-select";
import { Avatar } from "./avatar";
import { useState } from "react";
import {
  LoaderCircle,
  Check,
  Trash2,
  DollarSign,
  JapaneseYen,
  ArrowRightLeft,
} from "lucide-react";
import type { Expense, TripData, Currency } from "@/lib/models";
import { ReceiptPicker, useReceipts } from "./ledger/receipt-picker";
import { localDate, selectEvents } from "@/lib/time";
import { currencyLabel } from "@/lib/money";
import { api } from "@/lib/api";
import { Sheet } from "./ui";
export function ExpenseEditor({
  expense,
  data,
  onClose,
  onSaved,
}: {
  expense: Expense | null;
  data: TripData;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(expense?.title ?? "");
  const [amount, setAmount] = useState(
    expense ? (expense.amount / 100).toFixed(2) : "",
  );
  const [currency, setCurrency] = useState<Currency>(
    expense?.currency ?? data.trip.currency,
  );
  const [payerId, setPayerId] = useState(expense?.payer_id ?? data.me.id);
  const receipts = useReceipts(
    data.receipts.filter((r) => r.expense_id === expense?.id),
  );
  function close() {
    onClose();
  }
  const [date, setDate] = useState(
    expense?.date ??
      localDate(
        new Date(),
        selectEvents(data.events, Date.now()).featured?.timezone ??
          data.trip.timezone,
      ),
  );
  const [participants, setParticipants] = useState(
    expense?.participants ?? data.members.map((m) => m.id),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmDelete, setConfirmDelete] = useState(false);
  const [id] = useState(() => crypto.randomUUID());
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
      setError("请填写大于 0 的金额，最多两位小数");
      return;
    }
    if (!payerId) {
      setError("请选择实际付款人");
      return;
    }
    if (!participants.length) {
      setError("至少选择一位分摊成员");
      return;
    }
    setBusy(true);
    try {
      const receiptIds = await receipts.upload();
      await api(`/expenses${expense ? `/${expense.id}` : ""}`, {
        method: expense ? "PUT" : "POST",
        body: JSON.stringify({
          id,
          title,
          amount: Math.round(Number(amount) * 100),
          currency,
          payerId,
          receiptIds,
          date,
          participants,
          note: expense?.note ?? "",
          version: expense?.version,
        }),
      });
      await onSaved();
      close();
    } catch (error) {
      setError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!expense) return;
    setBusy(true);
    setError("");
    try {
      await api(`/expenses/${expense.id}`, {
        method: "DELETE",
        body: JSON.stringify({ version: expense.version }),
      });
      await onSaved();
      close();
    } catch (error) {
      setError(error instanceof Error ? error.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      open
      onClose={() => !busy && close()}
      title={expense ? "编辑支出" : "新增支出"}
      className="expense-sheet"
    >
      <form className="expense-form" onSubmit={save}>
        <div className="amount-entry">
          <label>
            金额
            <input
              required
              aria-label="金额"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </label>
          <button
            type="button"
            className="expense-currency"
            disabled={busy || data.trip.home_currency === data.trip.currency}
            aria-label={`当前${currencyLabel(currency)}，切换币种`}
            title={`${currency} · 点击切换币种`}
            onClick={() =>
              setCurrency(
                currency === data.trip.home_currency
                  ? data.trip.currency
                  : data.trip.home_currency,
              )
            }
          >
            <span style={{ fontSize: 14 }}>{currency}</span>
            <ArrowRightLeft
              className="currency-switch-icon"
              size={11}
              aria-hidden="true"
            />
          </button>
        </div>
        <label>
          支出名称
          <input
            required
            maxLength={100}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：晚餐"
          />
        </label>
        <div className="form-columns">
          <div className="member-field">
            <span>付款人</span>
            <MemberSelect
              label="付款人"
              members={data.members}
              value={payerId}
              onChange={setPayerId}
              disabled={busy}
            />
          </div>
          <label>
            支付日期
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        <fieldset>
          <legend>
            分摊成员 <span>按人数均分</span>
          </legend>
          <div className="participant-grid">
            {data.members.map((m) => (
              <button
                type="button"
                className={`participant ${participants.includes(m.id) ? "checked" : ""}`}
                key={m.id}
                aria-label={m.name}
                aria-pressed={participants.includes(m.id)}
                onClick={() =>
                  setParticipants((p) =>
                    p.includes(m.id)
                      ? p.filter((id) => id !== m.id)
                      : [...p, m.id],
                  )
                }
              >
                <Avatar member={m} />
                <span>{m.name}</span>
                {participants.includes(m.id) && <Check size={15} />}
              </button>
            ))}
          </div>
        </fieldset>
        <ReceiptPicker receipts={receipts} disabled={busy} onError={setError} />
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        <button
          className="primary-button w-full"
          disabled={busy || receipts.uploading}
        >
          {receipts.uploading ? (
            <>凭证上传中…</>
          ) : busy ? (
            <LoaderCircle className="animate-spin" size={18} />
          ) : (
            <>
              <Check size={18} />
              {expense ? "保存修改" : "保存支出"}
            </>
          )}
        </button>
        {expense &&
          (confirmDelete ? (
            <div className="delete-confirm">
              <p>确定删除这笔支出吗？删除后无法撤销。</p>
              <button type="button" disabled={busy} onClick={remove}>
                确认删除
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)}>
                取消
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="danger-button"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={16} />
              删除这笔支出
            </button>
          ))}
      </form>
    </Sheet>
  );
}
