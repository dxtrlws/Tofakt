import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../db/schema";
import { applySqlMigrations } from "../db/sql-migrations";
import {
  upsertMediaItem,
  upsertSyncRecord,
  upsertWatchEvent,
} from "../ingest/persist";
import {
  clearSyncRecords,
  forgetProvider,
  mediaItemCount,
  syncRecordCount,
  watchEventTotal,
  wipeLocalHistory,
} from "./danger";

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
applySqlMigrations(ctx.sqlite);
ctx.db = drizzle(ctx.sqlite, { schema });

function seedPlay() {
  const media = {
    kind: "movie" as const,
    tofaMediaId: "movie-1",
    artworkMediaId: "movie-1",
    tmdbId: 1,
    imdbId: null,
    tvdbId: null,
    title: "Inception",
    sortTitle: "Inception",
    year: 2010,
    runtimeSeconds: 8880,
    showTmdbId: null,
    showTitle: null,
    seasonNumber: null,
    episodeNumber: null,
    tofaLibraryId: "lib",
    genreNames: [],
  };
  const mediaId = upsertMediaItem(media);
  const event = upsertWatchEvent(mediaId, {
    dedupeKey: "history-1",
    dedupeStrategy: "tofa_history_id",
    tofaHistoryId: "history-1",
    tofaUserId: null,
    watchedAt: new Date("2026-09-05T01:00:00.000Z"),
    timestampConvention: "completion",
    durationWatchedSeconds: 8880,
    completionPercent: 100,
    isComplete: true,
    deviceName: null,
    rawJson: "{}",
  });
  upsertSyncRecord(
    event.id,
    "movie",
    media,
    {
      progressPercent: 100,
      durationWatchedSeconds: 8880,
      runtimeSeconds: 8880,
      isPlayback: true,
    },
    { movie: 90, episode: 85 },
  );
}

describe("danger zone", () => {
  beforeEach(() => {
    ctx.sqlite?.exec("delete from sync_records");
    ctx.sqlite?.exec("delete from watch_events");
    ctx.sqlite?.exec("delete from media_genres");
    ctx.sqlite?.exec("delete from media_items");
    ctx.sqlite?.exec("delete from connections");
    ctx.sqlite?.exec("delete from settings");
  });

  it("clears sync records and keeps history", () => {
    seedPlay();
    expect(clearSyncRecords()).toBe(1);
    expect(syncRecordCount()).toBe(0);
    expect(watchEventTotal()).toBe(1);
  });

  it("wipes local history and keeps connections", () => {
    seedPlay();
    ctx.sqlite
      ?.prepare(
        "insert into connections (id, provider, status) values ('tofa', 'tofa', 'ok')",
      )
      .run();
    wipeLocalHistory();
    expect(watchEventTotal()).toBe(0);
    expect(mediaItemCount()).toBe(0);
    expect(syncRecordCount()).toBe(0);
    const connection = ctx.sqlite
      ?.prepare("select id from connections where provider = 'tofa'")
      .get();
    expect(connection).toEqual({ id: "tofa" });
  });

  it("keeps the audit log when wiping history", () => {
    ctx.sqlite
      ?.prepare(
        "insert into audit_log (id, at, actor, action) values ('keep', 1, 'user', 'prior')",
      )
      .run();
    wipeLocalHistory();
    const rows = ctx.sqlite
      ?.prepare("select id, action from audit_log")
      .all() as { id: string; action: string }[];
    expect(rows.some((row) => row.id === "keep")).toBe(true);
    expect(rows.some((row) => row.action === "data.wipe_local_history")).toBe(
      true,
    );
  });

  it("forgets a stored connection", () => {
    ctx.sqlite
      ?.prepare(
        "insert into connections (id, provider, status) values ('trakt', 'trakt', 'ok')",
      )
      .run();
    forgetProvider("trakt");
    expect(ctx.sqlite?.prepare("select id from connections").all()).toEqual([]);
  });
});
