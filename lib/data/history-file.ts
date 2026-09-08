import { eq } from "drizzle-orm";
import { writeAudit } from "../audit";
import { getDb } from "../db";
import { mediaItems, watchEvents } from "../db/schema";
import { upsertMediaItem, upsertWatchEvent } from "../ingest/persist";
import { getSettingJson, setSettingJson } from "../settings";

export const MAX_IMPORT_EVENTS = 50_000;

export type HistoryFileEvent = {
  watchedAt: string;
  title: string;
  showTitle: string | null;
  kind: "movie" | "episode";
  seasonNumber: number | null;
  episodeNumber: number | null;
  seconds: number | null;
  tmdbId: number | null;
  tofaHistoryId: string | null;
  completionPercent: number | null;
  isComplete: boolean;
  dedupeKey: string;
};

export type HistoryFile = {
  source: "watchlog";
  exportedAt: string;
  events: HistoryFileEvent[];
};

export function exportHistoryEvents(): HistoryFileEvent[] {
  const rows = getDb()
    .select({
      watchedAt: watchEvents.watchedAtUtc,
      title: mediaItems.title,
      showTitle: mediaItems.showTitle,
      kind: mediaItems.kind,
      seasonNumber: mediaItems.seasonNumber,
      episodeNumber: mediaItems.episodeNumber,
      seconds: watchEvents.durationWatchedSeconds,
      tmdbId: mediaItems.tmdbId,
      tofaHistoryId: watchEvents.tofaHistoryId,
      completionPercent: watchEvents.completionPercent,
      isComplete: watchEvents.isComplete,
      dedupeKey: watchEvents.dedupeKey,
    })
    .from(watchEvents)
    .leftJoin(mediaItems, eq(watchEvents.mediaItemId, mediaItems.id))
    .all();
  return rows.map((row) => ({
    watchedAt: row.watchedAt.toISOString(),
    title: row.title ?? "Untitled",
    showTitle: row.showTitle,
    kind: row.kind === "episode" ? "episode" : "movie",
    seasonNumber: row.seasonNumber,
    episodeNumber: row.episodeNumber,
    seconds: row.seconds,
    tmdbId: row.tmdbId,
    tofaHistoryId: row.tofaHistoryId,
    completionPercent: row.completionPercent,
    isComplete: row.isComplete,
    dedupeKey: row.dedupeKey,
  }));
}

export function buildHistoryFile(): HistoryFile {
  return {
    source: "watchlog",
    exportedAt: new Date().toISOString(),
    events: exportHistoryEvents(),
  };
}

export function historyToCsv(events: HistoryFileEvent[]): string {
  const header = [
    "watched_at",
    "title",
    "show_title",
    "kind",
    "season",
    "episode",
    "seconds",
    "tmdb_id",
    "complete",
  ];
  const body = events.map((row) =>
    [
      row.watchedAt,
      csv(row.title),
      csv(row.showTitle ?? ""),
      row.kind,
      row.seasonNumber ?? "",
      row.episodeNumber ?? "",
      row.seconds ?? "",
      row.tmdbId ?? "",
      row.isComplete ? "1" : "0",
    ].join(","),
  );
  return [header.join(","), ...body].join("\n");
}

