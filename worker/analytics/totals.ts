import type { AnalyticsEnv } from "./config";

// Shared with the protected summary so event snapshots keep the same definitions.
export const TOTALS_SELECT = `
    (SELECT count(*) FROM members) AS users,
    (SELECT count(*) FROM members WHERE email_verified_at IS NOT NULL) AS verified_users,
    (SELECT count(DISTINCT owner_id) FROM trips) AS trip_creators,
    (SELECT count(*) FROM trips) AS trips,
    (SELECT count(*) FROM events) AS events,
    (SELECT count(*) FROM events WHERE json_extract(data,'$.kind')='explore') AS activities,
    (SELECT count(*) FROM (SELECT trip_id FROM trip_members GROUP BY trip_id HAVING count(*)>=2)) AS multiplayer_trips,
    (SELECT count(DISTINCT trip_id) FROM events) AS planned_trips,
    (SELECT count(DISTINCT member_id) FROM trip_members) AS trip_members,
    (SELECT count(*) FROM documents WHERE trip_id IS NOT NULL) AS documents,
    (SELECT count(*) FROM expenses) AS expenses`;
export const totalFields = [
  "users",
  "verified_users",
  "trip_creators",
  "trips",
  "events",
  "activities",
  "multiplayer_trips",
  "planned_trips",
  "trip_members",
  "documents",
  "expenses",
] as const;
export const snapshotEvents = new Set([
  "account_registered",
  "email_verified",
  "trip_created",
  "trip_joined",
  "trip_became_multiplayer",
  "event_created",
  "document_uploaded",
  "expense_created",
]);
export type Totals = Record<(typeof totalFields)[number], number> & {
  sampled_at: string;
};
export async function readTotals(env: AnalyticsEnv): Promise<Totals> {
  // All counts and the timestamp come from a single database read, off the request path.
  const row = await env.DB.prepare(
    `SELECT ${TOTALS_SELECT}, strftime('%Y-%m-%dT%H:%M:%fZ','now') AS sampled_at`,
  ).first<Totals>();
  if (!row) throw new Error("Analytics totals unavailable");
  return row;
}
export function totalProperties(
  snapshot: Totals,
): Record<string, number | string> {
  const values: Record<string, number | string> = {
    totals_sampled_at: snapshot.sampled_at,
  };
  if (
    typeof snapshot.sampled_at !== "string" ||
    !Number.isFinite(Date.parse(snapshot.sampled_at))
  )
    throw new Error("Invalid analytics sampling time");
  for (const key of totalFields) {
    const value = snapshot[key];
    if (!Number.isSafeInteger(value) || value < 0)
      throw new Error("Invalid analytics total");
    values[`total_${key}`] = value;
  }
  return values;
}
