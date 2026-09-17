import { spawn, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve } from "node:path";
await mkdir(".local", { recursive: true });
const state = await mkdtemp(resolve(".local/verify-")),
  port = 8791;
const wrangler = resolve("node_modules/wrangler/bin/wrangler.js");
function run(cmd, args, extra = {}) {
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      TEST_BASE_URL: `http://localhost:${port}`,
      ...extra,
    },
  });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed`);
}
let server;
try {
  run(process.execPath, [
    wrangler,
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "--config",
    "infra/wrangler.jsonc",
    "--persist-to",
    state,
  ]);
  server = spawn(
    process.execPath,
    [
      wrangler,
      "dev",
      "--local",
      "--config",
      "infra/wrangler.jsonc",
      "--persist-to",
      state,
      "--port",
      String(port),
      "--var",
      "APP_ENV:local",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let logs = "";
  server.stdout.on("data", (b) => {
    logs = (logs + b).slice(-12000);
  });
  server.stderr.on("data", (b) => {
    logs = (logs + b).slice(-12000);
  });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://localhost:${port}`);
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) throw new Error(`Local server failed: ${logs}`);
  try {
    run("npm", ["run", "test"]);
    run("npm", ["run", "test:e2e"]);
    run("npm", ["run", "test:e2e:safari"]);
  } catch (e) {
    console.error(logs);
    throw e;
  }
} finally {
  if (server) {
    server.kill("SIGTERM");
    await new Promise((resolve) => {
      server.once("exit", resolve);
      setTimeout(resolve, 3000);
    });
  }
  await rm(state, { recursive: true, force: true });
}
