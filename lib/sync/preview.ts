import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { mediaItems, syncRecords, watchEvents } from "../db/schema";
import { historyCount } from "../history/query";
import { matchSnapshot } from "./match";
import { listSnapshots } from "./reconcile";
import { getSyncSettings } from "./settings";

export type BackfillPreview = {
  history: number;
  eligible: number;
  unmatched: number;
  alreadyOnTrakt: number;
  estimatedSeconds: number;
  earliestAt: string | null;
  latestAt: string | null;
  snapshotCount: number;
};

export function backfillPreview(): BackfillPreview {
  const history = historyCount();
  const unmatched = countByStatus("unmatched");
  const snapshots = listSnapshots();
  const windowMinutes = getSyncSettings().windowMinutes;
  const pending = pendingPlays();
  let alreadyOnTrakt = countAlreadyMarked();
  let eligible = 0;
  let earliest: Date | null = null;
  let latest: Date | null = null;
  for (const play of pending) {
    if (!earliest || play.watchedAt < earliest) {
      earliest = play.watchedAt;
    }
    if (!latest || play.watchedAt > latest) {
      latest = play.watchedAt;
    }
    const hit = matchSnapshot(
      {
        kind: play.kind,
        tmdbId: play.tmdbId,
        imdbId: play.imdbId,
        tvdbId: play.tvdbId,
        showTmdbId: play.showTmdbId,
        seasonNumber: play.seasonNumber,
        episodeNumber: play.episodeNumber,
        watchedAt: play.watchedAt,
      },
      snapshots.map((row) => ({
        traktHistoryId: row.traktHistoryId,
        kind: row.kind,
        tmdbId: row.tmdbId,
        imdbId: row.imdbId,
        tvdbId: row.tvdbId,
        seasonNumber: row.seasonNumber,
        episodeNumber: row.episodeNumber,
        watchedAt: row.watchedAtUtc,
      })),
      windowMinutes,
    );
    if (hit) {
      alreadyOnTrakt += 1;
    } else {
      eligible += 1;
    }
  }
  return {
    history,
    eligible,
    unmatched,
    alreadyOnTrakt,
    estimatedSeconds: Math.max(0, Math.ceil(eligible / 100)),
    earliestAt: earliest ? earliest.toISOString() : null,
    latestAt: latest ? latest.toISOString() : null,
    snapshotCount: snapshots.length,
  };
}

function countByStatus(
  status: "pending" | "synced" | "failed" | "unmatched" | "skipped",
): number {
  const row = getDb()
    .select({ n: sql<number>`count(*)` })
    .from(syncRecords)
    .innerJoin(watchEvents, eq(watchEvents.id, syncRecords.watchEventId))
    .where(
      and(eq(syncRecords.status, status), eq(watchEvents.isComplete, true)),
    )
    .get();
  return Number(row?.n ?? 0);
}

export function pendingCount(): number {
  return countByStatus("pending");
}

function countAlreadyMarked(): number {
  const already = getDb()
    .select({ n: sql<number>`count(*)` })
    .from(syncRecords)
    .innerJoin(watchEvents, eq(watchEvents.id, syncRecords.watchEventId))
    .where(
      and(
        eq(syncRecords.status, "synced"),
        eq(syncRecords.skipReason, "already_on_trakt"),
        eq(watchEvents.isComplete, true),
      ),
    )
    .get();
  return Number(already?.n ?? 0);
}

function pendingPlays() {
  return getDb()
    .select({
      kind: mediaItems.kind,
      tmdbId: mediaItems.tmdbId,
      imdbId: mediaItems.imdbId,
      tvdbId: mediaItems.tvdbId,
      showTmdbId: mediaItems.showTmdbId,
      seasonNumber: mediaItems.seasonNumber,
      episodeNumber: mediaItems.episodeNumber,
      watchedAt: watchEvents.watchedAtUtc,
    })
    .from(watchEvents)
    .innerJoin(syncRecords, eq(syncRecords.watchEventId, watchEvents.id))
    .leftJoin(mediaItems, eq(mediaItems.id, watchEvents.mediaItemId))
    .where(
      and(eq(syncRecords.status, "pending"), eq(watchEvents.isComplete, true)),
    )
    .all()
    .filter((row) => row.kind === "movie" || row.kind === "episode")
    .map((row) => ({
      kind: row.kind === "episode" ? ("episode" as const) : ("movie" as const),
      tmdbId: row.tmdbId,
      imdbId: row.imdbId,
      tvdbId: row.tvdbId,
      showTmdbId: row.showTmdbId,
      seasonNumber: row.seasonNumber,
      episodeNumber: row.episodeNumber,
      watchedAt: row.watchedAt,
    }));
}

export function clearBeforeCutoff(): void {
  getDb()
    .update(syncRecords)
    .set({ status: "pending", skipReason: null })
    .where(eq(syncRecords.skipReason, "before_cutoff"))
    .run();
}

export function applyForwardCutoff(cutoff: Date): void {
  const rows = getDb()
    .select({
      id: syncRecords.id,
      watchedAt: watchEvents.watchedAtUtc,
      status: syncRecords.status,
      skipReason: syncRecords.skipReason,
    })
    .from(syncRecords)
    .innerJoin(watchEvents, eq(watchEvents.id, syncRecords.watchEventId))
    .all();
  for (const row of rows) {
    if (row.status === "synced" || row.skipReason === "user_ignored") {
      continue;
    }
    if (row.watchedAt.getTime() < cutoff.getTime()) {
      getDb()
        .update(syncRecords)
        .set({ status: "skipped", skipReason: "before_cutoff" })
        .where(eq(syncRecords.id, row.id))
        .run();
    }
  }
}
