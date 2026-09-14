import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { ZodError } from "zod";
import {
  refreshDueTokens,
  refreshTraktConnection,
} from "../connections/service";
import {
  getConnection,
  readAccessToken,
  readTraktAppSecrets,
} from "../connections/store";
import { getDb } from "../db";
import { jobRuns, jobs, traktHistorySnapshot } from "../db/schema";
import { newId } from "../ids";
import { logger } from "../logger";
import { UpstreamError } from "../net/fetch-json";
import {
  parseTraktHistoryItems,
  type TraktHistoryItem,
  traktGetHistoryPage,
} from "../trakt/history";
import { markAlreadyOnTrakt } from "./already";
import type { SnapshotPlay } from "./match";
import { getSyncSettings } from "./settings";

export type SnapshotRow = {
  traktHistoryId: number | null;
  kind: "movie" | "episode";
  tmdbId: number | null;
  imdbId: string | null;
  tvdbId: number | null;
  showTmdbId: number | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  watchedAtUtc: Date | null;
  payloadJson: string | null;
};

export type PullTraktHistoryResult = {
  count: number;
  matched: number;
  error?: string;
};

let inFlight: Promise<PullTraktHistoryResult> | null = null;

export async function pullTraktHistory(): Promise<PullTraktHistoryResult> {
  if (inFlight) {
    return inFlight;
  }
  inFlight = pullTraktHistoryUnlocked().finally(() => {
    inFlight = null;
  });
  const started = new Date();
  const result = await inFlight;
  recordReconcileJob(started, result);
  return result;
}

async function pullTraktHistoryUnlocked(): Promise<PullTraktHistoryResult> {
  await refreshDueTokens();
  let row = getConnection("trakt");
  const app = row ? readTraktAppSecrets(row) : null;
  let token = row ? readAccessToken(row) : null;
  if (!app || !token) {
    return { count: 0, matched: 0, error: "Trakt is not connected." };
  }
  const fetchedAt = new Date();
  const items: SnapshotRow[] = [];
  try {
    let page = 1;
    let pageCount = 1;
    while (page <= pageCount) {
      let res = await traktGetHistoryPage(
        app.clientId,
        token,
        null,
        page,
        100,
        {
          extended: true,
        },
      );
      if (res.status === 401) {
        const refreshed = await refreshTraktConnection();
        row = getConnection("trakt");
        token = row ? readAccessToken(row) : null;
        if (!refreshed || !token) {
          throw new UpstreamError("Trakt token was rejected.", 401);
        }
        res = await traktGetHistoryPage(app.clientId, token, null, page, 100, {
          extended: true,
        });
      }
      if (res.status === 401) {
        throw new UpstreamError("Trakt token was rejected.", 401);
      }
      if (res.status >= 400) {
        throw new UpstreamError("Could not load Trakt history.", res.status);
      }
      pageCount = Math.max(1, res.pageCount);
      for (const item of res.items) {
        const mapped = mapHistoryItem(item);
        if (mapped) {
          items.push(mapped);
        }
      }
      if (res.items.length === 0) {
        break;
      }
      page += 1;
    }
  } catch (err) {
    logger.error({ err }, "Trakt history pull failed");
    if (err instanceof ZodError) {
      return {
        count: 0,
        matched: 0,
        error: "Trakt sent a history page Watchlog could not parse.",
      };
    }
    const message =
      err instanceof Error ? err.message : "Trakt history failed.";
    return { count: 0, matched: 0, error: message };
  }
  replaceSnapshots(items, fetchedAt);
  const matched = matchPendingAgainstSnapshot(items);
  logger.info(
    { count: items.length, matched },
    "Stored Trakt history snapshot",
  );
  return { count: items.length, matched };
}

function recordReconcileJob(
  started: Date,
  result: PullTraktHistoryResult,
): void {
  const existing = getDb()
    .select()
    .from(jobs)
    .where(eq(jobs.id, "reconcile"))
    .get();
  const payload = JSON.stringify(result);
  const finished = new Date();
  const status = result.error ? "error" : "ok";
  if (existing) {
    getDb()
      .update(jobs)
      .set({
        status,
        startedAt: started,
        finishedAt: finished,
        statsJson: payload,
        error: result.error ?? null,
        itemsProcessed: result.count,
      })
      .where(eq(jobs.id, "reconcile"))
      .run();
  } else {
    getDb()
      .insert(jobs)
      .values({
        id: "reconcile",
        type: "reconcile",
        status,
        startedAt: started,
        finishedAt: finished,
        statsJson: payload,
        error: result.error ?? null,
        itemsProcessed: result.count,
      })
      .run();
  }
  getDb()
    .insert(jobRuns)
    .values({
      id: newId(),
      jobId: "reconcile",
      type: "reconcile",
      status,
      startedAt: started,
      finishedAt: finished,
      statsJson: payload,
      error: result.error ?? null,
      itemsProcessed: result.count,
    })
    .run();
}

