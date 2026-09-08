import { join } from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { logger } from "../logger";
import { getDb } from "./index";

export function runMigrations(): void {
  const migrationsFolder = join(process.cwd(), "drizzle");
  migrate(getDb(), { migrationsFolder });
  logger.info("Database migrations applied");
}
