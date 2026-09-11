import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../db/schema";
import { syncRecords } from "../db/schema";
import {
  upsertMediaItem,
  upsertSyncRecord,
  upsertWatchEvent,
} from "../ingest/persist";
import { WATCHLOG_POSTED } from "./posted";
import {
  listWatchlogPosted,
  removeOnePlay,
  watchlogPostedCount,
} from "./remove";

const ctx = vi.hoisted(() => ({
  sqlite: null as InstanceType<typeof Database> | null,
  db: null as ReturnType<typeof drizzle<typeof schema>> | null,
  connected: true,
  removes: [] as Array<{ ids: number[] }>,
  nextRemove: null as
    | null
    | (() => {
        status: number;
        json: Record<string, unknown> | null;
        headers: Record<string, string>;
        text: string;
      }),
}));

vi.mock("../db", () => ({
  getDb: () => {
    if (!ctx.db) {
      throw new Error("test db not ready");
    }
    return ctx.db;
  },
}));

vi.mock("../connections/service", () => ({
  refreshDueTokens: async () => undefined,
  refreshTraktConnection: async () => true,
}));

vi.mock("../connections/store", () => ({
  getConnection: () =>
    ctx.connected ? { id: "trakt", provider: "trakt" } : null,
  readAccessToken: () => (ctx.connected ? "access-token" : null),
  readTraktAppSecrets: () =>
    ctx.connected ? { clientId: "cid", clientSecret: "secret" } : null,
}));

vi.mock("../trakt/history", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../trakt/history")>();
  return {
    ...orig,
    traktRemoveHistory: async (
      _clientId: string,
      _token: string,
      body: { ids: number[] },
    ) => {
      ctx.removes.push(body);
      if (ctx.nextRemove) {
        return ctx.nextRemove();
      }
      return {
        status: 200,
        json: { deleted: { movies: body.ids.length, episodes: 0 } },
        headers: {},
        text: "",
      };
    },
  };
});

vi.mock("./reconcile", () => ({
  listSnapshots: () => [],
  fetchHistoryWindow: async () => [],
  deleteSnapshotsByHistoryIds: () => undefined,
}));

vi.mock("../logger", () => ({
  logger: { info() {}, warn() {}, error() {}, debug() {} },
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

function seedPlay(opts: {
  key: string;
  status: "synced" | "pending";
  skipReason: string | null;
  remoteId: string | null;
}) {
  const media = {
    kind: "movie" as const,
    tofaMediaId: opts.key,
    artworkMediaId: opts.key,
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
    dedupeKey: opts.key,
    dedupeStrategy: "tofa_history_id",
    tofaHistoryId: opts.key,
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
    .set({
      status: opts.status,
      skipReason: opts.skipReason,
      remoteId: opts.remoteId,
    })
    .where(eq(syncRecords.watchEventId, event.id))
    .run();
  return event.id;
}

function recordFor(eventId: string) {
  return (
    ctx.db
      ?.select()
      .from(syncRecords)
      .where(eq(syncRecords.watchEventId, eventId))
      .get() ?? null
  );
}

describe("Watchlog-posted undo set", () => {
  beforeEach(() => {
    ctx.connected = true;
    ctx.removes = [];
    ctx.nextRemove = null;
    ctx.sqlite?.exec("delete from sync_records");
    ctx.sqlite?.exec("delete from watch_events");
    ctx.sqlite?.exec("delete from media_genres");
    ctx.sqlite?.exec("delete from media_items");
  });

  it("counts only plays Watchlog posted, not ones already on Trakt", () => {
    seedPlay({
      key: "posted",
      status: "synced",
      skipReason: WATCHLOG_POSTED,
      remoteId: "11",
    });
    seedPlay({
      key: "already",
      status: "synced",
      skipReason: "already_on_trakt",
      remoteId: "22",
    });
    expect(watchlogPostedCount()).toBe(1);
    expect(listWatchlogPosted().map((row) => row.remoteId)).toEqual([11]);
  });
});

describe("removeOnePlay", () => {
  beforeEach(() => {
    ctx.connected = true;
    ctx.removes = [];
    ctx.nextRemove = null;
    ctx.sqlite?.exec("delete from settings");
    ctx.sqlite?.exec("delete from sync_records");
    ctx.sqlite?.exec("delete from watch_events");
    ctx.sqlite?.exec("delete from media_genres");
    ctx.sqlite?.exec("delete from media_items");
  });

  it("removes a synced play by Trakt history id and reverts the local row", async () => {
    const eventId = seedPlay({
      key: "posted",
      status: "synced",
      skipReason: WATCHLOG_POSTED,
      remoteId: "441",
    });
    const stats = await removeOnePlay(eventId);
    expect(stats).toMatchObject({
      considered: 1,
      removed: 1,
      skipped: 0,
    });
    expect(stats.error).toBeUndefined();
    expect(ctx.removes).toEqual([{ ids: [441] }]);
    const row = recordFor(eventId);
    expect(row?.status).toBe("pending");
    expect(row?.remoteId).toBeNull();
    expect(row?.skipReason).toBeNull();
  });

  it("does not call Trakt when the history id cannot be resolved", async () => {
    const eventId = seedPlay({
      key: "posted",
      status: "synced",
      skipReason: WATCHLOG_POSTED,
      remoteId: null,
    });
    const stats = await removeOnePlay(eventId);
    expect(ctx.removes).toEqual([]);
    expect(stats.removed).toBe(0);
    expect(stats.skipped).toBe(1);
    expect(stats.error).toMatch(/could not find this play on trakt/i);
    const row = recordFor(eventId);
    expect(row?.status).toBe("synced");
    expect(row?.remoteId).toBeNull();
  });

  it("keeps the local row synced when Trakt reports the id not found", async () => {
    const eventId = seedPlay({
      key: "posted",
      status: "synced",
      skipReason: WATCHLOG_POSTED,
      remoteId: "441",
    });
    ctx.nextRemove = () => ({
      status: 200,
      json: {
        deleted: { movies: 0, episodes: 0 },
        not_found: { ids: [441] },
      },
      headers: {},
      text: "",
    });
    const stats = await removeOnePlay(eventId);
    expect(ctx.removes).toEqual([{ ids: [441] }]);
    expect(stats.removed).toBe(0);
    expect(stats.error).toMatch(/did not find this play/i);
    const row = recordFor(eventId);
    expect(row?.status).toBe("synced");
    expect(row?.remoteId).toBe("441");
  });
});
