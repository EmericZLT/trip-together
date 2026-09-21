import { currencyNames } from "../../../shared/travel-options";
import type { Currency, Expense, Member } from "./models";

export const ledgerCurrencies = ["NZD", "USD", "CNY"] as const;
export type LedgerCurrency = (typeof ledgerCurrencies)[number];

export const defaultCnyRates = {
  NZD: 4,
  USD: 6.8,
} as const;

export type CnyRates = { NZD: number; USD: number };

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
export function toCnyFen(
  cents: number,
  currency: Currency,
  rates: CnyRates = defaultCnyRates,
) {
  if (currency === "CNY") return cents;
  if (currency === "NZD") return Math.round(cents * rates.NZD);
  if (currency === "USD") return Math.round(cents * rates.USD);
  return null;
}
export const TRANSFER_CATEGORY = "转账";

export function isTransfer(expense: Pick<Expense, "category">) {
  return expense.category === TRANSFER_CATEGORY;
}

export function transferPayeeId(
  expense: Pick<Expense, "payer_id" | "participants">,
) {
  return (
    expense.participants.find((id) => id !== expense.payer_id) ??
    expense.participants[0]
  );
}

export type BalanceRow = Member & {
  paid: number;
  share: number;
  balance: number;
};

export type SettlementPayment = {
  from: string;
  to: string;
  amount: number;
};

export function summarize(
  expenses: Expense[],
  members: Member[],
  currency: Currency,
) {
  const rows: BalanceRow[] = members.map((m) => ({
    ...m,
    paid: 0,
    share: 0,
    balance: 0,
  }));
  const net = Object.fromEntries(members.map((m) => [m.id, 0]));
  let total = 0;
  for (const expense of expenses.filter((e) => e.currency === currency)) {
    if (isTransfer(expense)) {
      const payee = transferPayeeId(expense);
      if (!payee || payee === expense.payer_id) continue;
      net[expense.payer_id] = (net[expense.payer_id] ?? 0) + expense.amount;
      net[payee] = (net[payee] ?? 0) - expense.amount;
      continue;
    }
    total += expense.amount;
    const splits = splitAmount(expense.amount, expense.participants);
    for (const row of rows) {
      if (row.id === expense.payer_id) row.paid += expense.amount;
      row.share += splits[row.id] ?? 0;
    }
  }
  for (const row of rows) row.balance = row.paid - row.share + (net[row.id] ?? 0);
  return { total, rows };
}

export function suggestSettlements(rows: BalanceRow[]): SettlementPayment[] {
  const debtors = rows
    .filter((row) => row.balance < 0)
    .map((row) => ({ id: row.id, remain: -row.balance }))
    .sort((a, b) => b.remain - a.remain || a.id.localeCompare(b.id));
  const creditors = rows
    .filter((row) => row.balance > 0)
    .map((row) => ({ id: row.id, remain: row.balance }))
    .sort((a, b) => b.remain - a.remain || a.id.localeCompare(b.id));
  const payments: SettlementPayment[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].remain, creditors[j].remain);
    if (amount > 0)
      payments.push({ from: debtors[i].id, to: creditors[j].id, amount });
    debtors[i].remain -= amount;
    creditors[j].remain -= amount;
    if (debtors[i].remain === 0) i += 1;
    if (creditors[j].remain === 0) j += 1;
  }
  return payments;
}

export function summarizeInCny(
  expenses: Expense[],
  members: Member[],
  rates: CnyRates = defaultCnyRates,
) {
  const converted = expenses.flatMap((expense) => {
    const amount = toCnyFen(expense.amount, expense.currency, rates);
    if (amount == null) return [];
    return [{ ...expense, amount, currency: "CNY" as const }];
  });
  return {
    ...summarize(converted, members, "CNY"),
    skipped: expenses.length - converted.length,
  };
}

export function currencyLabel(currency: Currency) {
  return currencyNames[currency];
}

function positiveRate(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function loadCnyRates(tripId: string): CnyRates {
  try {
    if (typeof localStorage === "undefined") return { ...defaultCnyRates };
    const raw = localStorage.getItem(`cny-rates:${tripId}`);
    if (!raw) return { ...defaultCnyRates };
    const parsed = JSON.parse(raw) as Partial<CnyRates>;
    return {
      NZD: positiveRate(parsed.NZD) ?? defaultCnyRates.NZD,
      USD: positiveRate(parsed.USD) ?? defaultCnyRates.USD,
    };
  } catch {
    return { ...defaultCnyRates };
  }
}

export function saveCnyRates(tripId: string, rates: CnyRates) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(`cny-rates:${tripId}`, JSON.stringify(rates));
}
