import { and, eq, or } from "drizzle-orm";
import { getDb } from "../db";
import { mediaItems, syncRecords, watchEvents } from "../db/schema";
import { matchSnapshot, type SnapshotPlay } from "./match";
import { getSyncSettings } from "./settings";

export function markAlreadyOnTrakt(snapshots: SnapshotPlay[]): number {
  if (snapshots.length === 0) {
    return 0;
  }
  const windowMinutes = getSyncSettings().windowMinutes;
  const rows = getDb()
    .select({
      eventId: watchEvents.id,
      kind: mediaItems.kind,
      tmdbId: mediaItems.tmdbId,
      imdbId: mediaItems.imdbId,
      tvdbId: mediaItems.tvdbId,
      showTmdbId: mediaItems.showTmdbId,
      seasonNumber: mediaItems.seasonNumber,
      episodeNumber: mediaItems.episodeNumber,
      watchedAt: watchEvents.watchedAtUtc,
      skipReason: syncRecords.skipReason,
    })
    .from(watchEvents)
    .innerJoin(syncRecords, eq(syncRecords.watchEventId, watchEvents.id))
    .leftJoin(mediaItems, eq(mediaItems.id, watchEvents.mediaItemId))
    .where(
      and(
        eq(watchEvents.isComplete, true),
        or(eq(syncRecords.status, "pending"), eq(syncRecords.status, "failed")),
      ),
    )
    .all();

  const used = new Set<number>();
  let matched = 0;
  for (const row of rows) {
    if (row.skipReason === "user_ignored") {
      continue;
    }
    if (row.kind !== "movie" && row.kind !== "episode") {
      continue;
    }
    const available = snapshots.filter(
      (item) => item.traktHistoryId == null || !used.has(item.traktHistoryId),
    );
    const hit = matchSnapshot(
      {
        kind: row.kind,
        tmdbId: row.tmdbId,
        imdbId: row.imdbId,
        tvdbId: row.tvdbId,
        showTmdbId: row.showTmdbId,
        seasonNumber: row.seasonNumber,
        episodeNumber: row.episodeNumber,
        watchedAt: row.watchedAt,
      },
      available,
      windowMinutes,
    );
    if (!hit) {
      continue;
    }
    if (hit.traktHistoryId != null) {
      used.add(hit.traktHistoryId);
    }
    getDb()
      .update(syncRecords)
      .set({
        status: "synced",
        skipReason: "already_on_trakt",
        remoteId:
          hit.traktHistoryId != null ? String(hit.traktHistoryId) : null,
        syncedAt: new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
        nextAttemptAt: null,
      })
      .where(eq(syncRecords.watchEventId, row.eventId))
      .run();
    matched += 1;
  }
  return matched;
}
