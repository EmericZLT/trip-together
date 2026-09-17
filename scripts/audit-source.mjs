import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
const files = execFileSync(
  "git",
  ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const forbidden = [
  /^(assets\/|info\.md$|\.local\/|\.dev\.vars|infra\/\.dev\.vars|infra\/wrangler\.production\.jsonc$)/,
  /\.(sqlite|db|sql\.gz)$/,
];
let errors = 0;
for (const file of new Set(files)) {
  let data;
  try {
    const info = await stat(file);
    if (!info.isFile()) continue;
    data = await readFile(file);
  } catch (e) {
    if (e.code === "ENOENT") continue;
    throw e;
  }
  if (forbidden.some((re) => re.test(file))) {
    console.error(`禁止导出的私人路径：${file}`);
    errors++;
  }
  if (
    /\.(ts|tsx|mjs|json|jsonc|md|sql|css)$/.test(file) &&
    !file.startsWith("scripts/audit-source")
  ) {
    const text = data.toString();
    // Detect common credential material without printing the value.
    if (
      /(?:SESSION_SIGNING_KEY\s*=\s*[a-f0-9]{32,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----)/.test(
        text,
      )
    ) {
      console.error(`检测到可能的密钥：${file}`);
      errors++;
    }
    if (/\.(ts|tsx|mjs)$/.test(file) && text.split("\n").length > 401) {
      console.error(`代码超过 400 行：${file}`);
      errors++;
    }
  }
}
if (errors) process.exit(1);
console.log(
  "当前源码路径、常见密钥与文件长度检查通过。公开时仍需导出无 Git 历史的快照。",
);
