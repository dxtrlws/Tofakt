import { and, eq, inArray, sql } from "drizzle-orm";
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
import { mediaItems, syncRecords, watchEvents } from "../db/schema";
import { logger } from "../logger";
import { traktRemoveHistory } from "../trakt/history";
import { matchSnapshot } from "./match";
import { isWatchlogPosted } from "./posted";
import {
  deleteSnapshotsByHistoryIds,
  fetchHistoryWindow,
  listSnapshots,
} from "./reconcile";
import { getSyncSettings } from "./settings";

const BATCH = 100;

export type RemoveStats = {
  considered: number;
  removed: number;
  skipped: number;
  error?: string;
};

type RemovablePlay = {
  eventId: string;
  remoteId: number | null;
  skipReason: string | null;
  status: string;
  kind: "movie" | "episode";
  tmdbId: number | null;
  imdbId: string | null;
  tvdbId: number | null;
  showTmdbId: number | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  watchedAt: Date;
};

export function watchlogPostedCount(): number {
  const row = getDb()
    .select({ n: sql<number>`count(*)` })
    .from(syncRecords)
    .innerJoin(watchEvents, eq(watchEvents.id, syncRecords.watchEventId))
    .where(
      and(
        eq(syncRecords.status, "synced"),
        eq(syncRecords.skipReason, "watchlog_posted"),
        eq(watchEvents.isComplete, true),
      ),
    )
    .get();
  return Number(row?.n ?? 0);
}

export function listWatchlogPosted(): RemovablePlay[] {
  return loadPlays().filter(isWatchlogPosted);
}

export async function removeWatchlogPosts(): Promise<RemoveStats> {
  return removePlays(listWatchlogPosted(), { watchlogPostedOnly: true });
}

export async function removeOnePlay(eventId: string): Promise<RemoveStats> {
  const play = loadPlays([eventId])[0];
  if (!play || play.status !== "synced") {
    return { considered: 0, removed: 0, skipped: 1 };
  }
  return removePlays([play], { watchlogPostedOnly: false });
}

async function removePlays(
  plays: RemovablePlay[],
  opts: { watchlogPostedOnly: boolean },
): Promise<RemoveStats> {
  const stats: RemoveStats = {
    considered: plays.length,
    removed: 0,
    skipped: 0,
  };
  if (plays.length === 0) {
    return stats;
  }
  await refreshDueTokens();
  const creds = traktCreds();
  if (!creds) {
    return { ...stats, error: "Trakt is not connected." };
  }
  let access = creds.token;
  const resolved: Array<RemovablePlay & { remoteId: number }> = [];
  for (const play of plays) {
    if (opts.watchlogPostedOnly && !isWatchlogPosted(play)) {
      stats.skipped += 1;
      continue;
    }
    const remoteId = await resolveRemoteId(play, creds.clientId, access);
    if (remoteId == null) {
      stats.skipped += 1;
      continue;
    }
    resolved.push({ ...play, remoteId });
  }
  for (let i = 0; i < resolved.length; i += BATCH) {
    const batch = resolved.slice(i, i + BATCH);
    const ids = batch.map((play) => play.remoteId);
    let res = await traktRemoveHistory(creds.clientId, access, { ids });
    if (res.status === 401) {
      const refreshed = await refreshTraktConnection();
      const latest = getConnection("trakt");
      const nextToken = latest ? readAccessToken(latest) : null;
      if (!refreshed || !nextToken) {
        stats.error = "Trakt needs to be reconnected.";
        return stats;
      }
      access = nextToken;
      res = await traktRemoveHistory(creds.clientId, access, { ids });
    }
    if (res.status >= 400) {
      stats.error = res.text || "Could not remove plays from Trakt.";
      logger.error(
        { status: res.status, text: res.text },
        "Trakt history remove failed",
      );
      return stats;
    }
    revertAfterRemove(batch);
    deleteSnapshotsByHistoryIds(ids);
    stats.removed += batch.length;
  }
  logger.info(stats, "Removed Watchlog plays from Trakt");
  return stats;
}

