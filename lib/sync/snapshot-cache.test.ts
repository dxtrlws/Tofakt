import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it, vi } from "vitest";
import * as schema from "../db/schema";
import { applySqlMigrations } from "../db/sql-migrations";
import { playsFromTraktItems } from "../stats/month";

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
}));

ctx.sqlite = new Database(":memory:");
ctx.sqlite.pragma("foreign_keys = ON");
applySqlMigrations(ctx.sqlite);
ctx.db = drizzle(ctx.sqlite, { schema });

import { listHistoryItemsInRange, upsertSnapshotRows } from "./reconcile";

describe("trakt history snapshot payloads", () => {
  it("round-trips extended history items for monthly reviews", () => {
    const watchedAt = new Date("2026-09-02T08:00:00.000Z");
    upsertSnapshotRows([
      {
        traktHistoryId: 2,
        kind: "movie",
        tmdbId: 916224,
        imdbId: null,
        tvdbId: null,
        showTmdbId: null,
        seasonNumber: null,
        episodeNumber: null,
        watchedAtUtc: watchedAt,
        payloadJson: JSON.stringify({
          id: 2,
          watched_at: watchedAt.toISOString(),
          type: "movie",
          movie: {
            title: "Suzume",
            runtime: 60,
            genres: ["drama"],
            ids: { tmdb: 916224 },
          },
        }),
      },
    ]);
    const items = listHistoryItemsInRange(
      new Date("2026-09-01T00:00:00.000Z"),
      new Date("2026-10-01T00:00:00.000Z"),
    );
    const plays = playsFromTraktItems(items);
    expect(plays).toHaveLength(1);
    expect(plays[0]?.title).toBe("Suzume");
    expect(plays[0]?.seconds).toBe(3600);
    expect(plays[0]?.genres).toEqual(["Drama"]);
  });
});
