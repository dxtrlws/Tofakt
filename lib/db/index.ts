import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { env } from "../env";
import * as schema from "./schema";

let sqlite: Database.Database | undefined;
let drizzleDb: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function sqlitePath(): string {
  return env().DATABASE_PATH;
}

export function getSqlite(): Database.Database {
  if (sqlite) {
    return sqlite;
  }
  const path = sqlitePath();
  mkdirSync(dirname(path), { recursive: true });
  sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  return sqlite;
}

export function getDb() {
  if (drizzleDb) {
    return drizzleDb;
  }
  drizzleDb = drizzle(getSqlite(), { schema });
  return drizzleDb;
}

export function pingDatabase(): void {
  getSqlite().prepare("select 1").get();
}