async function resolveRemoteId(
  play: RemovablePlay,
  clientId: string,
  accessToken: string,
): Promise<number | null> {
  if (play.remoteId != null) {
    return play.remoteId;
  }
  const windowMinutes = getSyncSettings().windowMinutes;
  const local = matchSnapshot(play, snapshotPlays(), windowMinutes);
  if (local?.traktHistoryId != null) {
    persistRemoteId(play.eventId, local.traktHistoryId);
    return local.traktHistoryId;
  }
  try {
    const padMs = windowMinutes * 60_000;
    const remote = await fetchHistoryWindow(clientId, accessToken, {
      startAt: new Date(play.watchedAt.getTime() - padMs),
      endAt: new Date(play.watchedAt.getTime() + padMs),
    });
    const hit = matchSnapshot(
      play,
      remote.map((row) => ({
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
    if (hit?.traktHistoryId == null) {
      return null;
    }
    persistRemoteId(play.eventId, hit.traktHistoryId);
    return hit.traktHistoryId;
  } catch {
    return null;
  }
}

function persistRemoteId(eventId: string, remoteId: number): void {
  getDb()
    .update(syncRecords)
    .set({ remoteId: String(remoteId) })
    .where(eq(syncRecords.watchEventId, eventId))
    .run();
}

function revertAfterRemove(
  plays: Array<{ eventId: string; watchedAt: Date }>,
): void {
  const settings = getSyncSettings();
  const cutoff =
    settings.mode === "forward" && settings.cutoffIso
      ? Date.parse(settings.cutoffIso)
      : null;
  for (const play of plays) {
    const heldBack = cutoff != null && play.watchedAt.getTime() < cutoff;
    getDb()
      .update(syncRecords)
      .set({
        status: heldBack ? "skipped" : "pending",
        skipReason: heldBack ? "before_cutoff" : null,
        remoteId: null,
        syncedAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        nextAttemptAt: null,
      })
      .where(eq(syncRecords.watchEventId, play.eventId))
      .run();
  }
}

function snapshotPlays() {
  return listSnapshots().map((row) => ({
    traktHistoryId: row.traktHistoryId,
    kind: row.kind,
    tmdbId: row.tmdbId,
    imdbId: row.imdbId,
    tvdbId: row.tvdbId,
    seasonNumber: row.seasonNumber,
    episodeNumber: row.episodeNumber,
    watchedAt: row.watchedAtUtc,
  }));
}

function traktCreds(): { clientId: string; token: string } | null {
  const row = getConnection("trakt");
  const app = row ? readTraktAppSecrets(row) : null;
  const token = row ? readAccessToken(row) : null;
  if (!app || !token) {
    return null;
  }
  return { clientId: app.clientId, token };
}

function loadPlays(eventIds?: string[]): RemovablePlay[] {
  const filters = [
    eq(watchEvents.isComplete, true),
    eq(syncRecords.status, "synced"),
  ];
  if (eventIds?.length) {
    filters.push(inArray(watchEvents.id, eventIds));
  }
  return getDb()
    .select({
      eventId: watchEvents.id,
      remoteId: syncRecords.remoteId,
      skipReason: syncRecords.skipReason,
      status: syncRecords.status,
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
    .where(and(...filters))
    .all()
    .map((row) => ({
      eventId: row.eventId,
      remoteId: row.remoteId ? Number.parseInt(row.remoteId, 10) : null,
      skipReason: row.skipReason,
      status: row.status,
      kind: row.kind === "episode" ? ("episode" as const) : ("movie" as const),
      tmdbId: row.tmdbId,
      imdbId: row.imdbId,
      tvdbId: row.tvdbId,
      showTmdbId: row.showTmdbId,
      seasonNumber: row.seasonNumber,
      episodeNumber: row.episodeNumber,
      watchedAt: row.watchedAt,
    }))
    .map((row) => ({
      ...row,
      remoteId:
        row.remoteId != null && Number.isFinite(row.remoteId)
          ? row.remoteId
          : null,
    }));
}
