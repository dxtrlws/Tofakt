import { and, eq } from "drizzle-orm";
import { writeAudit } from "../audit/audit";
import { refreshDueTokens } from "../connections/service";
import {
  getConnection,
  parseExtra,
  readAccessToken,
} from "../connections/store";
import { getSettingJson, setSettingJson } from "../data/settings";
import { getDb } from "../db";
import { jobRuns, jobs, mediaItems } from "../db/schema";
import { env } from "../env";
import { newId } from "../ids";
import { logger } from "../logger";
import { getSyncSettings } from "../sync/settings";
import { tmdbWatchProviders } from "../tmdb/client";
import { tofaUsersMe } from "../tofa/client";
import {
  findEpisode,
  type MediaDetail,
  type PlaySession,
  tofaMediaBatch,
  tofaMediaDetail,
  tofaWatchHistory,
  yearFromMedia,
} from "../tofa/history";
import { dedupeForPlay, tofaMediaKey } from "./dedupe";
import { evaluatePlay, playKind } from "./evaluate";
import { maxIso, overlapStartIso, shouldStopPaging } from "./paging";
import {
  type MediaUpsert,
  mediaNeedingProviders,
  replaceProviderSnapshots,
  type Thresholds,
  upsertMediaItem,
  upsertSyncRecord,
  upsertWatchEvent,
  watchEventCount,
} from "./persist";
import { reclassifyStoredPlays } from "./reclassify";

const PAGE_SIZE = 200;
const BATCH_SIZE = 40;
const DEFAULT_THRESHOLDS: Thresholds = { movie: 90, episode: 85 };

export type IngestStats = {
  pages: number;
  seen: number;
  inserted: number;
  updated: number;
  hydrated: number;
  enriched: number;
  stoppedReason: string;
  error?: string;
};

type Watermark = {
  lastStartedAtSeen: string | null;
};

export type IngestSettings = {
  movieThreshold: number;
  episodeThreshold: number;
  intervalMinutes: number;
  ingestEnabled: boolean;
};

let inFlight: Promise<IngestStats> | null = null;

export function getIngestSettings(): IngestSettings {
  const stored = getSettingJson<Partial<IngestSettings>>("ingest.settings");
  const movie = clamp(
    stored?.movieThreshold ?? DEFAULT_THRESHOLDS.movie,
    1,
    100,
  );
  const episode = clamp(
    stored?.episodeThreshold ?? DEFAULT_THRESHOLDS.episode,
    1,
    100,
  );
  const intervalMinutes = clamp(stored?.intervalMinutes ?? 5, 1, 60);
  return {
    movieThreshold: movie,
    episodeThreshold: episode,
    intervalMinutes,
    ingestEnabled: stored?.ingestEnabled !== false,
  };
}

export function getWatermark(): Watermark {
  return (
    getSettingJson<Watermark>("ingest.watermark") ?? { lastStartedAtSeen: null }
  );
}

export function lastIngestStats(): IngestStats | undefined {
  return getSettingJson<IngestStats>("ingest.last_stats");
}

