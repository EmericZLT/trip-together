import { equal } from "../accounts/password";
import { HttpError, json } from "../http";
import type { AnalyticsEnv } from "./config";
export async function productSummary(env: AnalyticsEnv) {
  const metrics = await env.DB.prepare(
    `SELECT
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
    (SELECT count(*) FROM expenses) AS expenses,
    (SELECT count(DISTINCT actor_id) FROM analytics_events WHERE actor_id NOT LIKE 'anonymous:%' AND created_at>=unixepoch()-86400) AS active_1d,
    (SELECT count(DISTINCT actor_id) FROM analytics_events WHERE actor_id NOT LIKE 'anonymous:%' AND created_at>=unixepoch()-604800) AS active_7d,
    (SELECT count(DISTINCT actor_id) FROM analytics_events WHERE actor_id NOT LIKE 'anonymous:%' AND created_at>=unixepoch()-2592000) AS active_30d,
    (SELECT count(*) FROM analytics_events WHERE delivered_at IS NULL) AS pending_events,
    (SELECT count(*) FROM analytics_events WHERE delivered_at IS NULL AND attempts>0) AS retrying_events,
    (SELECT min(created_at) FROM analytics_events WHERE delivered_at IS NULL) AS oldest_pending_at`,
  ).first<Record<string, number | null>>();
  const startedAt = await env.DB.prepare(
    "SELECT value FROM analytics_state WHERE key='started_at'",
  ).first<string>("value");
  return { asOf: new Date().toISOString(), startedAt, metrics: metrics! };
}
export async function summaryResponse(request: Request, env: AnalyticsEnv) {
  const configured = env.ANALYTICS_READ_TOKEN;
  const token =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!configured || configured.length < 32 || !equal(configured, token))
    throw new HttpError(403, "没有查看统计的权限");
  return json(await productSummary(env));
}
