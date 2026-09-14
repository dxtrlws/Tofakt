import { and, asc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { writeAudit } from "../audit/audit";
import {
  refreshDueTokens,
  refreshTraktConnection,
} from "../connections/service";
import {
  getConnection,
  readAccessToken,
  readTraktAppSecrets,
} from "../connections/store";
import { getSettingJson, setSettingJson } from "../data/settings";
import { getDb } from "../db";
import {
  jobRuns,
  jobs,
  mediaItems,
  syncRecords,
  watchEvents,
} from "../db/schema";
import { newId } from "../ids";
import { logger } from "../logger";
import { HISTORY_TTL_MS } from "../trakt/cache";
import { retryAfterMs, traktPostHistory } from "../trakt/history";
import { markAlreadyOnTrakt } from "./already";
import { MAX_SYNC_ATTEMPTS, nextAttemptAt, shouldRetryStatus } from "./backoff";
import { matchSnapshot } from "./match";
import { buildHistoryBody, type SyncCandidate } from "./payload";
import { capturePostedRemoteIds, WATCHLOG_POSTED } from "./posted";
import {
  fetchHistoryWindow,
  listSnapshots,
  pullTraktHistory,
  snapshotCount,
  snapshotFetchedAt,
  snapshotMissingPayload,
  toSnapshotPlay,
  upsertSnapshotRows,
} from "./reconcile";
import { applyPostResponse } from "./response";
import { shouldPostRecord } from "./sendable";
import { getCircuit, getSyncSettings, saveCircuit } from "./settings";

const BATCH = 100;
const CIRCUIT_FAILURES = 5;
const CIRCUIT_PAUSE_MS = 15 * 60_000;

function snapshotIsStale(now = Date.now()): boolean {
  const at = snapshotFetchedAt();
  if (!at) {
    return true;
  }
  return now - at.getTime() > HISTORY_TTL_MS;
}

export type SyncStats = {
  considered: number;
  alreadyOnTrakt: number;
  posted: number;
  synced: number;
  unmatched: number;
  failed: number;
  skipped: number;
  error?: string;
};

let inFlight: Promise<SyncStats> | null = null;

export async function runSync(opts?: {
  eventIds?: string[];
  ignoreCutoff?: boolean;
  force?: boolean;
}): Promise<SyncStats> {
  if (inFlight) {
    return inFlight;
  }
  inFlight = runSyncUnlocked(opts).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function lastSyncStats(): SyncStats | undefined {
  return getSettingJson<SyncStats>("sync.last_stats");
}

async function runSyncUnlocked(opts?: {
  eventIds?: string[];
  ignoreCutoff?: boolean;
  force?: boolean;
}): Promise<SyncStats> {
  const started = new Date();
  const stats: SyncStats = {
    considered: 0,
    alreadyOnTrakt: 0,
    posted: 0,
    synced: 0,
    unmatched: 0,
    failed: 0,
    skipped: 0,
  };
  const circuit = getCircuit();
  if (
    circuit.pausedUntil &&
    circuit.pausedUntil > Date.now() &&
    !opts?.eventIds
  ) {
    stats.error = "Trakt sync is paused after repeated failures.";
    persistStats(stats, started);
    return stats;
  }
  await refreshDueTokens();
  const row = getConnection("trakt");
  const app = row ? readTraktAppSecrets(row) : null;
  const token = row ? readAccessToken(row) : null;
  if (!app || !token) {
    stats.error = "Trakt is not connected.";
    persistStats(stats, started);
    return stats;
  }
  if (!opts?.eventIds && !opts?.force) {
    persistStats(stats, started);
    return stats;
  }
  const settings = getSyncSettings();

  const targeted = Boolean(opts?.eventIds?.length);
  if (!targeted) {
    const needsPull =
      snapshotCount() === 0 || snapshotMissingPayload() || snapshotIsStale();
    if (needsPull) {
      const pulled = await pullTraktHistory();
      if (pulled.error) {
        stats.error = pulled.error;
        bumpCircuit();
        persistStats(stats, started);
        return stats;
      }
      stats.alreadyOnTrakt += pulled.matched;
      stats.synced += pulled.matched;
    }
    const matched = markAlreadyOnTrakt(listSnapshots().map(toSnapshotPlay));
    stats.alreadyOnTrakt += matched;
    stats.synced += matched;
  }
  let snapshots = listSnapshots();
  const windowMinutes = settings.windowMinutes;
  const candidates = loadCandidates(opts?.eventIds, opts?.ignoreCutoff);
  stats.considered = candidates.length;

  if (targeted && snapshots.length === 0 && candidates.length > 0) {
    const times = candidates.map((item) => item.watchedAt.getTime());
    const padMs = windowMinutes * 60_000;
    try {
      const windowed = await fetchHistoryWindow(app.clientId, token, {
        startAt: new Date(Math.min(...times) - padMs),
        endAt: new Date(Math.max(...times) + padMs),
      });
      upsertSnapshotRows(windowed);
      snapshots = listSnapshots();
    } catch (err) {
      logger.warn({ err }, "windowed Trakt history fetch failed");
    }
  }

  const toSend: SyncCandidate[] = [];
  for (const item of candidates) {
    const record = getDb()
      .select()
      .from(syncRecords)
      .where(eq(syncRecords.watchEventId, item.eventId))
      .get();
    if (!record || record.status === "synced" || record.status === "syncing") {
      continue;
    }
    if (record.skipReason === "user_ignored") {
      stats.skipped += 1;
      continue;
    }
    if (!shouldPostRecord(record)) {
      continue;
    }
    const hit = matchSnapshot(
      {
        kind: item.kind,
        tmdbId: item.tmdbId,
        imdbId: item.imdbId,
        tvdbId: item.tvdbId,
        showTmdbId: item.showTmdbId,
        seasonNumber: item.seasonNumber,
        episodeNumber: item.episodeNumber,
        watchedAt: item.watchedAt,
      },
      snapshots.map((row) => ({
        traktHistoryId: row.traktHistoryId,
        kind: row.kind,
        tmdbId: row.tmdbId,
        imdbId: row.imdbId,
        tvdbId: row.tvdbId,
        showTmdbId: row.showTmdbId,
        seasonNumber: row.seasonNumber,
        episodeNumber: row.episodeNumber,
        watchedAt: row.watchedAtUtc,
      })),
      windowMinutes,
    );
    if (hit) {
      markSynced(item.eventId, hit.traktHistoryId, "already_on_trakt");
      stats.alreadyOnTrakt += 1;
      stats.synced += 1;
      continue;
    }
    toSend.push(item);
  }

  let access = token;
  for (let i = 0; i < toSend.length; i += BATCH) {
    const batch = toSend.slice(i, i + BATCH);
    markSyncing(batch.map((item) => item.eventId));
    const body = buildHistoryBody(batch);
    if (!body.movies && !body.episodes && !body.shows) {
      for (const item of batch) {
        markUnmatched(item.eventId);
        stats.unmatched += 1;
      }
      continue;
    }
    let res = await traktPostHistory(app.clientId, access, body);
    if (res.status === 401) {
      const refreshed = await refreshTraktConnection();
      const latest = getConnection("trakt");
      const nextToken = latest ? readAccessToken(latest) : null;
      if (!refreshed || !nextToken) {
        failBatch(batch, 401, "Trakt needs to be reconnected.");
        stats.failed += batch.length;
        stats.error = "Trakt needs to be reconnected.";
        bumpCircuit();
        persistStats(stats, started);
        return stats;
      }
      access = nextToken;
      res = await traktPostHistory(app.clientId, access, body);
    }
    if (res.status === 429 || res.status >= 500 || res.status === 0) {
      const wait = retryAfterMs(res.headers) ?? 30_000;
      retryBatch(batch, res.status, res.text || `HTTP ${res.status}`, wait);
      stats.failed += batch.length;
      bumpCircuit();
      persistStats(stats, started);
      return stats;
    }
    if (res.status >= 400) {
      failBatch(batch, res.status, res.text || `HTTP ${res.status}`);
      stats.failed += batch.length;
      bumpCircuit();
      persistStats(stats, started);
      return stats;
    }
    const outcome = applyPostResponse(batch, res.json);
    const posted = batch.filter((item) =>
      outcome.synced.includes(item.eventId),
    );
    for (const item of posted) {
      markSynced(item.eventId, null, WATCHLOG_POSTED);
    }
    try {
      await capturePostedRemoteIds(app.clientId, access, posted);
    } catch (err) {
      logger.warn(
        { err, count: posted.length },
        "Could not store Trakt history ids after post",
      );
    }
    for (const id of outcome.unmatched) {
      markUnmatched(id);
    }
    for (const id of outcome.pending) {
      revertPending(id);
    }
    stats.posted += batch.length;
    stats.synced += outcome.synced.length;
    stats.unmatched += outcome.unmatched.length;
  }

  saveCircuit({ failures: 0, pausedUntil: null });
  persistStats(stats, started);
  logger.info(
    { ...stats, ms: Date.now() - started.getTime() },
    "Trakt sync finished",
  );
  return stats;
}

function loadCandidates(
  eventIds: string[] | undefined,
  ignoreCutoff?: boolean,
): SyncCandidate[] {
  const filters = [eq(watchEvents.isComplete, true)];
  if (eventIds?.length) {
    filters.push(inArray(watchEvents.id, eventIds));
  } else {
    const statusClause = or(
      eq(syncRecords.status, "pending"),
      and(
        eq(syncRecords.status, "failed"),
        lte(syncRecords.attempts, MAX_SYNC_ATTEMPTS - 1),
      ),
    );
    const dueClause = or(
      isNull(syncRecords.nextAttemptAt),
      lte(syncRecords.nextAttemptAt, new Date()),
    );
    if (statusClause) {
      filters.push(statusClause);
    }
    if (dueClause) {
      filters.push(dueClause);
    }
  }
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
      status: syncRecords.status,
      skipReason: syncRecords.skipReason,
    })
    .from(watchEvents)
    .innerJoin(syncRecords, eq(syncRecords.watchEventId, watchEvents.id))
    .leftJoin(mediaItems, eq(mediaItems.id, watchEvents.mediaItemId))
    .where(and(...filters))
    .orderBy(asc(watchEvents.watchedAtUtc))
    .all();

  const settings = getSyncSettings();
  const cutoff =
    !ignoreCutoff && settings.mode === "forward" && settings.cutoffIso
      ? Date.parse(settings.cutoffIso)
      : null;
  return rows
    .filter((row) => {
      if (!shouldPostRecord(row)) {
        return false;
      }
      if (cutoff != null && row.watchedAt.getTime() < cutoff && !ignoreCutoff) {
        return false;
      }
      if (!row.kind) {
        return false;
      }
      return true;
    })
    .map((row) => ({
      eventId: row.eventId,
      kind: row.kind === "episode" ? "episode" : "movie",
      tmdbId: row.tmdbId,
      imdbId: row.imdbId,
      tvdbId: row.tvdbId,
      showTmdbId: row.showTmdbId,
      seasonNumber: row.seasonNumber,
      episodeNumber: row.episodeNumber,
      watchedAt: row.watchedAt,
    }));
}