export async function runIngest(): Promise<IngestStats> {
  if (inFlight) {
    return inFlight;
  }
  inFlight = runIngestUnlocked().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runIngestUnlocked(): Promise<IngestStats> {
  const started = new Date();
  const runId = newId();
  recordJobStart(runId, started);
  const stats: IngestStats = {
    pages: 0,
    seen: 0,
    inserted: 0,
    updated: 0,
    hydrated: 0,
    enriched: 0,
    stoppedReason: "done",
  };
  try {
    const auth = await resolveTofa();
    if (!auth) {
      throw new Error("tofa is not connected.");
    }
    const settings = getIngestSettings();
    const thresholds: Thresholds = {
      movie: settings.movieThreshold,
      episode: settings.episodeThreshold,
    };
    reclassifyStoredPlays(thresholds);
    let watermark = getWatermark().lastStartedAtSeen;
    const overlap = overlapStartIso(watermark);
    let before: string | undefined;
    const details = new Map<string, MediaDetail>();

    while (true) {
      const page = await tofaWatchHistory(auth.baseUrl, auth.token, {
        limit: PAGE_SIZE,
        before,
        admin: auth.admin,
        userId: auth.userId,
      });
      stats.pages += 1;
      stats.seen += page.items.length;
      if (page.items.length === 0) {
        stats.stoppedReason = "empty";
        break;
      }

      await hydrateUnknown(auth.baseUrl, auth.token, page.items, details);
      const pageResult = commitPage(page.items, details, thresholds);
      stats.inserted += pageResult.inserted;
      stats.updated += pageResult.updated;
      stats.hydrated += pageResult.hydrated;

      const newest = page.items[0]?.started_at ?? null;
      const oldest = page.items[page.items.length - 1]?.started_at ?? null;
      watermark = maxIso(watermark, newest);
      setSettingJson("ingest.watermark", { lastStartedAtSeen: watermark });

      if (
        shouldStopPaging({
          hasMore: page.hasMore,
          pageOldestStartedAt: oldest,
          overlapStartIso: overlap,
        })
      ) {
        stats.stoppedReason = page.hasMore ? "overlap" : "end";
        break;
      }
      before = oldest ?? undefined;
      if (!before) {
        stats.stoppedReason = "end";
        break;
      }
    }

    stats.enriched = await enrichProviders();
    finishJob(runId, "ok", stats, started);
    setSettingJson("ingest.last_stats", stats);
    logger.info({ stats }, "Ingest finished");
    return stats;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingest failed.";
    stats.error = message;
    stats.stoppedReason = "error";
    finishJob(runId, "error", stats, started, message);
    setSettingJson("ingest.last_stats", stats);
    logger.error({ err }, "Ingest failed");
    return stats;
  }
}

async function resolveTofa(): Promise<{
  baseUrl: string;
  token: string;
  admin: boolean;
  userId?: string;
} | null> {
  await refreshDueTokens();
  const row = getConnection("tofa");
  const token = row ? readAccessToken(row) : null;
  if (!row?.baseUrl || !token) {
    return null;
  }
  let admin = false;
  let userId: string | undefined;
  try {
    const me = await tofaUsersMe(row.baseUrl, token);
    admin = me.is_admin === true;
    userId = me.id;
  } catch {
    admin = false;
  }
  return { baseUrl: row.baseUrl, token, admin, userId };
}

async function hydrateUnknown(
  baseUrl: string,
  token: string,
  plays: PlaySession[],
  cache: Map<string, MediaDetail>,
): Promise<void> {
  const missing = [
    ...new Set(
      plays
        .map((play) => play.media_id)
        .filter((id): id is string => Boolean(id))
        .filter((id) => !cache.has(id)),
    ),
  ];
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const chunk = missing.slice(i, i + BATCH_SIZE);
    try {
      const details = await tofaMediaBatch(baseUrl, token, chunk);
      for (const detail of details) {
        cache.set(detail.id, detail);
      }
    } catch (err) {
      logger.warn({ err, n: chunk.length }, "Media batch failed; falling back");
      for (const id of chunk) {
        try {
          cache.set(id, await tofaMediaDetail(baseUrl, token, id));
        } catch (detailErr) {
          logger.warn({ err: detailErr, id }, "Media detail failed");
        }
      }
    }
  }
}

export function commitPage(
  plays: PlaySession[],
  details: Map<string, MediaDetail>,
  thresholds: Thresholds,
): { inserted: number; updated: number; hydrated: number } {
  const sync = getSyncSettings();
  let inserted = 0;
  let updated = 0;
  let hydrated = 0;
  for (const play of plays) {
    const media = mediaFromPlay(play, details.get(play.media_id ?? ""));
    if (details.has(play.media_id ?? "")) {
      hydrated += 1;
    }
    const mediaItemId = upsertMediaItem(media);
    const evaluated = evaluatePlay(play, media, thresholds, sync);
    if (evaluated.clamped) {
      logger.warn({ historyId: play.id }, "Clamped future watched_at to now");
    }
    const dedupe = dedupeForPlay({
      id: play.id,
      mediaId: play.media_id,
      watchedAt: evaluated.watchedAt,
    });
    const event = upsertWatchEvent(mediaItemId, {
      dedupeKey: dedupe.key,
      dedupeStrategy: dedupe.strategy,
      tofaHistoryId: play.id,
      tofaUserId: play.user_id ?? null,
      watchedAt: evaluated.watchedAt,
      timestampConvention: evaluated.convention,
      durationWatchedSeconds: evaluated.durationWatchedSeconds,
      completionPercent: evaluated.completionPercent,
      isComplete: evaluated.isComplete,
      deviceName: play.device_name || play.client_name || play.platform || null,
      rawJson: JSON.stringify(play),
    });
    if (event.inserted) {
      inserted += 1;
    } else {
      updated += 1;
    }
    upsertSyncRecord(
      event.id,
      media.kind,
      media,
      {
        progressPercent: play.progress_percent ?? evaluated.completionPercent,
        durationWatchedSeconds: evaluated.durationWatchedSeconds,
        runtimeSeconds: media.runtimeSeconds,
        isPlayback: evaluated.isPlayback,
        libraryExcluded: evaluated.libraryExcluded,
        beforeCutoff: evaluated.beforeCutoff,
      },
      thresholds,
    );
  }
  return { inserted, updated, hydrated };
}

