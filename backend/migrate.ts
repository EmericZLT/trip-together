import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Database as Sqlite } from "better-sqlite3";

export async function applyMigrations(db: Sqlite, dir: string) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  );
  const files = (await readdir(dir))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const applied = new Set(
    (
      db.prepare("SELECT id FROM schema_migrations").all() as { id: string }[]
    ).map((row) => row.id),
  );
  for (const file of files) {
    if (applied.has(file)) continue;
    db.exec(await readFile(join(dir, file), "utf8"));
    db.prepare("INSERT INTO schema_migrations (id) VALUES (?)").run(file);
  }
}
