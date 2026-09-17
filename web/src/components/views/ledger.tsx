"use client";
import { MemberSelect } from "../members/member-select";
import { Avatar } from "../avatar";
import { useMemo, useState } from "react";
import {
  Plus,
  ArrowDownToLine,
  ArrowUpRight,
  ChevronRight,
  ReceiptText,
  Info,
} from "lucide-react";
import type {
  Currency,
  Expense,
  TripData,
  TripDocument,
  PendingCost,
} from "@/lib/models";
import { money, summarize, currencyLabel } from "@/lib/money";
import { SectionTitle } from "../ui";
import { ExpenseDetail } from "../ledger/expense-detail";
import { PendingManager } from "../ledger/pending-manager";
import { ExpenseEditor } from "../expense-editor";
export function Ledger({
  data,
  onRefresh,
  onDocument,
}: {
  data: TripData;
  onRefresh: () => Promise<void>;
  onDocument: (d: TripDocument) => void;
}) {
  const [currency, setCurrency] = useState<Currency>(data.trip.home_currency),
    [payer, setPayer] = useState("all"),
    [view, setView] = useState<"records" | "members">("records");
  const [editor, setEditor] = useState<Expense | null | undefined>(undefined),
    [detail, setDetail] = useState<Expense | null>(null);
  const [pending, setPending] = useState<PendingCost | null>(null);
  const totals = useMemo(
    () => summarize(data.expenses, data.members, currency),
    [data, currency],
  );
  const records = data.expenses.filter(
    (e) => e.currency === currency && (payer === "all" || e.payer_id === payer),
  );
  const mine = totals.rows.find((m) => m.id === data.me.id)!;
  function exportCsv() {
    const cell = (value: unknown) =>
      `"${String(value)
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""')}"`;
    const rows = [
      ["日期", "支出", "付款人", "金额", "币种", "分类", "分摊成员", "备注"],
      ...data.expenses.map((e) => [
        e.date,
        e.title,
        data.members.find((m) => m.id === e.payer_id)?.name,
        (e.amount / 100).toFixed(2),
        e.currency,
        e.category,
        e.participants
          .map((id) => data.members.find((m) => m.id === id)?.name)
          .join("、"),
        e.note,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${data.trip.title}-账本.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="page-content">
      <div className="page-title title-with-action">
        <div>
          <h1>旅行账本</h1>
          <p className="muted">记录支出，查看明细和个人分摊。</p>
        </div>
        <button
          className="icon-button"
          aria-label="导出账本"
          onClick={exportCsv}
        >
          <ArrowDownToLine size={20} />
        </button>
      </div>
      <PendingManager data={data} onRefresh={onRefresh} />
      <div className="ledger-summary">
        <div className="summary-top">
          <span>已记录支出</span>
          <div className="currency-toggle">
            {[
              ...new Set([
                data.trip.home_currency,
                data.trip.currency,
                ...data.expenses.map((e) => e.currency),
              ]),
            ].map((c) => (
              <button
                key={c}
                aria-pressed={currency === c}
                className={c === currency ? "active" : ""}
                onClick={() => setCurrency(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="total-amount">{money(totals.total, currency)}</div>
        <p>
          {data.expenses.filter((e) => e.currency === currency).length} 笔记录 ·{" "}
          {currencyLabel(currency)}
        </p>
        <div className="my-summary">
          <div>
            <span>我已支付</span>
            <strong>{money(mine.paid, currency)}</strong>
          </div>
          <div>
            <span>我应分摊</span>
            <strong>{money(mine.share, currency)}</strong>
          </div>
          <div>
            <span>{mine.balance >= 0 ? "待收回" : "待承担"}</span>
            <strong>{money(Math.abs(mine.balance), currency)}</strong>
          </div>
        </div>
      </div>
      <button
        className="primary-button w-full add-expense"
        onClick={() => {
          setPending(null);
          setEditor(null);
        }}
      >
        <Plus size={20} />
        新增支出
      </button>
      <div className="segment-control">
        {(
          [
            ["records", "逐笔记录"],
            ["members", "按人统计"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={view === id ? "active" : ""}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "records" ? (
        <>
          <div className="filter-row">
            <span>付款人</span>
            <MemberSelect
              members={data.members}
              value={payer}
              onChange={setPayer}
              label="按付款人筛选"
              all
            />
          </div>
          <div className="surface divided">
            {records.map((e) => (
              <button
                key={e.id}
                onClick={() => setDetail(e)}
                className="expense-row"
              >
                <Avatar
                  member={data.members.find((m) => m.id === e.payer_id)}
                  className="expense-avatar"
                />
                <div>
                  <strong>{e.title}</strong>
                  <small>
                    {data.members.find((m) => m.id === e.payer_id)?.name} ·{" "}
                    {e.date.slice(5).replace("-", ".")}
                  </small>
                </div>
                <span className="expense-amount">
                  {money(e.amount, e.currency)}
                  <ChevronRight size={14} />
                </span>
              </button>
            ))}
          </div>
          {!records.length && (
            <div className="empty-state">
              <ReceiptText size={30} />
              <h3>暂无支出记录</h3>
              <p>点击“新增支出”添加记录。</p>
            </div>
          )}
          <p className="list-caption">
            当前筛选合计{" "}
            {money(
              records.reduce((s, e) => s + e.amount, 0),
              currency,
            )}
          </p>
        </>
      ) : (
        <div className="surface divided member-statistics">
          {totals.rows.map((m) => (
            <div className="member-balance" key={m.id}>
              <div className="balance-name">
                <Avatar member={m} className="expense-avatar" />
                <strong>
                  {m.name}
                  {m.id === data.me.id && <small> 我</small>}
                </strong>
                <span className={m.balance >= 0 ? "positive" : "muted"}>
                  {m.balance >= 0 ? "待收回" : "待承担"}{" "}
                  {money(Math.abs(m.balance), currency)}
                </span>
              </div>
              <div className="balance-values">
                <span>支付 {money(m.paid, currency)}</span>
                <span>分摊 {money(m.share, currency)}</span>
              </div>
              <div className="balance-track">
                <span
                  style={{
                    width: `${totals.total ? (m.paid / totals.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="ledger-hint">
        <Info size={15} />
        不同币种分别计算；分摊按整数分分配，余额未扣除线下转账。
      </p>
      <SectionTitle>待核对的预订</SectionTitle>
      <p className="muted text-sm mb-3">
        点击预订，确认实际付款人和金额后计入账本。
      </p>
      <div className="surface divided">
        {data.pendingCosts.map((p) => (
          <div className="pending-row" key={p.id}>
            <button
              className="pending-confirm"
              aria-label={`确认${p.title}`}
              onClick={() => {
                setPending(p);
                setEditor(null);
              }}
            >
              <strong>{p.title}</strong>
              <span>
                {p.amount
                  ? `${money(p.amount, p.currency)} ${p.currency}`
                  : "金额待确认"}
                <ChevronRight size={15} />
              </span>
            </button>
            <p>{p.note}</p>
            {data.documents.some((d) => d.id === p.document_id) && (
              <button
                className="text-action"
                onClick={() => {
                  const d = data.documents.find((d) => d.id === p.document_id);
                  if (d) onDocument(d);
                }}
              >
                核对原始凭证
                <ArrowUpRight size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      {editor !== undefined && (
        <ExpenseEditor
          expense={editor}
          pending={pending}
          data={data}
          onClose={() => {
            setEditor(undefined);
            setPending(null);
          }}
          onSaved={onRefresh}
        />
      )}
      {detail && (
        <ExpenseDetail
          expense={detail}
          data={data}
          onClose={() => setDetail(null)}
          onRefresh={onRefresh}
          onEdit={(expense) => {
            setPending(null);
            setEditor(expense);
            setDetail(null);
          }}
        />
      )}
    </section>
  );
}