function mediaFromPlay(
  play: PlaySession,
  detail: MediaDetail | undefined,
): MediaUpsert {
  const kind = playKind(play);
  const episode = detail
    ? findEpisode(
        detail,
        play.episode_id,
        play.season_number,
        play.episode_number,
      )
    : undefined;
  const title =
    kind === "episode"
      ? (play.episode_title ?? episode?.title ?? play.title)
      : (detail?.title ?? play.title);
  const runtimeMinutes =
    kind === "episode"
      ? (episode?.runtime_minutes ?? detail?.runtime_minutes)
      : detail?.runtime_minutes;
  return {
    kind,
    tofaMediaId: tofaMediaKey({
      mediaType: play.media_type,
      mediaId: play.media_id,
      episodeId: play.episode_id,
      seasonNumber: play.season_number,
      episodeNumber: play.episode_number,
      historyId: play.id,
    }),
    artworkMediaId: play.media_id ?? detail?.id ?? null,
    tmdbId:
      kind === "episode"
        ? (episode?.tmdb_episode_id ?? null)
        : (detail?.tmdb_id ?? null),
    imdbId: detail?.imdb_id ?? null,
    tvdbId: null,
    title,
    sortTitle: detail?.sort_title ?? null,
    year: detail ? yearFromMedia(detail) : null,
    runtimeSeconds:
      runtimeMinutes && runtimeMinutes > 0 ? runtimeMinutes * 60 : null,
    showTmdbId: kind === "episode" ? (detail?.tmdb_id ?? null) : null,
    showTitle: kind === "episode" ? play.title : null,
    seasonNumber: play.season_number ?? null,
    episodeNumber: play.episode_number ?? null,
    tofaLibraryId: detail?.library_id ?? null,
    genreNames: detail?.genres ?? [],
  };
}

async function enrichProviders(): Promise<number> {
  const tmdb = getConnection("tmdb");
  const key = tmdb ? readAccessToken(tmdb) : null;
  if (!key) {
    return 0;
  }
  const region = (parseExtra(tmdb).region ?? "US").toUpperCase();
  let n = 0;
  for (const item of mediaNeedingProviders()) {
    const tmdbId = item.kind === "movie" ? item.tmdbId : item.showTmdbId;
    if (!tmdbId) {
      continue;
    }
    try {
      const providers = await tmdbWatchProviders(
        key,
        item.kind === "movie" ? "movie" : "tv",
        tmdbId,
        region,
      );
      replaceProviderSnapshots(item.id, region, providers);
      getDb()
        .update(mediaItems)
        .set({ metadataSyncedAt: new Date() })
        .where(eq(mediaItems.id, item.id))
        .run();
      n += 1;
    } catch (err) {
      logger.warn({ err, mediaItemId: item.id }, "TMDB enrich skipped");
    }
  }
  return n;
}

function recordJobStart(id: string, started: Date): void {
  const existing = getDb()
    .select()
    .from(jobs)
    .where(eq(jobs.id, "ingest"))
    .get();
  if (existing) {
    getDb()
      .update(jobs)
      .set({
        status: "running",
        startedAt: started,
        finishedAt: null,
        error: null,
      })
      .where(eq(jobs.id, "ingest"))
      .run();
  } else {
    getDb()
      .insert(jobs)
      .values({
        id: "ingest",
        type: "ingest",
        status: "running",
        startedAt: started,
      })
      .run();
  }
  getDb()
    .insert(jobRuns)
    .values({
      id,
      jobId: "ingest",
      type: "ingest",
      status: "running",
      startedAt: started,
    })
    .run();
}

function finishJob(
  id: string,
  status: "ok" | "error",
  stats: IngestStats,
  started: Date,
  error?: string,
): void {
  const finished = new Date();
  const payload = JSON.stringify({ ...stats, total: watchEventCount() });
  getDb()
    .update(jobs)
    .set({
      status,
      finishedAt: finished,
      startedAt: started,
      statsJson: payload,
      error: error ?? null,
      itemsProcessed: stats.seen,
    })
    .where(eq(jobs.id, "ingest"))
    .run();
  getDb()
    .update(jobRuns)
    .set({
      status,
      finishedAt: finished,
      statsJson: payload,
      error: error ?? null,
      itemsProcessed: stats.seen,
    })
    .where(and(eq(jobRuns.id, id)))
    .run();
  writeAudit({
    actor: "system",
    action: status === "ok" ? "ingest.finished" : "ingest.failed",
    subjectType: "job",
    subjectId: id,
    detail: { ...stats, ms: finished.getTime() - started.getTime() },
  });
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function timezone(): string {
  return getSettingJson<string>("timezone") ?? env().TZ ?? "UTC";
}
