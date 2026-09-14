import { readFileSync } from "node:fs";
import { join } from "node:path";
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
import { commitPage } from "../ingest/run";
import type { MediaDetail, PlaySession } from "../tofa/history";
import { matchPendingAgainstSnapshot, upsertSnapshotRows } from "./reconcile";

const fixtures = join(process.cwd(), "lib/sync/fixtures");

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixtures, name), "utf8")) as T;
}

const history = loadJson<{ items: PlaySession[] }>("tofa-watch-history.json");
const mediaById = loadJson<Record<string, MediaDetail>>("tofa-media.json");

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

vi.mock("../logger", () => ({
  logger: { info() {}, warn() {}, error() {}, debug() {} },
}));

ctx.sqlite = new Database(":memory:");
ctx.sqlite.pragma("foreign_keys = ON");
applySqlMigrations(ctx.sqlite);
ctx.db = drizzle(ctx.sqlite, { schema });

function seedPendingMovie(watchedAt: Date) {
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

function seedSnapshot(watchedAt: Date) {
  upsertSnapshotRows([
    {
      traktHistoryId: 99,
      kind: "movie",
      tmdbId: 27205,
      imdbId: "tt1375666",
      tvdbId: null,
      showTmdbId: null,
      seasonNumber: null,
      episodeNumber: null,
      watchedAtUtc: watchedAt,
      payloadJson: null,
    },
  ]);
}

function detailsFor(plays: PlaySession[]): Map<string, MediaDetail> {
  const map = new Map<string, MediaDetail>();
  for (const play of plays) {
    const id = play.media_id ?? "";
    const detail = mediaById[id];
    if (detail) {
      map.set(id, detail);
    }
  }
  return map;
}

describe("matchPendingAgainstSnapshot", () => {
  beforeEach(() => {
    ctx.sqlite?.exec("delete from sync_records");
    ctx.sqlite?.exec("delete from watch_events");
    ctx.sqlite?.exec("delete from media_genres");
    ctx.sqlite?.exec("delete from media_items");
    ctx.sqlite?.exec("delete from trakt_history_snapshot");
    ctx.sqlite?.exec("delete from settings");
  });

  it("marks a pending play synced when a matching Trakt snapshot exists", () => {
    const watchedAt = new Date("2026-09-04T02:31:00.000Z");
    const eventId = seedPendingMovie(watchedAt);
    seedSnapshot(new Date("2026-09-04T02:55:00.000Z"));
    expect(matchPendingAgainstSnapshot()).toBe(1);
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
    const eventId = seedPendingMovie(watchedAt);
    seedSnapshot(new Date("2026-09-04T04:00:00.000Z"));
    expect(matchPendingAgainstSnapshot()).toBe(0);
    const row = ctx.db
      ?.select()
      .from(syncRecords)
      .where(eq(syncRecords.watchEventId, eventId))
      .get();
    expect(row?.status).toBe("pending");
  });

  it("marks a Tofa ingest pending after a matching snapshot is already stored", () => {
    seedSnapshot(new Date("2026-09-04T04:28:00.000Z"));
    const plays = history.items.filter((play) => play.id === "play-inception");
    const result = commitPage(plays, detailsFor(plays), {
      movie: 90,
      episode: 85,
    });
    expect(result.inserted).toBe(1);
    expect(matchPendingAgainstSnapshot()).toBe(1);
    const row = ctx.db?.select().from(syncRecords).all()[0];
    expect(row?.status).toBe("synced");
    expect(row?.skipReason).toBe("already_on_trakt");
    expect(row?.remoteId).toBe("99");
  });
});
