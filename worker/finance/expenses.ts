import { z } from "zod";
import { body, HttpError, json } from "../http";
import { currencySchema } from "../../shared/validation";
const schema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "请填写支出名称").max(100),
  amount: z.number().int().positive().max(100000000, "金额过大"),
  currency: currencySchema,
  payerId: z.string().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (s) =>
        !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s,
      "日期无效",
    ),
  participants: z.array(z.string()).min(1, "至少选择一位分摊成员").max(100),
  note: z.string().trim().max(1000),
  version: z.number().int().positive().optional(),
  receiptIds: z.array(z.string().uuid()).max(5).optional(),
});
type Existing = {
  payer_id: string;
  created_by: string;
  version: number;
};
export async function saveExpense(
  request: Request,
  env: Env,
  memberId: string,
  tripId: string,
  expenseId?: string,
) {
  const input = await body(request, schema);
  const members = (
    await env.DB.prepare(
      "SELECT member_id AS id FROM trip_members WHERE trip_id=?",
    )
      .bind(tripId)
      .all<{ id: string }>()
  ).results.map((m) => m.id);
  if (
    input.participants.some((id) => !members.includes(id)) ||
    new Set(input.participants).size !== input.participants.length
  )
    throw new HttpError(400, "分摊成员无效");
  const id = expenseId ?? input.id ?? crypto.randomUUID();
  const existing = await env.DB.prepare(
    "SELECT payer_id,created_by,version FROM expenses WHERE id=? AND trip_id=?",
  )
    .bind(id, tripId)
    .first<Existing>();
  const payer = input.payerId ?? existing?.payer_id ?? memberId;
  if (!members.includes(payer)) throw new HttpError(400, "请选择有效付款人");
  if (expenseId) {
    if (!existing) throw new HttpError(404, "这笔支出不存在");
    if (existing.version !== input.version)
      throw new HttpError(409, "这笔支出已经更新，请刷新后重试");
  } else if (existing) {
    if (existing.created_by !== memberId)
      throw new HttpError(409, "支出编号冲突");
    return json({ ok: true, id });
  }
  if (
    input.receiptIds &&
    new Set(input.receiptIds).size !== input.receiptIds.length
  )
    throw new HttpError(400, "凭证重复");
  for (const receiptId of input.receiptIds ?? []) {
    const receipt = await env.DB.prepare(
      "SELECT uploaded_by,expense_id FROM receipts WHERE id=? AND trip_id=?",
    )
      .bind(receiptId, tripId)
      .first<{ uploaded_by: string; expense_id: string | null }>();
    if (
      !receipt ||
      !(
        receipt.expense_id === id ||
        (receipt.expense_id === null && receipt.uploaded_by === memberId)
      )
    )
      throw new HttpError(403, "无法关联这份凭证");
  }
  const token = crypto.randomUUID();
  const statements: D1PreparedStatement[] = [];
  if (expenseId)
    statements.push(
      env.DB.prepare(
        "UPDATE expenses SET title=?,amount=?,currency=?,payer_id=?,date=?,participants=?,note=?,version=version+1,write_token=? WHERE id=? AND trip_id=? AND version=?",
      ).bind(
        input.title,
        input.amount,
        input.currency,
        payer,
        input.date,
        JSON.stringify(input.participants),
        input.note,
        token,
        id,
        tripId,
        input.version,
      ),
    );
  else
    statements.push(
      env.DB.prepare(
        "INSERT INTO expenses (id,trip_id,payer_id,created_by,title,amount,currency,category,date,participants,note,write_token) VALUES (?,?,?,?,?,?,?,'其他',?,?,?,?)",
      ).bind(
        id,
        tripId,
        payer,
        memberId,
        input.title,
        input.amount,
        input.currency,
        input.date,
        JSON.stringify(input.participants),
        input.note,
        token,
      ),
    );
  if (input.receiptIds) {
    statements.push(
      env.DB.prepare(
        "UPDATE receipts SET expense_id=NULL WHERE expense_id=? AND id NOT IN (SELECT value FROM json_each(?)) AND EXISTS(SELECT 1 FROM expenses WHERE id=? AND write_token=?)",
      ).bind(id, JSON.stringify(input.receiptIds), id, token),
    );
    for (const receiptId of input.receiptIds)
      statements.push(
        env.DB.prepare(
          "UPDATE receipts SET uploaded_by=CASE WHEN expense_id=? OR (expense_id IS NULL AND uploaded_by=?) THEN uploaded_by ELSE NULL END,expense_id=? WHERE id=? AND EXISTS(SELECT 1 FROM expenses WHERE id=? AND write_token=?)",
        ).bind(id, memberId, id, receiptId, id, token),
      );
  }
  try {
    const results = await env.DB.batch(statements);
    if (!results[0].meta.changes)
      throw new HttpError(409, "这笔支出已经更新，请刷新后重试");
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof Error && /constraint|UNIQUE/i.test(error.message))
      throw new HttpError(409, "记录或凭证已经变更，请刷新后重试");
    throw error;
  }
  return json({ ok: true, id });
}
export async function deleteExpense(
  request: Request,
  env: Env,
  memberId: string,
  tripId: string,
  id: string,
) {
  const { version } = await body(
    request,
    z.object({ version: z.number().int().positive() }),
  );
  const result = await env.DB.prepare(
    "DELETE FROM expenses WHERE id=? AND trip_id=? AND version=?",
  )
    .bind(id, tripId, version)
    .run();
  if (!result.meta.changes)
    throw new HttpError(409, "无法删除：这笔支出已变更，请刷新后重试");
  return json({ ok: true });
}