export async function fetchHistoryWindow(
  clientId: string,
  accessToken: string,
  range: { startAt: Date; endAt: Date },
): Promise<SnapshotRow[]> {
  const items: SnapshotRow[] = [];
  let page = 1;
  let pageCount = 1;
  while (page <= pageCount) {
    const res = await traktGetHistoryPage(
      clientId,
      accessToken,
      null,
      page,
      100,
      { ...range, extended: true },
    );
    if (res.status >= 400) {
      throw new UpstreamError("Could not load Trakt history.", res.status);
    }
    pageCount = Math.max(1, res.pageCount);
    for (const item of res.items) {
      const mapped = mapHistoryItem(item);
      if (mapped) {
        items.push(mapped);
      }
    }
    if (res.items.length === 0) {
      break;
    }
    page += 1;
  }
  return items;
}

export function deleteSnapshotsByHistoryIds(ids: number[]): void {
  if (ids.length === 0) {
    return;
  }
  getDb()
    .delete(traktHistorySnapshot)
    .where(inArray(traktHistorySnapshot.traktHistoryId, ids))
    .run();
}

export function listSnapshots(): SnapshotRow[] {
  return getDb().select().from(traktHistorySnapshot).all().map(rowToSnapshot);
}

export function snapshotCount(): number {
  const row = getDb()
    .select({ n: sql<number>`count(*)` })
    .from(traktHistorySnapshot)
    .get();
  return Number(row?.n ?? 0);
}

export function snapshotFetchedAt(): Date | null {
  const row = getDb()
    .select({ fetchedAt: sql<number>`max(${traktHistorySnapshot.fetchedAt})` })
    .from(traktHistorySnapshot)
    .get();
  if (row?.fetchedAt == null) {
    return null;
  }
  const at = new Date(row.fetchedAt);
  return Number.isNaN(at.getTime()) ? null : at;
}

export function snapshotMissingPayload(): boolean {
  const row = getDb()
    .select({ n: sql<number>`count(*)` })
    .from(traktHistorySnapshot)
    .where(
      or(
        isNull(traktHistorySnapshot.payloadJson),
        eq(traktHistorySnapshot.payloadJson, ""),
      ),
    )
    .get();
  return Number(row?.n ?? 0) > 0;
}

export function listHistoryItemsInRange(
  start: Date,
  end: Date,
): TraktHistoryItem[] {
  return parsePayloadRows(
    getDb()
      .select()
      .from(traktHistorySnapshot)
      .where(
        and(
          gte(traktHistorySnapshot.watchedAtUtc, start),
          lt(traktHistorySnapshot.watchedAtUtc, end),
        ),
      )
      .orderBy(asc(traktHistorySnapshot.watchedAtUtc))
      .all(),
  );
}

export function countHistoryItemsInRange(start: Date, end: Date): number {
  const row = getDb()
    .select({ n: sql<number>`count(*)` })
    .from(traktHistorySnapshot)
    .where(
      and(
        gte(traktHistorySnapshot.watchedAtUtc, start),
        lt(traktHistorySnapshot.watchedAtUtc, end),
      ),
    )
    .get();
  return Number(row?.n ?? 0);
}

export function listRecentHistoryItems(limit: number): TraktHistoryItem[] {
  return parsePayloadRows(
    getDb()
      .select()
      .from(traktHistorySnapshot)
      .orderBy(desc(traktHistorySnapshot.watchedAtUtc))
      .limit(limit)
      .all(),
  );
}

export function upsertSnapshotRows(items: SnapshotRow[]): void {
  const fetchedAt = new Date();
  for (const item of items) {
    if (item.traktHistoryId != null) {
      getDb()
        .delete(traktHistorySnapshot)
        .where(eq(traktHistorySnapshot.traktHistoryId, item.traktHistoryId))
        .run();
    }
    getDb()
      .insert(traktHistorySnapshot)
      .values({
        id: newId(),
        traktHistoryId: item.traktHistoryId,
        kind: item.kind,
        tmdbId: item.tmdbId,
        imdbId: item.imdbId,
        tvdbId: item.tvdbId,
        showTmdbId: item.showTmdbId,
        seasonNumber: item.seasonNumber,
        episodeNumber: item.episodeNumber,
        watchedAtUtc: item.watchedAtUtc,
        action: "watch",
        payloadJson: item.payloadJson,
        fetchedAt,
      })
      .run();
  }
}

