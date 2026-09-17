import { mkdir, writeFile, readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
await mkdir(".local", { recursive: true });
try {
  await writeFile(
    "infra/.dev.vars",
    `SESSION_SIGNING_KEY=${randomBytes(32).toString("hex")}\n`,
    { mode: 0o600, flag: "wx" },
  );
} catch (e) {
  if (e.code !== "EEXIST") throw e;
}
const varsPath = "infra/.dev.vars";
const vars = await readFile(varsPath, "utf8");
await writeFile(
  varsPath,
  vars.replace(/^APP_ENV=.*\n?/gm, "").trimEnd() + "\nAPP_ENV=local\n",
  { mode: 0o600 },
);
const r = spawnSync(
  process.execPath,
  [
    "node_modules/wrangler/bin/wrangler.js",
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "--config",
    "infra/wrangler.jsonc",
    "--persist-to",
    ".local/travel-state",
  ],
  { stdio: "inherit" },
);
if (r.status !== 0) process.exit(r.status ?? 1);
console.log(
  "空白数据库结构已经初始化。请在页面注册并创建行程；没有导入任何用户数据。",
);
