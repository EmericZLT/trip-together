import { productSummary } from "./summary";
import type { AnalyticsEnv } from "./config";
export async function umamiApi(
  env: AnalyticsEnv,
  path: string,
  body?: unknown,
) {
  if (!env.UMAMI_API_ORIGIN || !env.UMAMI_API_TOKEN)
    throw new Error("Umami administration is not configured");
  const base = new URL(env.UMAMI_API_ORIGIN);
  if (
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new Error("Invalid Umami API origin");
  const response = await fetch(base.href.replace(/\/$/, "") + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.UMAMI_API_TOKEN}`,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(8000),
    redirect: "error",
  });
  if (!response.ok) throw new Error(`Umami API status ${response.status}`);
  return response.json() as Promise<Record<string, any>>;
}
export function snapshotText(
  snapshot: Awaited<ReturnType<typeof productSummary>>,
) {
  const m = snapshot.metrics;
  const ratio = (a: number | null, b: number | null) =>
    b ? `${(((a ?? 0) / b) * 100).toFixed(1)}%` : "—";
  return [
    `数据更新时间：${snapshot.asOf}（UTC，数据库当前总量；不受看板日期筛选影响）`,
    `用户数 ${m.users} ｜ 邮箱验证用户 ${m.verified_users} ｜ 创建行程用户 ${m.trip_creators}`,
    `行程事项 ${m.events} ｜ 其中游玩活动 ${m.activities} ｜ 多人行程 ${m.multiplayer_trips}`,
    `全部行程 ${m.trips} ｜ 有安排的行程 ${m.planned_trips} ｜ 参与行程用户 ${m.trip_members}`,
    `旅行资料 ${m.documents} ｜ 支出记录 ${m.expenses}`,
    `最近 24 小时 / 7 天 / 30 天活跃账号：${m.active_1d} / ${m.active_7d} / ${m.active_30d}`,
    `创建行程率 ${ratio(m.trip_creators, m.users)} ｜ 邮箱验证率 ${ratio(m.verified_users, m.users)} ｜ 多人行程占比 ${ratio(m.multiplayer_trips, m.trips)}`,
    `行为采集起点 ${snapshot.startedAt}；活跃为账号去重，不等于 Umami visitors。`,
    `待发送事件 ${m.pending_events} ｜ 重试中 ${m.retrying_events}。业务事件由服务端发送，勿用浏览器或地理位置报告解读用户设备与来源。`,
  ].join("\n\n");
}
export async function updateBoard(env: AnalyticsEnv) {
  if (!env.UMAMI_BOARD_ID || !env.UMAMI_API_TOKEN) return;
  const board = await umamiApi(
    env,
    `/boards/${encodeURIComponent(env.UMAMI_BOARD_ID)}`,
  );
  if (board.shareId) throw new Error("Analytics board must remain private");
  if (board.parameters?.websiteId !== env.UMAMI_WEBSITE_ID)
    throw new Error("Analytics board website mismatch");
  let found = false;
  const parameters = structuredClone(board.parameters);
  const text = snapshotText(await productSummary(env));
  for (const row of parameters.rows ?? [])
    for (const column of row.columns ?? []) {
      if (
        column.id === "trip-product-totals" &&
        column.component?.type === "TextBlock"
      ) {
        column.component.props = { ...column.component.props, text };
        found = true;
      }
    }
  if (!found) throw new Error("Analytics snapshot component missing");
  await umamiApi(env, `/boards/${encodeURIComponent(env.UMAMI_BOARD_ID)}`, {
    parameters,
  });
}
