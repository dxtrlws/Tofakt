import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../db/schema";
import { syncRecords } from "../db/schema";
import { applySqlMigrations } from "../db/sql-migrations";
import {
  upsertMediaItem,
  upsertSyncRecord,
  upsertWatchEvent,
  watchEventCount,
} from "./persist";

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

describe("upsertWatchEvent", () => {
  beforeEach(() => {
    ctx.sqlite?.exec("delete from sync_records");
    ctx.sqlite?.exec("delete from watch_events");
    ctx.sqlite?.exec("delete from media_genres");
    ctx.sqlite?.exec("delete from media_items");
  });

  it("inserts the same history id twice as one row", () => {
    const mediaId = upsertMediaItem({
      kind: "movie",
      tofaMediaId: "movie-1",
      artworkMediaId: "movie-1",
      tmdbId: 1,
      imdbId: "tt1",
      tvdbId: null,
      title: "Suzume",
      sortTitle: "Suzume",
      year: 2022,
      runtimeSeconds: 7320,
      showTmdbId: null,
      showTitle: null,
      seasonNumber: null,
      episodeNumber: null,
      tofaLibraryId: "lib",
      genreNames: ["Drama"],
    });
    const payload = {
      dedupeKey: "history-1",
      dedupeStrategy: "tofa_history_id" as const,
      tofaHistoryId: "history-1",
      tofaUserId: null,
      watchedAt: new Date("2026-09-05T01:00:00.000Z"),
      timestampConvention: "completion",
      durationWatchedSeconds: 120,
      completionPercent: 1,
      isComplete: false,
      deviceName: "iPhone",
      rawJson: "{}",
    };
    const first = upsertWatchEvent(mediaId, payload);
    const second = upsertWatchEvent(mediaId, {
      ...payload,
      completionPercent: 2,
    });
    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    expect(second.id).toBe(first.id);
    expect(watchEventCount()).toBe(1);
  });
});

describe("upsertSyncRecord", () => {
  beforeEach(() => {
    ctx.sqlite?.exec("delete from sync_records");
    ctx.sqlite?.exec("delete from watch_events");
    ctx.sqlite?.exec("delete from media_genres");
    ctx.sqlite?.exec("delete from media_items");
  });

  it("does not reopen a synced record for another Trakt POST", () => {
    const media = {
      kind: "movie" as const,
      tofaMediaId: "movie-1",
      artworkMediaId: "movie-1",
      tmdbId: 27205,
      imdbId: "tt1",
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
    ctx.db
      ?.update(syncRecords)
      .set({ status: "synced", skipReason: null, remoteId: "99" })
      .where(eq(syncRecords.watchEventId, event.id))
      .run();
    upsertSyncRecord(
      event.id,
      "movie",
      media,
      {
        progressPercent: 100,
        durationWatchedSeconds: 8880,
        runtimeSeconds: 8880,
        isPlayback: true,
        reclassify: true,
      },
      { movie: 90, episode: 85 },
    );
    const row = ctx.db
      ?.select()
      .from(syncRecords)
      .where(eq(syncRecords.watchEventId, event.id))
      .get();
    expect(row?.status).toBe("synced");
    expect(row?.remoteId).toBe("99");
  });
});
