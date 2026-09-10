import { eq, inArray } from "drizzle-orm";
import { ZodError } from "zod";
import { refreshDueTokens } from "../connections/service";
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
import { type TraktHistoryItem, traktGetHistoryPage } from "../trakt/history";
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
};

export async function pullTraktHistory(): Promise<{
  count: number;
  matched: number;
  error?: string;
}> {
  const started = new Date();
  const result = await pullTraktHistoryUnlocked();
  recordReconcileJob(started, result);
  return result;
}

async function pullTraktHistoryUnlocked(): Promise<{
  count: number;
  matched: number;
  error?: string;
}> {
  await refreshDueTokens();
  const row = getConnection("trakt");
  const app = row ? readTraktAppSecrets(row) : null;
  const token = row ? readAccessToken(row) : null;
  if (!app || !token) {
    return { count: 0, matched: 0, error: "Trakt is not connected." };
  }
  const fetchedAt = new Date();
  const items: SnapshotRow[] = [];
  try {
    for (const type of ["movies", "episodes"] as const) {
      let page = 1;
      let pageCount = 1;
      while (page <= pageCount) {
        const res = await traktGetHistoryPage(app.clientId, token, type, page);
        if (res.status === 401) {
          throw new UpstreamError("Trakt token was rejected.", 401);
        }
        if (res.status >= 400) {
          throw new UpstreamError("Could not load Trakt history.", res.status);
        }
        pageCount = Math.max(1, res.pageCount);
        for (const item of res.items) {
          const mapped = mapHistoryItem(item, type);
          if (mapped) {
            items.push(mapped);
          }
        }
        if (res.items.length === 0) {
          break;
        }
        page += 1;
      }
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
  const matched = markAlreadyOnTrakt(items.map(toSnapshotPlay));
  logger.info(
    { count: items.length, matched },
    "Stored Trakt history snapshot",
  );
  return { count: items.length, matched };
}

function recordReconcileJob(
  started: Date,
  result: { count: number; error?: string },
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
  for (const type of ["movies", "episodes"] as const) {
    let page = 1;
    let pageCount = 1;
    while (page <= pageCount) {
      const res = await traktGetHistoryPage(
        clientId,
        accessToken,
        type,
        page,
        100,
        range,
      );
      if (res.status >= 400) {
        throw new UpstreamError("Could not load Trakt history.", res.status);
      }
      pageCount = Math.max(1, res.pageCount);
      for (const item of res.items) {
        const mapped = mapHistoryItem(item, type);
        if (mapped) {
          items.push(mapped);
        }
      }
      if (res.items.length === 0) {
        break;
      }
      page += 1;
    }
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
  return getDb()
    .select()
    .from(traktHistorySnapshot)
    .all()
    .map((row) => ({
      traktHistoryId: row.traktHistoryId,
      kind: row.kind === "episode" ? "episode" : "movie",
      tmdbId: row.tmdbId,
      imdbId: row.imdbId,
      tvdbId: row.tvdbId,
      showTmdbId: null,
      seasonNumber: row.seasonNumber,
      episodeNumber: row.episodeNumber,
      watchedAtUtc: row.watchedAtUtc,
    }));
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
        seasonNumber: item.seasonNumber,
        episodeNumber: item.episodeNumber,
        watchedAtUtc: item.watchedAtUtc,
        action: "watch",
        fetchedAt,
      })
      .run();
  }
}

function mapHistoryItem(
  item: TraktHistoryItem,
  type: "movies" | "episodes",
): SnapshotRow | null {
  const watchedAt = item.watched_at ? new Date(item.watched_at) : null;
  if (type === "movies") {
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
  };
}

export function reconciliationWindowMinutes(): number {
  return getSyncSettings().windowMinutes;
}