function markSyncing(ids: string[]): void {
  if (ids.length === 0) {
    return;
  }
  getDb()
    .update(syncRecords)
    .set({ status: "syncing", lastAttemptAt: new Date() })
    .where(inArray(syncRecords.watchEventId, ids))
    .run();
}

function markSynced(
  eventId: string,
  remoteId: number | null,
  skipReason: string | null,
): void {
  getDb()
    .update(syncRecords)
    .set({
      status: "synced",
      skipReason,
      remoteId: remoteId != null ? String(remoteId) : null,
      syncedAt: new Date(),
      lastErrorCode: null,
      lastErrorMessage: null,
      nextAttemptAt: null,
    })
    .where(eq(syncRecords.watchEventId, eventId))
    .run();
}

function markUnmatched(eventId: string): void {
  getDb()
    .update(syncRecords)
    .set({
      status: "unmatched",
      skipReason: "unmatched",
      lastAttemptAt: new Date(),
      nextAttemptAt: null,
    })
    .where(eq(syncRecords.watchEventId, eventId))
    .run();
}

function revertPending(eventId: string): void {
  getDb()
    .update(syncRecords)
    .set({
      status: "pending",
      skipReason: null,
      lastAttemptAt: new Date(),
    })
    .where(eq(syncRecords.watchEventId, eventId))
    .run();
}

