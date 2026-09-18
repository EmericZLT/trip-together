import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { SqliteD1 } from "./d1.ts";
import { DiskBucket } from "./files.ts";
import { applyMigrations } from "./migrate.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv() {
  try {
    for (const line of readFileSync(join(root, ".env"), "utf8").split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && process.env[match[1]] === undefined)
        process.env[match[1]] = match[2];
    }
  } catch {
    /* optional local file */
  }
}

export async function createEnv(): Promise<Env> {
  loadDotEnv();
  const dataDir = resolve(process.env.DATA_DIR || join(root, "data"));
  mkdirSync(join(dataDir, "files"), { recursive: true });
  const sqlite = new Database(join(dataDir, "trip.db"));
  await applyMigrations(sqlite, join(root, "infra/schema"));
  const key = process.env.SESSION_SIGNING_KEY || "";
  if (key.length < 32)
    throw new Error("SESSION_SIGNING_KEY 至少 32 个字符，请在 Render 环境变量中设置");
  return {
    DB: new SqliteD1(sqlite),
    FILES: new DiskBucket(join(dataDir, "files")),
    ASSETS: { fetch: () => Promise.resolve(new Response("not found", { status: 404 })) },
    SESSION_SIGNING_KEY: key,
    APP_ENV: process.env.APP_ENV || "production",
    EMAIL_FROM: process.env.EMAIL_FROM || "",
    EMAIL: { send: async () => undefined },
    GEOAPIFY_API_KEY: process.env.GEOAPIFY_API_KEY || "",
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "",
    SKIP_EMAIL_VERIFICATION: process.env.SKIP_EMAIL_VERIFICATION || "true",
    ANALYTICS_ENABLED: process.env.ANALYTICS_ENABLED || "false",
    ANALYTICS_HOSTNAME: process.env.ANALYTICS_HOSTNAME || "",
    OPENPANEL_ORIGIN: process.env.OPENPANEL_ORIGIN || "",
    OPENPANEL_CLIENT_ID: process.env.OPENPANEL_CLIENT_ID || "",
    OPENPANEL_CLIENT_SECRET: process.env.OPENPANEL_CLIENT_SECRET || "",
    SEED_TOKEN: process.env.SEED_TOKEN || "",
  } as unknown as Env;
}
