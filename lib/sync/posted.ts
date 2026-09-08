import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { syncRecords } from "../db/schema";
import { type MatchablePlay, matchSnapshot, type SnapshotPlay } from "./match";
import { fetchHistoryWindow } from "./reconcile";
import { getSyncSettings } from "./settings";

export const WATCHLOG_POSTED = "watchlog_posted";

export function isWatchlogPosted(record: {
  status: string;
  skipReason: string | null;
}): boolean {
  return record.status === "synced" && record.skipReason === WATCHLOG_POSTED;
}

export function assignRemoteIds(
  posted: Array<{ eventId: string } & MatchablePlay>,
  snapshots: SnapshotPlay[],
  windowMinutes: number,
): Array<{ eventId: string; remoteId: number }> {
  const hits: Array<{ eventId: string; remoteId: number }> = [];
  const used = new Set<number>();
  for (const play of posted) {
    const hit = matchSnapshot(play, snapshots, windowMinutes);
    if (hit?.traktHistoryId == null || used.has(hit.traktHistoryId)) {
      continue;
    }
    used.add(hit.traktHistoryId);
    hits.push({ eventId: play.eventId, remoteId: hit.traktHistoryId });
  }
  return hits;
}

export async function capturePostedRemoteIds(
  clientId: string,
  accessToken: string,
  posted: Array<{ eventId: string } & MatchablePlay>,
): Promise<void> {
  if (posted.length === 0) {
    return;
  }
  const times = posted.map((play) => play.watchedAt.getTime());
  const windowMinutes = getSyncSettings().windowMinutes;
  const padMs = windowMinutes * 60_000;
  const snapshots = await fetchHistoryWindow(clientId, accessToken, {
    startAt: new Date(Math.min(...times) - padMs),
    endAt: new Date(Math.max(...times) + padMs),
  });
  const mapped = snapshots.map((row) => ({
    traktHistoryId: row.traktHistoryId,
    kind: row.kind,
    tmdbId: row.tmdbId,
    imdbId: row.imdbId,
    tvdbId: row.tvdbId,
    seasonNumber: row.seasonNumber,
    episodeNumber: row.episodeNumber,
    watchedAt: row.watchedAtUtc,
  }));
  for (const hit of assignRemoteIds(posted, mapped, windowMinutes)) {
    getDb()
      .update(syncRecords)
      .set({ remoteId: String(hit.remoteId) })
      .where(eq(syncRecords.watchEventId, hit.eventId))
      .run();
  }
}
