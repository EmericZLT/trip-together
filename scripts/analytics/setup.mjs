import { mkdir, writeFile } from "node:fs/promises";
import { dashboard } from "./definition.mjs";
const args = process.argv.slice(2);
const file = args.find((arg) => arg.startsWith("--env="))?.slice(6);
if (file) process.loadEnvFile(file);
if (args.some((arg) => !arg.startsWith("--env=") && arg !== "--send-test"))
  throw Error(
    "只支持 --env=私密文件 和 --send-test；官方接口尚未提供看板创建能力。",
  );
const {
  OPENPANEL_ORIGIN = "https://api.openpanel.dev",
  OPENPANEL_CLIENT_ID,
  OPENPANEL_CLIENT_SECRET,
} = process.env;
if (!OPENPANEL_CLIENT_ID || !OPENPANEL_CLIENT_SECRET)
  throw Error(
    "请在私密配置文件填写 OPENPANEL_CLIENT_ID 和 OPENPANEL_CLIENT_SECRET",
  );
const origin = new URL(OPENPANEL_ORIGIN);
if (
  origin.protocol !== "https:" ||
  origin.username ||
  origin.password ||
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash
)
  throw Error("OpenPanel 必须使用 HTTPS 根地址");
const headers = {
  "Content-Type": "application/json",
  "openpanel-client-id": OPENPANEL_CLIENT_ID,
  "openpanel-client-secret": OPENPANEL_CLIENT_SECRET,
  "User-Agent": "TripTogether-Analytics/1.0",
};
await mkdir(".local/analytics", { recursive: true });
await writeFile(
  ".local/analytics/openpanel-dashboard.json",
  JSON.stringify(dashboard, null, 2),
  { mode: 0o600 },
);
console.log(
  "看板指标方案已保存到 .local/analytics/openpanel-dashboard.json（非平台导入格式）。",
);
const response = await fetch(`${origin.origin}/manage/projects`, {
  headers,
  redirect: "error",
  signal: AbortSignal.timeout(15000),
});
if (response.ok)
  console.log(
    "管理接口鉴权成功；官方看板接口当前只支持查询，需要在控制台创建报告。",
  );
else if ([401, 403].includes(response.status))
  console.log(
    `管理接口 HTTP ${response.status}：当前凭据无法查询管理资源，不能据此判断采集凭据无效。`,
  );
else throw Error(`OpenPanel 管理接口 HTTP ${response.status}`);
if (args.includes("--send-test")) {
  const result = await fetch(`${origin.origin}/track`, {
    method: "POST",
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      type: "track",
      payload: {
        name: "integration_check",
        profileId: "integration-check",
        properties: {
          source: "integration_test",
          __timestamp: new Date().toISOString(),
        },
      },
    }),
  });
  if (!result.ok) throw Error(`OpenPanel 采集接口 HTTP ${result.status}`);
  const body = await result.json();
  if (!body.sessionId) throw Error("OpenPanel 未返回采集确认");
  console.log(
    "测试事件已被采集接口接受；请在 Events 中查看 integration_check，不计入正式业务指标。",
  );
}
