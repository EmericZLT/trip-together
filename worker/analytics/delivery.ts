import {
  readTotals,
  snapshotEvents,
  totalProperties,
  type Totals,
} from "./totals";
import { analyticsConfig, anonymousId, type AnalyticsEnv } from "./config";
type Row = {
  id: string;
  name: string;
  actor_id: string | null;
  entity_id: string | null;
  data: string;
  created_at: number;
  attempts: number;
};
export async function deliverEvents(env: AnalyticsEnv) {
  const config = analyticsConfig(env);
  if (!config) return { sent: 0, failed: 0 };
  const lease = crypto.randomUUID(),
    now = Math.floor(Date.now() / 1000);
  const claimed = await env.DB.prepare(
    `UPDATE analytics_events SET lease_token=?,lease_until=? WHERE id IN
    (SELECT id FROM analytics_events WHERE delivered_at IS NULL AND next_attempt_at<=? AND lease_until<? ORDER BY created_at,rowid LIMIT 50)
    AND delivered_at IS NULL AND lease_until<? RETURNING *`,
  )
    .bind(lease, now + 120, now, now, now)
    .all<Row>();
  // At most one full-count query per batch, shared by concurrent sends.
  let totals: Promise<Totals> | undefined;
  let sent = 0,
    failed = 0;
  const process = async (row: Row) => {
    let status = 0;
    try {
      const metadata = JSON.parse(row.data);
      // Explicit whitelist also protects against accidental future journal fields.
      const data: Record<string, string | number> = {
        delivery_id: await anonymousId(config.key, `delivery:${row.id}`),
        source: metadata.page ? "product_ui" : "business",
      };
      for (const field of ["kind", "visibility", "format", "page", "step"])
        if (["string", "number"].includes(typeof metadata[field]))
          data[field] = metadata[field];
      if (snapshotEvents.has(row.name)) {
        if (!metadata.totals) {
          totals ??= readTotals(env);
          metadata.totals = await totals;
          // Persist before contacting OpenPanel: retries must not change the sample.
          const saved = await env.DB.prepare(
            "UPDATE analytics_events SET data=? WHERE id=? AND lease_token=?",
          )
            .bind(JSON.stringify(metadata), row.id, lease)
            .run();
          if (saved.meta.changes !== 1) throw new Error("Analytics lease lost");
        }
        Object.assign(data, totalProperties(metadata.totals));
      }
      if (row.entity_id)
        data.entity = await anonymousId(config.key, `entity:${row.entity_id}`);
      const profileId = await anonymousId(
        config.key,
        row.actor_id ?? `event:${row.id}`,
      );
      const response = await fetch(`${config.origin}/track`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "TripTogether-Analytics/1.0",
          "openpanel-client-id": config.clientId,
          "openpanel-client-secret": config.clientSecret,
        },
        body: JSON.stringify({
          type: "track",
          payload: {
            name: row.name === "page_viewed" ? "screen_view" : row.name,
            profileId,
            properties: {
              ...data,
              __timestamp: new Date(row.created_at * 1000).toISOString(),
              __deviceId: profileId,
              __url: `https://${config.hostname}/${metadata.page ?? "product-events"}`,
            },
          },
        }),
        signal: AbortSignal.timeout(5000),
        redirect: "error",
      });
      status = response.status;
      if (!response.ok) throw new Error("Rejected");
      const result = (await response.json()) as { sessionId?: string };
      if (!result.sessionId) throw new Error("Not collected");
      await env.DB.prepare(
        "UPDATE analytics_events SET delivered_at=?,lease_until=0,lease_token=NULL,last_status=? WHERE id=? AND lease_token=?",
      )
        .bind(now, status, row.id, lease)
        .run();
      sent++;
    } catch {
      const retryAt =
        now + Math.min(86400, 60 * 2 ** Math.min(row.attempts, 10));
      await env.DB.prepare(
        "UPDATE analytics_events SET attempts=attempts+1,next_attempt_at=?,lease_until=0,lease_token=NULL,last_status=? WHERE id=? AND lease_token=?",
      )
        .bind(retryAt, status, row.id, lease)
        .run();
      failed++;
    }
  };
  for (let i = 0; i < claimed.results.length; i += 10)
    await Promise.all(claimed.results.slice(i, i + 10).map(process));
  return { sent, failed };
}
export async function analyticsScheduled(env: AnalyticsEnv) {
  try {
    if (!analyticsConfig(env)) return;
    const result = await deliverEvents(env);
    console.log(JSON.stringify({ event: "analytics_delivery", ...result }));
  } catch {
    console.error(JSON.stringify({ event: "analytics_delivery_failed" }));
  }
}
