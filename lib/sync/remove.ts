import { and, eq } from "drizzle-orm";
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
import { type TraktRemoveResponse, traktRemoveHistory } from "../trakt/history";
import { matchSnapshot } from "./match";
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
  cleared: number;
  skipped: number;
  error?: string;
};

type RemovablePlay = {
  eventId: string;
  remoteId: number | null;
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

export async function removeOnePlay(eventId: string): Promise<RemoveStats> {
  const play = loadPlay(eventId);
  if (!play || play.status !== "synced") {
    return {
      considered: 0,
      removed: 0,
      cleared: 0,
      skipped: 1,
      error: "This play is not synced to Trakt.",
    };
  }
  return removePlays([play]);
}

async function removePlays(plays: RemovablePlay[]): Promise<RemoveStats> {
  const stats: RemoveStats = {
    considered: plays.length,
    removed: 0,
    cleared: 0,
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
  const unresolved: RemovablePlay[] = [];
  for (const play of plays) {
    const remoteId = await resolveRemoteId(play, creds.clientId, access);
    if (remoteId == null) {
      unresolved.push(play);
      continue;
    }
    resolved.push({ ...play, remoteId });
  }
  if (unresolved.length > 0) {
    // Not on Trakt (or no resolvable history id) — clear the local synced
    // marker so the play can be queued again under the current sync mode.
    revertAfterRemove(unresolved);
    stats.cleared += unresolved.length;
  }
  if (resolved.length === 0) {
    return stats;
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
    const deletedIds = deletedHistoryIds(res.json, ids);
    const deletedSet = new Set(deletedIds);
    const succeeded = batch.filter((play) => deletedSet.has(play.remoteId));
    const missing = batch.filter((play) => !deletedSet.has(play.remoteId));
    if (succeeded.length > 0) {
      revertAfterRemove(succeeded);
      deleteSnapshotsByHistoryIds(deletedIds);
      stats.removed += succeeded.length;
    }
    if (missing.length > 0) {
      // Trakt did not have these history ids — demote local synced state.
      revertAfterRemove(missing);
      stats.cleared += missing.length;
      logger.warn(
        {
          ids: missing.map((play) => play.remoteId),
          notFound: res.json?.not_found?.ids,
        },
        "Trakt history remove found no matching plays; cleared local sync status",
      );
    }
  }
  logger.info(stats, "Removed play from Trakt");
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
  } catch (err) {
    logger.warn(
      { err, eventId: play.eventId },
      "Could not resolve Trakt history id",
    );
    return null;
  }
}

function deletedHistoryIds(
  json: TraktRemoveResponse | null,
  requestedIds: number[],
): number[] {
  const deletedCount =
    (json?.deleted?.movies ?? 0) + (json?.deleted?.episodes ?? 0);
  if (deletedCount === 0) {
    return [];
  }
  const notFound = new Set(json?.not_found?.ids ?? []);
  return requestedIds.filter((id) => !notFound.has(id));
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
    showTmdbId: row.showTmdbId,
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

function loadPlay(eventId: string): RemovablePlay | undefined {
  const row = getDb()
    .select({
      eventId: watchEvents.id,
      remoteId: syncRecords.remoteId,
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
    .where(
      and(
        eq(watchEvents.isComplete, true),
        eq(syncRecords.status, "synced"),
        eq(watchEvents.id, eventId),
      ),
    )
    .get();
  if (!row) {
    return undefined;
  }
  const remoteId = row.remoteId ? Number.parseInt(row.remoteId, 10) : null;
  return {
    eventId: row.eventId,
    remoteId: remoteId != null && Number.isFinite(remoteId) ? remoteId : null,
    status: row.status,
    kind: row.kind === "episode" ? "episode" : "movie",
    tmdbId: row.tmdbId,
    imdbId: row.imdbId,
    tvdbId: row.tvdbId,
    showTmdbId: row.showTmdbId,
    seasonNumber: row.seasonNumber,
    episodeNumber: row.episodeNumber,
    watchedAt: row.watchedAt,
  };
}
