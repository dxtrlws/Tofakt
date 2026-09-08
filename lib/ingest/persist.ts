import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import {
  genres,
  mediaGenres,
  mediaItems,
  providerSnapshots,
  syncRecords,
  watchEvents,
} from "../db/schema";
import { newId } from "../ids";
import { type EligibilityKind, eligibilityForEvent } from "./eligibility";

export type MediaUpsert = {
  kind: EligibilityKind;
  tofaMediaId: string;
  artworkMediaId: string | null;
  tmdbId: number | null;
  imdbId: string | null;
  tvdbId: number | null;
  title: string;
  sortTitle: string | null;
  year: number | null;
  runtimeSeconds: number | null;
  showTmdbId: number | null;
  showTitle: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  tofaLibraryId: string | null;
  genreNames: string[];
};

export type WatchUpsert = {
  dedupeKey: string;
  dedupeStrategy: "tofa_history_id" | "fingerprint";
  tofaHistoryId: string | null;
  tofaUserId: string | null;
  watchedAt: Date;
  timestampConvention: string;
  durationWatchedSeconds: number | null;
  completionPercent: number | null;
  isComplete: boolean;
  deviceName: string | null;
  rawJson: string;
};

export type Thresholds = {
  movie: number;
  episode: number;
};

export function findMediaByTofaId(tofaMediaId: string) {
  return getDb()
    .select()
    .from(mediaItems)
    .where(eq(mediaItems.tofaMediaId, tofaMediaId))
    .get();
}

export function upsertMediaItem(input: MediaUpsert): string {
  const existing = findMediaByTofaId(input.tofaMediaId);
  const artworkUrl = input.artworkMediaId
    ? `/api/artwork/${input.artworkMediaId}/poster`
    : null;
  const values = {
    kind: input.kind,
    tofaMediaId: input.tofaMediaId,
    tmdbId: input.tmdbId,
    imdbId: input.imdbId,
    tvdbId: input.tvdbId,
    title: input.title,
    sortTitle: input.sortTitle,
    year: input.year,
    runtimeSeconds: input.runtimeSeconds,
    showTmdbId: input.showTmdbId,
    showTitle: input.showTitle,
    seasonNumber: input.seasonNumber,
    episodeNumber: input.episodeNumber,
    artworkUrl,
    tofaLibraryId: input.tofaLibraryId,
    metadataSyncedAt: new Date(),
  };
  if (existing) {
    getDb()
      .update(mediaItems)
      .set(values)
      .where(eq(mediaItems.id, existing.id))
      .run();
    replaceGenres(existing.id, input.kind, input.genreNames);
    return existing.id;
  }
  const id = newId();
  getDb()
    .insert(mediaItems)
    .values({ id, ...values })
    .run();
  replaceGenres(id, input.kind, input.genreNames);
  return id;
}

function replaceGenres(
  mediaItemId: string,
  kind: EligibilityKind,
  names: string[],
): void {
  getDb()
    .delete(mediaGenres)
    .where(eq(mediaGenres.mediaItemId, mediaItemId))
    .run();
  const seen = new Set<string>();
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) {
      continue;
    }
    const id = `${kind}:${trimmed.toLowerCase()}`;
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    const existing = getDb()
      .select({ id: genres.id })
      .from(genres)
      .where(eq(genres.id, id))
      .get();
    if (!existing) {
      getDb().insert(genres).values({ id, name: trimmed, kind }).run();
    }
    getDb().insert(mediaGenres).values({ mediaItemId, genreId: id }).run();
  }
}

export function upsertWatchEvent(
  mediaItemId: string,
  input: WatchUpsert,
): { id: string; inserted: boolean } {
  const existing = getDb()
    .select()
    .from(watchEvents)
    .where(eq(watchEvents.dedupeKey, input.dedupeKey))
    .get();
  const fields = {
    mediaItemId,
    tofaHistoryId: input.tofaHistoryId,
    tofaUserId: input.tofaUserId,
    watchedAtUtc: input.watchedAt,
    timestampConvention: input.timestampConvention,
    durationWatchedSeconds: input.durationWatchedSeconds,
    completionPercent: input.completionPercent,
    isComplete: input.isComplete,
    deviceName: input.deviceName,
    rawJson: input.rawJson,
    dedupeStrategy: input.dedupeStrategy,
  };
  if (existing) {
    getDb()
      .update(watchEvents)
      .set(fields)
      .where(eq(watchEvents.id, existing.id))
      .run();
    return { id: existing.id, inserted: false };
  }
  const id = newId();
  getDb()
    .insert(watchEvents)
    .values({
      id,
      dedupeKey: input.dedupeKey,
      ingestedAt: new Date(),
      ...fields,
    })
    .run();
  return { id, inserted: true };
}

