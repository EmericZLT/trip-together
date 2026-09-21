import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { SqliteD1 } from "../backend/d1.ts";

test("batch 返回与 D1 一致的 meta.changes，避免首次保存支出被当成 500", async () => {
  const db = new SqliteD1(new Database(":memory:"));
  await db.prepare("CREATE TABLE items (id TEXT PRIMARY KEY, name TEXT)").run();
  const results = await db.batch([
    db.prepare("INSERT INTO items (id, name) VALUES (?, ?)").bind("a", "one"),
  ]);
  assert.equal(results[0].meta.changes, 1);
  const row = await db.prepare("SELECT name FROM items WHERE id=?").bind("a").first<{ name: string }>();
  assert.equal(row?.name, "one");
});