function retryBatch(
  batch: SyncCandidate[],
  status: number,
  message: string,
  waitMs: number,
): void {
  const next = new Date(Date.now() + waitMs);
  for (const item of batch) {
    const record = getDb()
      .select()
      .from(syncRecords)
      .where(eq(syncRecords.watchEventId, item.eventId))
      .get();
    const attempts = (record?.attempts ?? 0) + 1;
    const failed = attempts >= MAX_SYNC_ATTEMPTS || !shouldRetryStatus(status);
    getDb()
      .update(syncRecords)
      .set({
        status: failed ? "failed" : "pending",
        attempts,
        lastAttemptAt: new Date(),
        lastErrorCode: String(status),
        lastErrorMessage: message.slice(0, 500),
        nextAttemptAt: failed ? null : nextAttemptAt(attempts, next.getTime()),
      })
      .where(eq(syncRecords.watchEventId, item.eventId))
      .run();
  }
}

function failBatch(
  batch: SyncCandidate[],
  status: number,
  message: string,
): void {
  for (const item of batch) {
    const record = getDb()
      .select()
      .from(syncRecords)
      .where(eq(syncRecords.watchEventId, item.eventId))
      .get();
    getDb()
      .update(syncRecords)
      .set({
        status: "failed",
        attempts: (record?.attempts ?? 0) + 1,
        lastAttemptAt: new Date(),
        lastErrorCode: String(status),
        lastErrorMessage: message.slice(0, 500),
        nextAttemptAt: null,
      })
      .where(eq(syncRecords.watchEventId, item.eventId))
      .run();
  }
}

