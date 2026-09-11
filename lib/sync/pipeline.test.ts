import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../db/schema";
import { syncRecords, watchEvents } from "../db/schema";
import { applySqlMigrations } from "../db/sql-migrations";
import { commitPage } from "../ingest/run";
import type { MediaDetail, PlaySession } from "../tofa/history";
import { runSync } from "./run";
import { saveSyncSettings } from "./settings";

const fixtures = join(process.cwd(), "lib/sync/fixtures");

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixtures, name), "utf8")) as T;
}

const history = loadJson<{ items: PlaySession[] }>("tofa-watch-history.json");
const mediaById = loadJson<Record<string, MediaDetail>>("tofa-media.json");
const tmdbInception = loadJson<{ id: number; imdb_id: string }>(
  "tmdb-movie-inception.json",
);
const postAdded = loadJson<Record<string, unknown>>("trakt-post-added.json");
const postNotFound = loadJson<Record<string, unknown>>(
  "trakt-post-not-found.json",
);

const ctx = vi.hoisted(() => ({
  sqlite: null as InstanceType<typeof Database> | null,
  db: null as ReturnType<typeof drizzle<typeof schema>> | null,
  token: "access-token",
  posts: [] as Array<{ token: string; body: unknown }>,
  pulls: 0,
  nextPost: null as
    | null
    | ((token: string) => {
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
  getSqlite: () => {
    if (!ctx.sqlite) {
      throw new Error("test db not ready");
    }
    return ctx.sqlite;
  },
}));

vi.mock("../connections/service", () => ({
  refreshDueTokens: async () => undefined,
  refreshTraktConnection: async () => {
    ctx.token = "refreshed-token";
    return true;
  },
}));

vi.mock("../connections/store", () => ({
  getConnection: () => ({ id: "trakt", provider: "trakt" }),
  readAccessToken: () => ctx.token,
  readTraktAppSecrets: () => ({ clientId: "cid", clientSecret: "secret" }),
}));

vi.mock("../trakt/history", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../trakt/history")>();
  return {
    ...orig,
    traktPostHistory: async (
      _clientId: string,
      token: string,
      body: unknown,
    ) => {
      ctx.posts.push({ token, body });
      if (ctx.nextPost) {
        return ctx.nextPost(token);
      }
      return { status: 200, json: {}, headers: {}, text: "" };
    },
  };
});

vi.mock("./posted", async (importOriginal) => {
  const orig = await importOriginal<typeof import("./posted")>();
  return {
    ...orig,
    capturePostedRemoteIds: async () => undefined,
  };
});

vi.mock("./reconcile", () => ({
  pullTraktHistory: async () => {
    ctx.pulls += 1;
    return { count: 0, matched: 0 };
  },
  listSnapshots: () => [],
  snapshotCount: () => 0,
  snapshotFetchedAt: () => null,
  snapshotMissingPayload: () => false,
  fetchHistoryWindow: async () => [],
  upsertSnapshotRows: () => undefined,
  toSnapshotPlay: (row: unknown) => row,
}));

vi.mock("../logger", () => ({
  logger: { info() {}, warn() {}, error() {}, debug() {} },
}));

ctx.sqlite = new Database(":memory:");
ctx.sqlite.pragma("foreign_keys = ON");
applySqlMigrations(ctx.sqlite);
ctx.db = drizzle(ctx.sqlite, { schema });

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

function ingest(ids: string[]) {
  const plays = history.items.filter((play) => ids.includes(play.id));
  return commitPage(plays, detailsFor(plays), { movie: 90, episode: 85 });
}

function records() {
  return ctx.db?.select().from(syncRecords).all() ?? [];
}

describe("ingest → sync fixtures", () => {
  beforeEach(() => {
    ctx.token = "access-token";
    ctx.posts = [];
    ctx.pulls = 0;
    ctx.nextPost = null;
    ctx.sqlite?.exec("delete from job_runs");
    ctx.sqlite?.exec("delete from jobs");
    ctx.sqlite?.exec("delete from audit_log");
    ctx.sqlite?.exec("delete from settings");
    ctx.sqlite?.exec("delete from sync_records");
    ctx.sqlite?.exec("delete from watch_events");
    ctx.sqlite?.exec("delete from media_genres");
    ctx.sqlite?.exec("delete from provider_snapshots");
    ctx.sqlite?.exec("delete from media_items");
  });

  it("does not post pending plays without an explicit Run sync now", async () => {
    ingest(["play-inception", "play-silo"]);
    saveSyncSettings({
      mode: "forward",
      cutoffIso: "2020-01-01T00:00:00.000Z",
    });
    const idle = await runSync();
    expect(idle.posted).toBe(0);
    expect(ctx.posts).toHaveLength(0);
    expect(records().every((row) => row.status === "pending")).toBe(true);
  });

  it("posts complete tofa plays once and ignores a second ingest", async () => {
    expect(tmdbInception.id).toBe(27205);
    const first = ingest(["play-inception", "play-silo"]);
    expect(first.inserted).toBe(2);
    const second = ingest(["play-inception", "play-silo"]);
    expect(second.inserted).toBe(0);
    expect(ctx.db?.select().from(watchEvents).all()).toHaveLength(2);

    ctx.nextPost = () => ({
      status: 200,
      json: postAdded,
      headers: {},
      text: "",
    });
    const stats = await runSync({ force: true });
    expect(stats.posted).toBe(2);
    expect(stats.synced).toBe(2);
    expect(ctx.posts).toHaveLength(1);

    const again = await runSync({ force: true });
    expect(again.posted).toBe(0);
    expect(ctx.posts).toHaveLength(1);
    expect(records().every((row) => row.status === "synced")).toBe(true);
  });

  it("does not reopen synced plays after a later ingest", async () => {
    ingest(["play-inception", "play-silo"]);
    ctx.nextPost = () => ({
      status: 200,
      json: postAdded,
      headers: {},
      text: "",
    });
    await runSync({ force: true });
    ingest(["play-inception", "play-silo"]);
    const stats = await runSync({ force: true });
    expect(stats.posted).toBe(0);
    expect(ctx.posts).toHaveLength(1);
  });

  it("marks a Trakt not_found movie unmatched and keeps the rest synced", async () => {
    ingest(["play-inception", "play-ghost"]);
    ctx.nextPost = () => ({
      status: 200,
      json: postNotFound,
      headers: {},
      text: "",
    });
    const stats = await runSync({ force: true });
    expect(stats.synced).toBe(1);
    expect(stats.unmatched).toBe(1);
    const byTitle = new Map(
      (ctx.db?.select().from(watchEvents).all() ?? []).map((row) => [
        row.tofaHistoryId,
        row.id,
      ]),
    );
    const inceptionId = byTitle.get("play-inception");
    const ghostId = byTitle.get("play-ghost");
    const inception = records().find((row) => row.watchEventId === inceptionId);
    const ghost = records().find((row) => row.watchEventId === ghostId);
    expect(inception?.status).toBe("synced");
    expect(ghost?.status).toBe("unmatched");
  });

  it("holds a 429 batch with Retry-After and does not mark it synced", async () => {
    ingest(["play-inception", "play-silo"]);
    ctx.nextPost = () => ({
      status: 429,
      json: null,
      headers: { "retry-after": "12" },
      text: "rate limited",
    });
    const stats = await runSync({ force: true });
    expect(stats.failed).toBe(2);
    expect(stats.synced).toBe(0);
    expect(ctx.posts).toHaveLength(1);
    for (const row of records()) {
      expect(row.status).toBe("pending");
      expect(row.lastErrorCode).toBe("429");
      expect(row.nextAttemptAt).toBeInstanceOf(Date);
    }
  });

  it("refreshes an expired token mid-batch and posts once with the new token", async () => {
    ingest(["play-inception", "play-silo"]);
    ctx.nextPost = (token) => {
      if (token === "access-token") {
        return { status: 401, json: null, headers: {}, text: "expired" };
      }
      return { status: 200, json: postAdded, headers: {}, text: "" };
    };
    const stats = await runSync({ force: true });
    expect(stats.synced).toBe(2);
    expect(ctx.posts.map((post) => post.token)).toEqual([
      "access-token",
      "refreshed-token",
    ]);
  });

  it("leaves plays without external ids unmatched without posting", async () => {
    ingest(["play-unknown"]);
    const stats = await runSync({ force: true });
    expect(stats.posted).toBe(0);
    expect(records()[0]?.status).toBe("unmatched");
    expect(ctx.posts).toHaveLength(0);
  });

  it("does not pull full Trakt history when syncing one play", async () => {
    ingest(["play-inception"]);
    ctx.nextPost = () => ({
      status: 200,
      json: postAdded,
      headers: {},
      text: "",
    });
    const eventId = ctx.db?.select().from(watchEvents).all()[0]?.id;
    expect(eventId).toBeTruthy();
    const stats = await runSync({
      eventIds: [eventId ?? ""],
      ignoreCutoff: true,
      force: true,
    });
    expect(ctx.pulls).toBe(0);
    expect(stats.posted).toBe(1);
    expect(ctx.posts).toHaveLength(1);
  });
});
