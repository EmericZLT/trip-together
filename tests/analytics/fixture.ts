import { Miniflare } from "miniflare";
import { readFile, readdir } from "node:fs/promises";
import type { AnalyticsEnv } from "../../worker/analytics/config";
export async function fixture(
  beforeAnalytics?: (db: D1Database) => Promise<void>,
) {
  const mf = new Miniflare({
    workers: [
      {
        config: {
          name: "analytics-test",
          type: "worker",
          compatibilityDate: "2026-09-17",
          manifest: {
            mainModule: "index.js",
            modules: {
              "index.js": {
                type: "esm",
                contents:
                  "export default {fetch(){return new Response('test')}}",
              },
            },
          },
          env: { DB: { type: "d1", id: "analytics-test" } },
        },
      },
    ],
  });
  const DB = (await mf.getD1Database("DB")) as unknown as D1Database;
  for (const file of (await readdir("infra/schema"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    if (file === "0006_product_analytics.sql") await beforeAnalytics?.(DB);
    const sql = (await readFile(`infra/schema/${file}`, "utf8"))
      .replace(/--[^\n]*/g, "")
      .replace(/\n/g, " ");
    await DB.exec(sql);
  }
  const env = {
    DB,
    APP_ENV: "production",
    ANALYTICS_ENABLED: "true",
    ANALYTICS_HOSTNAME: "example.test",
    OPENPANEL_ORIGIN: "https://analytics.example.test",
    OPENPANEL_CLIENT_ID: "11111111-1111-4111-8111-111111111111",
    OPENPANEL_CLIENT_SECRET: "test-secret",
    ANALYTICS_HASH_KEY: "test-key-".repeat(8),
  } as AnalyticsEnv;
  const member = async (id: string, verified = false) =>
    DB.prepare(
      "INSERT INTO members(id,email,name,password_hash,salt,email_verified_at) VALUES (?,?,?,'hash','salt',?)",
    )
      .bind(
        id,
        `${id}@example.test`,
        "Private Name",
        verified ? Date.now() : null,
      )
      .run();
  const trip = async (id: string, owner: string) =>
    DB.batch([
      DB.prepare(
        "INSERT INTO trips(id,title,owner_id,start_date,end_date,timezone,home_timezone,currency,home_currency) VALUES (?,'Private Trip',?,'2030-01-01','2030-01-02','UTC','UTC','USD','USD')",
      ).bind(id, owner),
      DB.prepare(
        "INSERT INTO trip_members VALUES (?,?,CURRENT_TIMESTAMP)",
      ).bind(id, owner),
    ]);
  return { env, DB, member, trip, close: () => mf.dispose() };
}
