import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
const changes = execFileSync("git", ["status", "--porcelain"], {
  encoding: "utf8",
});
if (changes.trim())
  throw new Error("请先提交当前修改，确保导出包含全部已验证内容");
execFileSync(process.execPath, ["scripts/audit-source.mjs"], {
  stdio: "inherit",
});
await mkdir("release", { recursive: true });
execFileSync("git", [
  "archive",
  "--format=tar.gz",
  "--prefix=trip-together/",
  "-o",
  "release/trip-together-source.tar.gz",
  "HEAD",
]);
console.log(
  "已经导出 release/trip-together-source.tar.gz。文件不包含 .git 历史或忽略的本地资料。",
);
