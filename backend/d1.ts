import Database from "better-sqlite3";

type Sqlite = InstanceType<typeof Database>;
type RunResult = { success: true; meta: { changes: number; last_row_id: number } };

export class SqliteD1 {
  constructor(private db: Sqlite) {
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }

  prepare(sql: string) {
    return new SqliteStatement(this.db, sql);
  }

  async batch(statements: SqliteStatement[]) {
    const run = this.db.transaction(() =>
      statements.map((statement) => statement.runResult()),
    );
    return run();
  }
}

export class SqliteStatement {
  constructor(
    private db: Sqlite,
    private sql: string,
    private params: unknown[] = [],
  ) {}

  bind(...params: unknown[]) {
    return new SqliteStatement(this.db, this.sql, params);
  }

  execute() {
    return this.db.prepare(this.sql).run(...this.params);
  }

  runResult(): RunResult {
    const info = this.execute();
    return {
      success: true,
      meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) },
    };
  }

  async first<T>(column?: string): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.params) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    if (column) return (row[column] as T) ?? null;
    return row as T;
  }

  async all<T = Record<string, unknown>>() {
    const results = this.db.prepare(this.sql).all(...this.params) as T[];
    return { results, success: true as const };
  }

  async run(): Promise<RunResult> {
    return this.runResult();
  }
}
