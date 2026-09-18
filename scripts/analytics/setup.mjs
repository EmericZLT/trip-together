import { writeFile, mkdir } from "node:fs/promises";
import { boardName, goals, boardParameters } from "./definition.mjs";
const args = process.argv.slice(2),
  config = args.find((x) => x.startsWith("--env="))?.slice(6);
if (config) process.loadEnvFile(config);
const {
  UMAMI_API_ORIGIN,
  UMAMI_API_TOKEN,
  UMAMI_WEBSITE_ID,
  ANALYTICS_PRODUCT_ORIGIN,
  ANALYTICS_READ_TOKEN,
  ANALYTICS_HOSTNAME,
} = process.env;
if (!UMAMI_API_ORIGIN || !UMAMI_API_TOKEN || !UMAMI_WEBSITE_ID)
  throw Error(
    "配置 UMAMI_API_ORIGIN、UMAMI_API_TOKEN、UMAMI_WEBSITE_ID，或使用 --env=私密文件路径",
  );
const apiBase = new URL(UMAMI_API_ORIGIN);
if (
  apiBase.protocol !== "https:" ||
  apiBase.username ||
  apiBase.password ||
  apiBase.search ||
  apiBase.hash
)
  throw Error("Umami API 必须使用 HTTPS");
async function api(path, body) {
  const response = await fetch(apiBase.href.replace(/\/$/, "") + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${UMAMI_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw Error(
      `Umami ${path} 返回 ${response.status}；请检查版本、权限和 API 地址`,
    );
  return response.json();
}
async function list(path) {
  const items = [];
  for (let page = 1; page <= 100; page++) {
    const result = await api(`${path}?page=${page}&pageSize=50`);
    if (Array.isArray(result)) return result;
    if (!Array.isArray(result.data)) throw Error("无法识别 Umami 分页响应");
    items.push(...result.data);
    if (items.length >= result.count || result.data.length === 0) return items;
  }
  throw Error("Umami 列表过长，尚未确认是否已有看板");
}
const website = await api(`/websites/${UMAMI_WEBSITE_ID}`);
if (
  website.id !== UMAMI_WEBSITE_ID ||
  (ANALYTICS_HOSTNAME && website.domain !== ANALYTICS_HOSTNAME)
)
  throw Error("Website ID 或网站域名不匹配");
// Check board support before creating reports; older instances need upgrading.
const boards = await list("/boards"),
  reports = await list("/reports");
console.log(`网站核验成功；已有看板 ${boards.length} 个。`);
if (!args.includes("--apply")) {
  console.log("只读检查完成；添加 --apply 创建或更新产品看板。");
  process.exit(0);
}
const reportIds = {};
for (const [event, label] of goals) {
  const name = `TripTogether · ${label}`;
  const matches = reports.filter(
    (r) => r.websiteId === UMAMI_WEBSITE_ID && r.name === name,
  );
  if (matches.length > 1) throw Error(`存在多个同名报告：${name}`);
  const existing = matches[0];
  if (
    existing &&
    (existing.type !== "goal" || existing.parameters?.value !== event)
  )
    throw Error(`同名报告定义不同：${name}`);
  const report =
    existing ??
    (await api("/reports", {
      websiteId: UMAMI_WEBSITE_ID,
      type: "goal",
      name,
      description: "业务成功写入后采集；次数不是账号总量。",
      parameters: { type: "event", value: event },
    }));
  reportIds[event] = report.id;
}
let text =
  "当前总量尚未同步。请配置 Worker 的看板 ID 和管理令牌，开启定时同步；此处不能使用事件次数代替历史用户数。";
if (ANALYTICS_PRODUCT_ORIGIN && ANALYTICS_READ_TOKEN) {
  const url = new URL("/api/analytics/summary", ANALYTICS_PRODUCT_ORIGIN);
  if (url.protocol !== "https:") throw Error("产品统计地址必须使用 HTTPS");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${ANALYTICS_READ_TOKEN}` },
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error(`读取产品统计失败 ${response.status}`);
  const snapshot = await response.json();
  text =
    `更新时间 ${snapshot.asOf}\n` +
    Object.entries(snapshot.metrics)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
}
const parameters = boardParameters(UMAMI_WEBSITE_ID, reportIds, text);
const matches = boards.filter(
  (b) => b.name === boardName && b.parameters?.websiteId === UMAMI_WEBSITE_ID,
);
if (matches.length > 1) throw Error("存在多个同名产品看板，请先确认目标");
const existing = matches[0];
let board;
if (existing) {
  const current = await api(`/boards/${existing.id}`);
  if (current.shareId) throw Error("同名看板已开启公开分享，请使用私有看板");
  const managed = new Set(parameters.rows.map((row) => row.id));
  // Preserve custom rows; update only rows managed by this integration.
  parameters.rows.push(
    ...(current.parameters?.rows ?? []).filter((row) => !managed.has(row.id)),
  );
  board = await api(`/boards/${existing.id}`, { parameters });
} else
  board = await api("/boards", {
    type: "website",
    name: boardName,
    description: "注册、使用和多人协作；私有产品运营看板",
    parameters,
  });
const verified = await api(`/boards/${board.id}`);
if (
  verified.shareId ||
  verified.parameters?.websiteId !== UMAMI_WEBSITE_ID ||
  !verified.parameters?.rows?.some((row) =>
    row.columns?.some((col) => col.id === "trip-product-totals"),
  )
)
  throw Error("看板读回校验失败");
await mkdir(".local/analytics", { recursive: true });
await writeFile(
  ".local/analytics/board.json",
  JSON.stringify(
    { websiteId: UMAMI_WEBSITE_ID, boardId: board.id, reportIds },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log(
  `私有看板创建并校验成功。UMAMI_BOARD_ID=${board.id}；没有开启公开分享。`,
);
