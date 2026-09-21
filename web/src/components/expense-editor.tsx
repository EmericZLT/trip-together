"use client";
import { MemberSelect } from "./members/member-select";
import { Avatar } from "./avatar";
import { useState } from "react";
import { LoaderCircle, Check, Trash2 } from "lucide-react";
import type { Expense, TripData, Currency } from "@/lib/models";
import { ReceiptPicker, useReceipts } from "./ledger/receipt-picker";
import { localDate, selectEvents } from "@/lib/time";
import {
  currencyLabel,
  money,
  splitAmount,
  ledgerCurrencies,
  isTransfer,
  transferPayeeId,
  TRANSFER_CATEGORY,
} from "@/lib/money";
import { api } from "@/lib/api";
import { SheetForm, SheetFooter, Sheet } from "./ui";

export type ExpenseDraft = {
  kind?: "expense" | "transfer";
  payerId?: string;
  payeeId?: string;
  amountFen?: number;
};

export function ExpenseEditor({
  expense,
  data,
  onClose,
  onSaved,
  draft,
}: {
  expense: Expense | null;
  data: TripData;
  onClose: () => void;
  onSaved: () => Promise<void>;
  draft?: ExpenseDraft;
}) {
  const editingTransfer = Boolean(expense && isTransfer(expense));
  const creatingTransfer = !expense && draft?.kind === "transfer";
  const [kind, setKind] = useState<"expense" | "transfer">(
    editingTransfer || creatingTransfer ? "transfer" : "expense",
  );
  const [title, setTitle] = useState(
    expense?.title ?? (creatingTransfer ? "转账" : ""),
  );
  const [amount, setAmount] = useState(
    expense
      ? (expense.amount / 100).toFixed(2)
      : draft?.amountFen
        ? (draft.amountFen / 100).toFixed(2)
        : "",
  );
  const [currency, setCurrency] = useState<Currency>(
    expense?.currency ?? (draft?.amountFen ? "CNY" : data.trip.currency),
  );
  const [payerId, setPayerId] = useState(
    expense?.payer_id ?? draft?.payerId ?? data.me.id,
  );
  const defaultPayee =
    (expense && isTransfer(expense) && transferPayeeId(expense)) ||
    draft?.payeeId ||
    data.members.find((member) => member.id !== (expense?.payer_id ?? draft?.payerId ?? data.me.id))
      ?.id ||
    "";
  const [payeeId, setPayeeId] = useState(defaultPayee);
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
    expense && !isTransfer(expense)
      ? expense.participants
      : data.members.map((m) => m.id),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmDelete, setConfirmDelete] = useState(false);
  const [id] = useState(() => crypto.randomUUID());
  const others = data.members.filter((member) => member.id !== payerId);
  function choosePayer(next: string) {
    setPayerId(next);
    if (kind === "transfer" && payeeId === next) {
      setPayeeId(data.members.find((member) => member.id !== next)?.id ?? "");
    }
  }
  function chooseKind(next: "expense" | "transfer") {
    setKind(next);
    setError("");
    if (next === "transfer") {
      if (!title) setTitle("转账");
      if (!payeeId || payeeId === payerId)
        setPayeeId(data.members.find((member) => member.id !== payerId)?.id ?? "");
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
      setError("请填写大于 0 的金额，最多两位小数");
      return;
    }
    if (!payerId) {
      setError(kind === "transfer" ? "请选择转出人" : "请选择实际付款人");
      return;
    }
    if (kind === "transfer") {
      if (!payeeId) {
        setError("请选择一位收款人");
        return;
      }
      if (payeeId === payerId) {
        setError("不能转账给自己");
        return;
      }
    } else if (!participants.length) {
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
          title: title.trim() || (kind === "transfer" ? "转账" : title),
          amount: Math.round(Number(amount) * 100),
          currency,
          payerId,
          receiptIds,
          date,
          participants: kind === "transfer" ? [payeeId] : participants,
          note: expense?.note ?? "",
          category: kind === "transfer" ? TRANSFER_CATEGORY : expense?.category || "其他",
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
  const transfer = kind === "transfer";
  return (
    <Sheet
      open
      onClose={() => !busy && close()}
      title={
        expense
          ? transfer
            ? "编辑转账"
            : "编辑支出"
          : transfer
            ? "新增转账"
            : "新增支出"
      }
      className="expense-sheet"
    >
      <SheetForm className="expense-form" onSubmit={save}>
        <div className="expense-kind-toggle" role="group" aria-label="记录类型">
          <button
            type="button"
            className={!transfer ? "active" : ""}
            aria-pressed={!transfer}
            disabled={busy}
            onClick={() => chooseKind("expense")}
          >
            支出
          </button>
          <button
            type="button"
            className={transfer ? "active" : ""}
            aria-pressed={transfer}
            disabled={busy}
            onClick={() => chooseKind("transfer")}
          >
            转账
          </button>
        </div>
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
          <div className="expense-currency-toggle" role="group" aria-label="币种">
            {ledgerCurrencies.map((c) => (
              <button
                key={c}
                type="button"
                className={c === currency ? "active" : ""}
                aria-pressed={c === currency}
                disabled={busy}
                onClick={() => setCurrency(c)}
              >
                {currencyLabel(c)}
              </button>
            ))}
          </div>
        </div>
        <label>
          {transfer ? "转账说明" : "支出名称"}
          <input
            required
            maxLength={100}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={transfer ? "例如：还现金" : "例如：晚餐"}
          />
        </label>
        <div className="form-columns">
          <div className="member-field">
            <span>{transfer ? "转出人" : "付款人"}</span>
            <MemberSelect
              label={transfer ? "转出人" : "付款人"}
              members={data.members}
              value={payerId}
              onChange={choosePayer}
              disabled={busy}
            />
          </div>
          {transfer ? (
            <div className="member-field">
              <span>收款人</span>
              <MemberSelect
                label="收款人"
                members={others.length ? others : data.members}
                value={payeeId}
                onChange={setPayeeId}
                disabled={busy}
              />
            </div>
          ) : (
            <label>
              支付日期
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          )}
        </div>
        {transfer && (
          <label>
            转账日期
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        )}
        {transfer ? (
          <p className="muted">
            转账不计入支出合计，只冲减双方待结算金额。
          </p>
        ) : (
          <fieldset>
            <legend>
              分摊成员 <span>按人数均分</span>
            </legend>
            <div className="form-actions">
              <button
                type="button"
                className="text-action"
                onClick={() => setParticipants(data.members.map((m) => m.id))}
              >
                全部成员
              </button>
              <button
                type="button"
                className="text-action"
                onClick={() => setParticipants([data.me.id])}
              >
                仅自己
              </button>
            </div>
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
                  {participants.includes(m.id) && Number(amount) > 0 && (
                    <small>
                      {money(
                        splitAmount(
                          Math.round(Number(amount) * 100),
                          participants,
                        )[m.id],
                        currency,
                      )}
                    </small>
                  )}
                  {participants.includes(m.id) && <Check size={15} />}
                </button>
              ))}
            </div>
            <p className="muted">
              {participants.length
                ? `共 ${participants.length} 人分摊，按实际金额平均分配。`
                : "请选择至少一位分摊成员。"}
            </p>
          </fieldset>
        )}
        <ReceiptPicker receipts={receipts} disabled={busy} onError={setError} />
        <SheetFooter>
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
              <>资料上传中…</>
            ) : busy ? (
              <LoaderCircle className="animate-spin" size={18} />
            ) : (
              <>
                <Check size={18} />
                {expense ? "保存修改" : transfer ? "保存转账" : "保存支出"}
              </>
            )}
          </button>
          {expense &&
            (confirmDelete ? (
              <div className="delete-confirm">
                <p>
                  {transfer
                    ? "确定删除这笔转账吗？删除后待结算金额会恢复。"
                    : "确定删除这笔支出吗？删除后无法撤销。"}
                </p>
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
                {transfer ? "删除这笔转账" : "删除这笔支出"}
              </button>
            ))}
        </SheetFooter>
      </SheetForm>
    </Sheet>
  );
}