export function toSnapshotPlay(row: SnapshotRow): SnapshotPlay {
  return {
    traktHistoryId: row.traktHistoryId,
    kind: row.kind,
    tmdbId: row.tmdbId,
    imdbId: row.imdbId,
    tvdbId: row.tvdbId,
    showTmdbId: row.showTmdbId,
    seasonNumber: row.seasonNumber,
    episodeNumber: row.episodeNumber,
    watchedAt: row.watchedAtUtc,
  };
}

export function matchPendingAgainstSnapshot(
  rows: SnapshotRow[] = listSnapshots(),
): number {
  return markAlreadyOnTrakt(rows.map(toSnapshotPlay));
}

function replaceSnapshots(items: SnapshotRow[], fetchedAt: Date): void {
  getDb().delete(traktHistorySnapshot).run();
  for (const item of items) {
    getDb()
      .insert(traktHistorySnapshot)
      .values({
        id: newId(),
        traktHistoryId: item.traktHistoryId,
        kind: item.kind,
        tmdbId: item.tmdbId,
        imdbId: item.imdbId,
        tvdbId: item.tvdbId,
        showTmdbId: item.showTmdbId,
        seasonNumber: item.seasonNumber,
        episodeNumber: item.episodeNumber,
        watchedAtUtc: item.watchedAtUtc,
        action: "watch",
        payloadJson: item.payloadJson,
        fetchedAt,
      })
      .run();
  }
}

export function mapHistoryItem(item: TraktHistoryItem): SnapshotRow | null {
  const watchedAt = item.watched_at ? new Date(item.watched_at) : null;
  const isMovie = item.type === "movie" || Boolean(item.movie && !item.episode);
  if (isMovie) {
    const ids = item.movie?.ids;
    return {
      traktHistoryId: item.id ?? null,
      kind: "movie",
      tmdbId: ids?.tmdb ?? null,
      imdbId: ids?.imdb ?? null,
      tvdbId: ids?.tvdb ?? null,
      showTmdbId: null,
      seasonNumber: null,
      episodeNumber: null,
      watchedAtUtc:
        watchedAt && !Number.isNaN(watchedAt.getTime()) ? watchedAt : null,
      payloadJson: JSON.stringify(item),
    };
  }
  const episodeIds = item.episode?.ids;
  const showIds = item.show?.ids;
  return {
    traktHistoryId: item.id ?? null,
    kind: "episode",
    tmdbId: episodeIds?.tmdb ?? showIds?.tmdb ?? null,
    imdbId: episodeIds?.imdb ?? showIds?.imdb ?? null,
    tvdbId: episodeIds?.tvdb ?? showIds?.tvdb ?? null,
    showTmdbId: showIds?.tmdb ?? null,
    seasonNumber: item.episode?.season ?? null,
    episodeNumber: item.episode?.number ?? null,
    watchedAtUtc:
      watchedAt && !Number.isNaN(watchedAt.getTime()) ? watchedAt : null,
    payloadJson: JSON.stringify(item),
  };
}

function rowToSnapshot(row: {
  traktHistoryId: number | null;
  kind: string | null;
  tmdbId: number | null;
  imdbId: string | null;
  tvdbId: number | null;
  showTmdbId: number | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  watchedAtUtc: Date | null;
  payloadJson: string | null;
}): SnapshotRow {
  return {
    traktHistoryId: row.traktHistoryId,
    kind: row.kind === "episode" ? "episode" : "movie",
    tmdbId: row.tmdbId,
    imdbId: row.imdbId,
    tvdbId: row.tvdbId,
    showTmdbId: row.showTmdbId,
    seasonNumber: row.seasonNumber,
    episodeNumber: row.episodeNumber,
    watchedAtUtc: row.watchedAtUtc,
    payloadJson: row.payloadJson,
  };
}

function parsePayloadRows(
  rows: Array<{ payloadJson: string | null }>,
): TraktHistoryItem[] {
  const raw: unknown[] = [];
  for (const row of rows) {
    if (!row.payloadJson) {
      continue;
    }
    try {
      raw.push(JSON.parse(row.payloadJson) as unknown);
    } catch {
      // skip a corrupt cache row
    }
  }
  if (raw.length === 0) {
    return [];
  }
  return parseTraktHistoryItems(raw);
}

export function reconciliationWindowMinutes(): number {
  return getSyncSettings().windowMinutes;
}
