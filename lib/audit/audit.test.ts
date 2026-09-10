import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../db/schema";
import { formatAuditLabel, listAudit, writeAudit } from "./audit";

const ctx = vi.hoisted(() => ({
  sqlite: null as InstanceType<typeof Database> | null,
  db: null as ReturnType<typeof drizzle<typeof schema>> | null,
}));

vi.mock("../db", () => ({
  getDb: () => {
    if (!ctx.db) {
      throw new Error("test db not ready");
    }
    return ctx.db;
  },
  getSqlite: () => {
    if (!ctx.sqlite) {
      throw new Error("test sqlite not ready");
    }
    return ctx.sqlite;
  },
}));

vi.mock("../logger", () => ({
  logger: {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  },
}));

ctx.sqlite = new Database(":memory:");
ctx.sqlite.pragma("foreign_keys = ON");
const folder = join(process.cwd(), "drizzle");
for (const file of ["0000_fat_dust.sql", "0001_sad_jackpot.sql"]) {
  const sql = readFileSync(join(folder, file), "utf8");
  for (const part of sql.split("--> statement-breakpoint")) {
    const trimmed = part.trim();
    if (trimmed) {
      ctx.sqlite.exec(trimmed);
    }
  }
}
ctx.db = drizzle(ctx.sqlite, { schema });

describe("audit log", () => {
  beforeEach(() => {
    ctx.sqlite?.exec("delete from audit_log");
  });

  it("stores user actions newest first", () => {
    writeAudit({
      action: "data.save_prefs",
      subjectType: "settings",
      detail: { weekStarts: "monday" },
    });
    writeAudit({
      actor: "system",
      action: "ingest.finished",
      subjectType: "job",
      detail: { inserted: 12 },
    });
    const rows = listAudit();
    expect(rows).toHaveLength(2);
    expect(rows[0]?.action).toBe("ingest.finished");
    expect(rows[0]?.actor).toBe("system");
    expect(rows[1]?.action).toBe("data.save_prefs");
    expect(rows[1]?.detailJson).toContain("monday");
  });
});

describe("formatAuditLabel", () => {
  it("uses a readable sentence for known actions", () => {
    expect(formatAuditLabel("data.save_prefs")).toBe("Saved data preferences");
    expect(formatAuditLabel("custom.thing")).toBe("custom thing");
  });
});
