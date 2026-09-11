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
} from "../ingest/persist";
import { markAlreadyOnTrakt } from "./already";

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

function seedMovie(watchedAt: Date) {
  const media = {
    kind: "movie" as const,
    tofaMediaId: "movie-1",
    artworkMediaId: "movie-1",
    tmdbId: 27205,
    imdbId: "tt1375666",
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
    dedupeKey: "history-inception",
    dedupeStrategy: "tofa_history_id",
    tofaHistoryId: "history-inception",
    tofaUserId: null,
    watchedAt,
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
  return event.id;
}

describe("markAlreadyOnTrakt", () => {
  beforeEach(() => {
    ctx.sqlite?.exec("delete from sync_records");
    ctx.sqlite?.exec("delete from watch_events");
    ctx.sqlite?.exec("delete from media_genres");
    ctx.sqlite?.exec("delete from media_items");
    ctx.sqlite?.exec("delete from settings");
  });

  it("marks a pending play synced when Trakt already has it inside the window", () => {
    const watchedAt = new Date("2026-09-04T02:31:00.000Z");
    const eventId = seedMovie(watchedAt);
    const matched = markAlreadyOnTrakt([
      {
        traktHistoryId: 99,
        kind: "movie",
        tmdbId: 27205,
        imdbId: null,
        tvdbId: null,
        seasonNumber: null,
        episodeNumber: null,
        watchedAt: new Date("2026-09-04T02:55:00.000Z"),
      },
    ]);
    expect(matched).toBe(1);
    const row = ctx.db
      ?.select()
      .from(syncRecords)
      .where(eq(syncRecords.watchEventId, eventId))
      .get();
    expect(row?.status).toBe("synced");
    expect(row?.skipReason).toBe("already_on_trakt");
    expect(row?.remoteId).toBe("99");
  });

  it("leaves a pending play pending when the Trakt timestamp is outside the window", () => {
    const watchedAt = new Date("2026-09-04T02:31:00.000Z");
    const eventId = seedMovie(watchedAt);
    const matched = markAlreadyOnTrakt([
      {
        traktHistoryId: 99,
        kind: "movie",
        tmdbId: 27205,
        imdbId: null,
        tvdbId: null,
        seasonNumber: null,
        episodeNumber: null,
        watchedAt: new Date("2026-09-04T04:00:00.000Z"),
      },
    ]);
    expect(matched).toBe(0);
    const row = ctx.db
      ?.select()
      .from(syncRecords)
      .where(eq(syncRecords.watchEventId, eventId))
      .get();
    expect(row?.status).toBe("pending");
  });
});
