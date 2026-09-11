import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type Database from "better-sqlite3";

export function applySqlMigrations(
  sqlite: Database.Database,
  folder = join(process.cwd(), "drizzle"),
): void {
  const files = readdirSync(folder)
    .filter((name) => /^\d+_.*\.sql$/.test(name))
    .sort();
  for (const file of files) {
    const sql = readFileSync(join(folder, file), "utf8");
    for (const part of sql.split("--> statement-breakpoint")) {
      const trimmed = part.trim();
      if (trimmed) {
        sqlite.exec(trimmed);
      }
    }
  }
}