function csv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function toInt(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function completeFlag(value: unknown): boolean {
  return value !== false && value !== 0 && value !== "0" && value !== "false";
}

export function parseHistoryFile(raw: unknown): HistoryFileEvent[] {
  if (!raw || typeof raw !== "object") {
    throw new Error("That file is not a Watchlog export.");
  }
  const data = raw as { source?: string; events?: unknown };
  const list = Array.isArray(data.events)
    ? data.events
    : Array.isArray(raw)
      ? raw
      : null;
  if (!list) {
    throw new Error("That file has no events array.");
  }
  if (list.length > MAX_IMPORT_EVENTS) {
    throw new Error(`Import is capped at ${MAX_IMPORT_EVENTS} plays.`);
  }
  const events: HistoryFileEvent[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = item as Partial<HistoryFileEvent>;
    const watchedAt = String(row.watchedAt ?? "");
    const title = String(row.title ?? "").trim() || "Untitled";
    if (!watchedAt || Number.isNaN(Date.parse(watchedAt))) {
      continue;
    }
    const kind = row.kind === "episode" ? "episode" : "movie";
    const tmdbId = toInt(row.tmdbId);
    events.push({
      watchedAt,
      title,
      showTitle: row.showTitle ?? null,
      kind,
      seasonNumber: toInt(row.seasonNumber),
      episodeNumber: toInt(row.episodeNumber),
      seconds: toInt(row.seconds),
      tmdbId,
      tofaHistoryId: row.tofaHistoryId ?? null,
      completionPercent: toInt(row.completionPercent),
      isComplete: completeFlag(row.isComplete),
      dedupeKey:
        row.dedupeKey?.trim() ||
        `import:${watchedAt}:${kind}:${tmdbId ?? title}:${toInt(row.seasonNumber) ?? 0}:${toInt(row.episodeNumber) ?? 0}`,
    });
  }
  if (events.length === 0) {
    throw new Error("No plays found in that file.");
  }
  return events;
}

export function stashImportPreview(events: HistoryFileEvent[]): number {
  if (events.length > MAX_IMPORT_EVENTS) {
    throw new Error(`Import is capped at ${MAX_IMPORT_EVENTS} plays.`);
  }
  setSettingJson("data.import_preview", {
    at: new Date().toISOString(),
    events,
  });
  writeAudit({
    action: "data.import_preview",
    subjectType: "watch_events",
    detail: { count: events.length },
  });
  return events.length;
}

export function importPreviewCount(): number {
  const stored = getSettingJson<{ events?: HistoryFileEvent[] }>(
    "data.import_preview",
  );
  return stored?.events?.length ?? 0;
}

export function clearImportPreview(): void {
  setSettingJson("data.import_preview", null);
}

export function cancelImportPreview(): void {
  clearImportPreview();
  writeAudit({ action: "data.import_cancel", subjectType: "watch_events" });
}

export function confirmImport(): { inserted: number; skipped: number } {
  const stored = getSettingJson<{ events?: HistoryFileEvent[] }>(
    "data.import_preview",
  );
  const events = stored?.events ?? [];
  if (events.length === 0) {
    throw new Error("Nothing to import. Choose a file first.");
  }
  let inserted = 0;
  let skipped = 0;
  for (const event of events) {
    const watchedAt = new Date(event.watchedAt);
    const mediaId = upsertMediaItem({
      kind: event.kind,
      tofaMediaId: `import:${event.dedupeKey}`,
      artworkMediaId: null,
      tmdbId: event.tmdbId,
      imdbId: null,
      tvdbId: null,
      title: event.title,
      sortTitle: event.title,
      year: null,
      runtimeSeconds: event.seconds,
      showTmdbId: event.kind === "episode" ? event.tmdbId : null,
      showTitle: event.showTitle,
      seasonNumber: event.seasonNumber,
      episodeNumber: event.episodeNumber,
      tofaLibraryId: null,
      genreNames: [],
    });
    const result = upsertWatchEvent(mediaId, {
      dedupeKey: event.dedupeKey,
      dedupeStrategy: event.tofaHistoryId ? "tofa_history_id" : "fingerprint",
      tofaHistoryId: event.tofaHistoryId,
      tofaUserId: null,
      watchedAt,
      timestampConvention: "completion",
      durationWatchedSeconds: event.seconds,
      completionPercent: event.completionPercent,
      isComplete: event.isComplete,
      deviceName: null,
      rawJson: JSON.stringify({ source: "import", event }),
    });
    if (result.inserted) {
      inserted += 1;
    } else {
      skipped += 1;
    }
  }
  clearImportPreview();
  writeAudit({
    action: "data.import_confirm",
    subjectType: "watch_events",
    detail: { inserted, skipped },
  });
  return { inserted, skipped };
}
