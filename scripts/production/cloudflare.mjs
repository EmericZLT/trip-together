import { spawnSync } from "node:child_process";

export function cloudflare(path) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error("请设置 CLOUDFLARE_API_TOKEN 以检查生产资源权限");
  // Pass credentials through stdin, never through command arguments or logs.
  const result = spawnSync(
    "curl",
    ["--silent", "--show-error", "--fail-with-body", "--config", "-"],
    {
      input: `url = ${JSON.stringify(`https://api.cloudflare.com/client/v4${path}`)}\nheader = ${JSON.stringify(`Authorization: Bearer ${token}`)}\n`,
      encoding: "utf8",
      timeout: 30000,
    },
  );
  if (result.status !== 0)
    throw new Error(`Cloudflare 检查失败：${path}；请检查网络或 Token 权限`);
  const response = JSON.parse(result.stdout);
  if (!response.success) throw new Error(`Cloudflare 检查未成功：${path}`);
  return response.result;
}

export function assertPrivateBucket(config) {
  const base = `/accounts/${config.account_id}/r2/buckets/${config.r2_buckets[0].bucket_name}/domains`;
  const managed = cloudflare(`${base}/managed`);
  const custom = cloudflare(`${base}/custom`);
  if (managed.enabled !== false || !Array.isArray(custom.domains))
    throw new Error("无法确认 R2 为私有，停止发布");
  if (custom.domains.some((domain) => domain.enabled !== false))
    throw new Error("R2 存在公开 Custom Domain，停止发布");
  console.log("R2 私有访问检查通过：r2.dev 关闭，无公开 Custom Domain。");
}
