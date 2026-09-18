import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function loadDotEnv() {
  const file = resolve(root, ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2];
    }
  }
}

loadDotEnv();

const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8790";
const children = [];
let shuttingDown = false;

function run(label, command) {
  const child = spawn(command, {
    cwd: root,
    env: {
      ...process.env,
      NEXT_PUBLIC_API_URL: api,
    },
    stdio: "inherit",
    shell: true,
  });
  child.on("exit", (code) => {
    if (shuttingDown) return;
    console.error(`${label} 已退出${code == null ? "" : `（${code}）`}`);
    shutdown();
    process.exit(code || 1);
  });
  children.push(child);
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      /* already gone */
    }
  }
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});

console.log("前端 http://localhost:3000");
console.log(`后端 ${api}/health`);
run("后端", "npx tsx watch backend/server.ts");
run("前端", "npx next dev web --port 3000");