export function upsertSyncRecord(
  watchEventId: string,
  kind: EligibilityKind,
  media: {
    tmdbId: number | null;
    imdbId: string | null;
    tvdbId: number | null;
    showTmdbId: number | null;
    seasonNumber: number | null;
    episodeNumber: number | null;
  },
  completion: {
    progressPercent: number | null;
    durationWatchedSeconds: number | null;
    runtimeSeconds: number | null;
    isPlayback?: boolean;
    libraryExcluded?: boolean;
    beforeCutoff?: boolean;
    reclassify?: boolean;
  },
  thresholds: Thresholds,
): void {
  const existing = getDb()
    .select()
    .from(syncRecords)
    .where(eq(syncRecords.watchEventId, watchEventId))
    .get();
  if (
    existing &&
    (existing.status === "synced" ||
      existing.status === "syncing" ||
      existing.skipReason === "user_ignored")
  ) {
    return;
  }
  if (existing && existing.status === "failed" && !completion.reclassify) {
    return;
  }
  const result = eligibilityForEvent({
    kind,
    progressPercent: completion.progressPercent,
    durationWatchedSeconds: completion.durationWatchedSeconds,
    runtimeSeconds: completion.runtimeSeconds,
    movieThreshold: thresholds.movie,
    episodeThreshold: thresholds.episode,
    tmdbId: media.tmdbId,
    imdbId: media.imdbId,
    tvdbId: media.tvdbId,
    showTmdbId: media.showTmdbId,
    seasonNumber: media.seasonNumber,
    episodeNumber: media.episodeNumber,
    ignored: false,
    isPlayback: completion.isPlayback,
    libraryExcluded: completion.libraryExcluded,
    beforeCutoff: completion.beforeCutoff,
  });
  if (existing) {
    getDb()
      .update(syncRecords)
      .set({
        status: result.status,
        skipReason: result.skipReason,
      })
      .where(eq(syncRecords.id, existing.id))
      .run();
    return;
  }
  getDb()
    .insert(syncRecords)
    .values({
      id: newId(),
      watchEventId,
      target: "trakt",
      status: result.status,
      skipReason: result.skipReason,
    })
    .run();
}

export function watchEventCount(): number {
  return getDb().select().from(watchEvents).all().length;
}

export function knownHistoryIds(ids: string[]): Set<string> {
  if (ids.length === 0) {
    return new Set();
  }
  const rows = getDb()
    .select({ id: watchEvents.tofaHistoryId })
    .from(watchEvents)
    .where(inArray(watchEvents.tofaHistoryId, ids))
    .all();
  return new Set(
    rows.map((row) => row.id).filter((id): id is string => Boolean(id)),
  );
}

export function mediaNeedingProviders() {
  const items = getDb().select().from(mediaItems).all();
  return items.filter((row) => {
    if (!row.tmdbId && !row.showTmdbId) {
      return false;
    }
    const existing = getDb()
      .select({ id: providerSnapshots.id })
      .from(providerSnapshots)
      .where(eq(providerSnapshots.mediaItemId, row.id))
      .get();
    return !existing;
  });
}

export function replaceProviderSnapshots(
  mediaItemId: string,
  region: string,
  rows: {
    providerId: number | null;
    providerName: string;
    logoPath: string | null;
    monetizationType: "flatrate" | "rent" | "buy" | "ads" | "free";
  }[],
): void {
  getDb()
    .delete(providerSnapshots)
    .where(
      and(
        eq(providerSnapshots.mediaItemId, mediaItemId),
        eq(providerSnapshots.region, region),
        eq(providerSnapshots.isManualOverride, false),
      ),
    )
    .run();
  const now = new Date();
  for (const row of rows) {
    getDb()
      .insert(providerSnapshots)
      .values({
        id: newId(),
        mediaItemId,
        region,
        providerId: row.providerId,
        providerName: row.providerName,
        logoPath: row.logoPath,
        monetizationType: row.monetizationType,
        capturedAt: now,
        isManualOverride: false,
      })
      .run();
  }
}
