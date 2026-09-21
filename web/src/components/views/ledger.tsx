"use client";
import { MemberSelect } from "../members/member-select";
import { Avatar } from "../avatar";
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  ArrowDownToLine,
  ChevronRight,
  ReceiptText,
  Info,
  ArrowRight,
} from "lucide-react";
import type { Currency, Expense, TripData, TripDocument } from "@/lib/models";
import {
  money,
  summarizeInCny,
  currencyLabel,
  ledgerCurrencies,
  defaultCnyRates,
  loadCnyRates,
  saveCnyRates,
  suggestSettlements,
  isTransfer,
  transferPayeeId,
  type CnyRates,
} from "@/lib/money";
import { ExpenseDetail } from "../ledger/expense-detail";
import { ExpenseEditor, type ExpenseDraft } from "../expense-editor";
export function Ledger({
  data,
  onRefresh,
  onDocument,
}: {
  data: TripData;
  onRefresh: () => Promise<void>;
  onDocument: (d: TripDocument) => void;
}) {
  const [currency, setCurrency] = useState<Currency>("NZD"),
    [payer, setPayer] = useState("all"),
    [view, setView] = useState<"records" | "members">("records");
  const [rates, setRates] = useState<CnyRates>({ ...defaultCnyRates });
  const [editor, setEditor] = useState<Expense | null | undefined>(undefined),
    [draft, setDraft] = useState<ExpenseDraft | undefined>(),
    [detail, setDetail] = useState<Expense | null>(null);
  useEffect(() => {
    setRates(loadCnyRates(data.trip.id));
  }, [data.trip.id]);
  const settlement = useMemo(
    () => summarizeInCny(data.expenses, data.members, rates),
    [data, rates],
  );
  const records = data.expenses.filter(
    (e) => e.currency === currency && (payer === "all" || e.payer_id === payer),
  );
  const mine = settlement.rows.find((m) => m.id === data.me.id)!;
  const payments = useMemo(
    () => suggestSettlements(settlement.rows),
    [settlement],
  );
  const spendCount = data.expenses.filter((e) => !isTransfer(e)).length;
  const transferCount = data.expenses.length - spendCount;
  function memberName(id: string) {
    return data.members.find((member) => member.id === id)?.name ?? "成员";
  }
  function openCreate(next?: ExpenseDraft) {
    setDraft(next);
    setEditor(null);
  }
  function changeRate(key: keyof CnyRates, value: string) {
    const next = { ...rates, [key]: Number(value) };
    if (!(next[key] > 0)) return;
    setRates(next);
    saveCnyRates(data.trip.id, next);
  }
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
      <div className="ledger-summary">
        <div className="summary-top">
          <span>人民币结算</span>
        </div>
        <div className="total-amount">{money(settlement.total, "CNY")}</div>
          <p>
            {spendCount} 笔支出
            {transferCount ? ` · ${transferCount} 笔转账` : ""} · 已按汇率折成人民币
            {settlement.skipped ? ` · ${settlement.skipped} 笔未计入` : ""}
          </p>
        <div className="ledger-fx" aria-label="结算汇率">
          <label>
            1 新西兰元
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.1"
              className="ledger-fx-rate"
              aria-label="新西兰元兑人民币"
              value={rates.NZD}
              onChange={(e) => changeRate("NZD", e.target.value)}
            />
            人民币
          </label>
          <label>
            1 美元
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.1"
              className="ledger-fx-rate"
              aria-label="美元兑人民币"
              value={rates.USD}
              onChange={(e) => changeRate("USD", e.target.value)}
            />
            人民币
          </label>
        </div>
        <div className="my-summary">
          <div>
            <span>我已支付</span>
            <strong>{money(mine.paid, "CNY")}</strong>
          </div>
          <div>
            <span>我应分摊</span>
            <strong>{money(mine.share, "CNY")}</strong>
          </div>
          <div>
            <span>{mine.balance >= 0 ? "待收回" : "待承担"}</span>
            <strong>{money(Math.abs(mine.balance), "CNY")}</strong>
          </div>
        </div>
      </div>
      <div className="ledger-add">
        <button
          className="primary-button w-full add-expense"
          onClick={() => openCreate()}
        >
          <Plus size={20} />
          新增支出
        </button>
        <button
          type="button"
          className="text-action"
          onClick={() => openCreate({ kind: "transfer" })}
        >
          记录转账
        </button>
      </div>
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
            <span>币种</span>
            <div className="currency-toggle">
              {ledgerCurrencies.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={currency === c}
                  className={c === currency ? "active" : ""}
                  onClick={() => setCurrency(c)}
                >
                  {currencyLabel(c)}
                </button>
              ))}
            </div>
          </div>
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
          {records.length > 0 && (
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
                    <strong>
                      {isTransfer(e) ? (
                        <span className="transfer-tag">转账</span>
                      ) : null}
                      {e.title}
                    </strong>
                    <small>
                      {isTransfer(e)
                        ? `${memberName(e.payer_id)} → ${memberName(transferPayeeId(e))} · ${e.date.slice(5).replace("-", ".")}`
                        : `${memberName(e.payer_id)} · ${e.date.slice(5).replace("-", ".")}`}
                    </small>
                  </div>
                  <span className="expense-amount">
                    {money(e.amount, e.currency)}
                    <ChevronRight size={14} />
                  </span>
                </button>
              ))}
            </div>
          )}
          {!records.length && (
            <div className="surface empty-state">
              <ReceiptText size={30} />
              <h3>
                {data.expenses.length ? "当前筛选下没有记录" : "还没有账本记录"}
              </h3>
              <p>
                {data.expenses.length
                  ? "试试其他币种或付款人。"
                  : "记录第一笔支出或转账，自动计算同行成员的分摊。"}
              </p>
            </div>
          )}
          <p className="list-caption">
            当前筛选合计{" "}
            {money(
              records
                .filter((e) => !isTransfer(e))
                .reduce((s, e) => s + e.amount, 0),
              currency,
            )}
          </p>
        </>
      ) : (
        <>
          <div className="surface settlement-plan">
            <h3>结算建议</h3>
            {payments.length ? (
              payments.map((payment) => {
                const from = data.members.find((m) => m.id === payment.from);
                const to = data.members.find((m) => m.id === payment.to);
                return (
                  <div className="settlement-payment" key={`${payment.from}-${payment.to}`}>
                    <Avatar member={from} className="expense-avatar" />
                    <div>
                      <strong>
                        {memberName(payment.from)}
                        <ArrowRight size={13} />
                        {memberName(payment.to)}
                      </strong>
                      <small>按此转账后可冲减双方余额</small>
                    </div>
                    <span>{money(payment.amount, "CNY")}</span>
                    <button
                      type="button"
                      className="text-action"
                      aria-label={`把 ${memberName(payment.from)} 转给 ${memberName(payment.to)} ${money(payment.amount, "CNY")} 记入账本`}
                      onClick={() =>
                        openCreate({
                          kind: "transfer",
                          payerId: payment.from,
                          payeeId: payment.to,
                          amountFen: payment.amount,
                        })
                      }
                    >
                      记入账本
                    </button>
                  </div>
                );
              })
            ) : (
              <p className="muted">目前没有待结算金额。</p>
            )}
          </div>
          <div className="surface divided member-statistics">
          {settlement.rows.map((m) => (
            <div className="member-balance" key={m.id}>
              <div className="balance-name">
                <Avatar member={m} className="expense-avatar" />
                <strong>
                  {m.name}
                  {m.id === data.me.id && <small> 我</small>}
                </strong>
                <span className={m.balance >= 0 ? "positive" : "muted"}>
                  {m.balance >= 0 ? "待收回" : "待承担"}{" "}
                  {money(Math.abs(m.balance), "CNY")}
                </span>
              </div>
              <div className="balance-values">
                <span>支付 {money(m.paid, "CNY")}</span>
                <span>分摊 {money(m.share, "CNY")}</span>
              </div>
              <div className="balance-track">
                <span
                  style={{
                    width: `${settlement.total ? (m.paid / settlement.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
          </div>
        </>
      )}
      <p className="ledger-hint">
        <Info size={15} />
        逐笔按原币种记录；结算按 1 新西兰元 = {rates.NZD || defaultCnyRates.NZD}{" "}
        人民币、1 美元 = {rates.USD || defaultCnyRates.USD}{" "}
        人民币折算。途中转账不计入支出合计，会冲减待结算金额。分摊按整数分分配。
      </p>
      {editor !== undefined && (
        <ExpenseEditor
          expense={editor}
          draft={draft}
          data={data}
          onClose={() => {
            setEditor(undefined);
            setDraft(undefined);
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
            setDraft(undefined);
            setEditor(expense);
            setDetail(null);
          }}
        />
      )}
    </section>
  );
}
