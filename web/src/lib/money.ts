import { currencyNames } from "../../../shared/travel-options";
import type { Currency, Expense, Member } from "./models";
export function money(cents: number, currency: Currency) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    ...(cents % 100
      ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      : {}),
  }).format(cents / 100);
}
export function splitAmount(amount: number, participants: string[]) {
  const ids = [...new Set(participants)].sort();
  if (!ids.length) throw new Error("至少选择一位分摊成员");
  const base = Math.floor(amount / ids.length),
    remainder = amount % ids.length;
  return Object.fromEntries(
    ids.map((id, i) => [id, base + (i < remainder ? 1 : 0)]),
  );
}
export function summarize(
  expenses: Expense[],
  members: Member[],
  currency: Currency,
) {
  const rows = members.map((m) => ({ ...m, paid: 0, share: 0, balance: 0 }));
  let total = 0;
  for (const expense of expenses.filter((e) => e.currency === currency)) {
    total += expense.amount;
    const splits = splitAmount(expense.amount, expense.participants);
    for (const row of rows) {
      if (row.id === expense.payer_id) row.paid += expense.amount;
      row.share += splits[row.id] ?? 0;
      row.balance = row.paid - row.share;
    }
  }
  return { total, rows };
}

export function currencyLabel(currency: Currency) {
  return currencyNames[currency];
}