function bumpCircuit(): void {
  const current = getCircuit();
  const failures = current.failures + 1;
  saveCircuit({
    failures,
    pausedUntil:
      failures >= CIRCUIT_FAILURES
        ? Date.now() + CIRCUIT_PAUSE_MS
        : current.pausedUntil,
  });
}

function persistStats(stats: SyncStats, started: Date): void {
  setSettingJson("sync.last_stats", stats);
  recordJob(stats, started);
  writeAudit({
    actor: "system",
    action: stats.error ? "sync.failed" : "sync.finished",
    subjectType: "job",
    subjectId: "sync",
    detail: { ...stats, ms: Date.now() - started.getTime() },
  });
}

function recordJob(stats: SyncStats, started: Date): void {
  const existing = getDb().select().from(jobs).where(eq(jobs.id, "sync")).get();
  const payload = JSON.stringify(stats);
  const finished = new Date();
  if (existing) {
    getDb()
      .update(jobs)
      .set({
        status: stats.error ? "error" : "ok",
        startedAt: started,
        finishedAt: finished,
        statsJson: payload,
        error: stats.error ?? null,
        itemsProcessed: stats.synced,
      })
      .where(eq(jobs.id, "sync"))
      .run();
  } else {
    getDb()
      .insert(jobs)
      .values({
        id: "sync",
        type: "sync",
        status: stats.error ? "error" : "ok",
        startedAt: started,
        finishedAt: finished,
        statsJson: payload,
        error: stats.error ?? null,
        itemsProcessed: stats.synced,
      })
      .run();
  }
  getDb()
    .insert(jobRuns)
    .values({
      id: newId(),
      jobId: "sync",
      type: "sync",
      status: stats.error ? "error" : "ok",
      startedAt: started,
      finishedAt: finished,
      statsJson: payload,
      error: stats.error ?? null,
      itemsProcessed: stats.synced,
    })
    .run();
}
