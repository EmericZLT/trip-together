import { HttpError, json } from "../worker/http.ts";
import { passwordHash, randomToken } from "../worker/accounts/password.ts";
import { itineraryEvents, packingList, tripMeta } from "./nz-itinerary.ts";

export type SeedMember = {
  email: string;
  password: string;
  name: string;
  english_name?: string;
  owner?: boolean;
};

export type SeedExpense = {
  title: string;
  amount: number;
  currency: "NZD" | "CNY";
  date: string;
  category?: string;
  note?: string;
};

function emailOf(value: string) {
  return value.trim().toLowerCase();
}

async function upsertMember(env: Env, input: SeedMember, resetPassword: boolean) {
  const email = emailOf(input.email);
  if (!email || !input.name?.trim()) throw new HttpError(400, "成员需要邮箱和姓名");
  if (input.password.length < 10) throw new HttpError(400, "初始密码至少 10 个字符");
  const existing = await env.DB.prepare(
    "SELECT id FROM members WHERE email=?",
  ).bind(email).first<{ id: string }>();
  if (existing) {
    if (resetPassword) {
      const salt = randomToken();
      await env.DB.prepare(
        "UPDATE members SET name=?,english_name=?,password_hash=?,salt=?,version=version+1 WHERE id=?",
      )
        .bind(
          input.name.trim(),
          input.english_name ?? "",
          await passwordHash(input.password, salt),
          salt,
          existing.id,
        )
        .run();
      await env.DB.prepare("DELETE FROM sessions WHERE member_id=?")
        .bind(existing.id)
        .run();
    } else {
      await env.DB.prepare("UPDATE members SET name=?,english_name=? WHERE id=?")
        .bind(input.name.trim(), input.english_name ?? "", existing.id)
        .run();
    }
    return existing.id;
  }
  const id = crypto.randomUUID();
  const salt = randomToken();
  await env.DB.prepare(
    "INSERT INTO members (id,email,name,english_name,password_hash,salt,email_verified_at) VALUES (?,?,?,?,?,?,?)",
  )
    .bind(
      id,
      email,
      input.name.trim(),
      input.english_name ?? "",
      await passwordHash(input.password, salt),
      salt,
      Date.now(),
    )
    .run();
  return id;
}

export async function seedNzTrip(
  env: Env,
  input: { members: SeedMember[]; expenses?: SeedExpense[]; resetPasswords?: boolean },
) {
  const members = input.members ?? [];
  if (members.length < 2) throw new HttpError(400, "请至少提供两名成员");
  const owners = members.filter((m) => m.owner);
  if (owners.length !== 1) throw new HttpError(400, "请且仅将一名成员标为 owner");
  const reset = Boolean(input.resetPasswords);
  const ids: { email: string; name: string; id: string; owner: boolean }[] = [];
  for (const member of members) {
    const id = await upsertMember(env, member, reset);
    ids.push({
      email: emailOf(member.email),
      name: member.name.trim(),
      id,
      owner: Boolean(member.owner),
    });
  }
  const ownerId = ids.find((m) => m.owner)!.id;
  let trip = await env.DB.prepare("SELECT id FROM trips WHERE title=?").bind(
    tripMeta.title,
  ).first<{ id: string }>();
  if (!trip) {
    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO trips (id,title,owner_id,start_date,end_date,timezone,home_timezone,currency,home_currency,destinations) VALUES (?,?,?,?,?,?,?,?,?,?)",
    )
      .bind(
        id,
        tripMeta.title,
        ownerId,
        tripMeta.start_date,
        tripMeta.end_date,
        tripMeta.timezone,
        tripMeta.home_timezone,
        tripMeta.currency,
        tripMeta.home_currency,
        JSON.stringify(tripMeta.destinations),
      )
      .run();
    trip = { id };
  } else {
    await env.DB.prepare("UPDATE trips SET owner_id=? WHERE id=?").bind(
      ownerId,
      trip.id,
    ).run();
  }
  for (const member of ids) {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO trip_members (trip_id,member_id) VALUES (?,?)",
    )
      .bind(trip.id, member.id)
      .run();
  }
  await env.DB.prepare("DELETE FROM events WHERE trip_id=?").bind(trip.id).run();
  for (const item of itineraryEvents()) {
    const eventId = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO events (id,trip_id,data,created_by) VALUES (?,?,?,?)",
    )
      .bind(
        eventId,
        trip.id,
        JSON.stringify({ ...item, id: eventId }),
        ownerId,
      )
      .run();
  }
  await env.DB.prepare("DELETE FROM packing WHERE trip_id=?").bind(trip.id).run();
  await env.DB.prepare("DELETE FROM preparation_items WHERE trip_id=?")
    .bind(trip.id)
    .run();
  for (const [group_name, title, note] of packingList) {
    const itemId = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO preparation_items (id,trip_id,group_name,title,note) VALUES (?,?,?,?,?)",
    )
      .bind(itemId, trip.id, group_name, title, note)
      .run();
  }
  const participantIds = ids.map((m) => m.id);
  for (const expense of input.expenses ?? []) {
    if (!expense.amount || expense.amount < 1) continue;
    await env.DB.prepare(
      "INSERT INTO expenses (id,trip_id,payer_id,created_by,title,amount,currency,category,date,participants,note,source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    )
      .bind(
        crypto.randomUUID(),
        trip.id,
        ownerId,
        ownerId,
        expense.title,
        expense.amount,
        expense.currency,
        expense.category ?? "其他",
        expense.date,
        JSON.stringify(participantIds),
        expense.note ?? "",
        "预先登记",
      )
      .run();
  }
  return {
    tripId: trip.id,
    title: tripMeta.title,
    members: ids.map(({ email, name, owner }) => ({ email, name, owner })),
  };
}

export async function seedFromRequest(request: Request, env: Env) {
  const token = env.SEED_TOKEN;
  if (!token || request.headers.get("x-seed-token") !== token)
    throw new HttpError(401, "未授权");
  const raw = await request.json();
  const body = Array.isArray(raw)
    ? { members: raw as SeedMember[] }
    : (raw as {
        members?: SeedMember[];
        expenses?: SeedExpense[];
        resetPasswords?: boolean;
      });
  return json(
    await seedNzTrip(env, {
      members: body.members ?? [],
      expenses: body.expenses,
      resetPasswords: body.resetPasswords,
    }),
  );
}
