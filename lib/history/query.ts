import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { getDataPrefs } from "../data/prefs";
import { getDb } from "../db";
import { mediaItems, syncRecords, watchEvents } from "../db/schema";
import { timezone } from "../ingest/run";

export type HistoryKindFilter = "all" | "movies" | "tv";
export type HistoryStateFilter =
  | "all"
  | "synced"
  | "pending"
  | "failed"
  | "unmatched"
  | "skipped";

export type HistoryRow = {
  eventId: string;
  title: string;
  showTitle: string | null;
  kind: "movie" | "episode";
  seasonNumber: number | null;
  episodeNumber: number | null;
  artworkUrl: string | null;
  watchedAt: Date;
  durationWatchedSeconds: number | null;
  completionPercent: number | null;
  syncStatus: string;
  skipReason: string | null;
  lastErrorMessage: string | null;
};

export type HistoryQuery = {
  kind: HistoryKindFilter;
  state: HistoryStateFilter;
  q: string;
};

export function parseHistoryQuery(searchParams: {
  get(name: string): string | null;
}): HistoryQuery {
  const kindRaw = searchParams.get("kind");
  const stateRaw = searchParams.get("state");
  const kind: HistoryKindFilter =
    kindRaw === "movies" || kindRaw === "tv" ? kindRaw : "all";
  const state: HistoryStateFilter =
    stateRaw === "all" ||
    stateRaw === "synced" ||
    stateRaw === "pending" ||
    stateRaw === "failed" ||
    stateRaw === "unmatched" ||
    stateRaw === "skipped"
      ? stateRaw
      : "pending";
  return { kind, state, q: (searchParams.get("q") ?? "").trim() };
}

export function listHistory(query: HistoryQuery): HistoryRow[] {
  const filters = getDataPrefs().countPartials
    ? []
    : [eq(watchEvents.isComplete, true)];
  if (query.kind === "movies") {
    filters.push(eq(mediaItems.kind, "movie"));
  } else if (query.kind === "tv") {
    filters.push(eq(mediaItems.kind, "episode"));
  }
  if (query.state === "skipped") {
    filters.push(eq(syncRecords.status, "skipped"));
  } else if (query.state !== "all") {
    filters.push(eq(syncRecords.status, query.state));
  }
  if (query.q) {
    const needle = `%${query.q}%`;
    const search = or(
      like(mediaItems.title, needle),
      like(mediaItems.showTitle, needle),
    );
    if (search) {
      filters.push(search);
    }
  }
  const where = filters.length ? and(...filters) : undefined;
  const rows = getDb()
    .select({
      eventId: watchEvents.id,
      title: sql<string>`coalesce(${mediaItems.title}, 'Untitled')`,
      showTitle: mediaItems.showTitle,
      kind: mediaItems.kind,
      seasonNumber: mediaItems.seasonNumber,
      episodeNumber: mediaItems.episodeNumber,
      artworkUrl: mediaItems.artworkUrl,
      watchedAt: watchEvents.watchedAtUtc,
      durationWatchedSeconds: watchEvents.durationWatchedSeconds,
      completionPercent: watchEvents.completionPercent,
      syncStatus: sql<string>`coalesce(${syncRecords.status}, 'pending')`,
      skipReason: syncRecords.skipReason,
      lastErrorMessage: syncRecords.lastErrorMessage,
    })
    .from(watchEvents)
    .leftJoin(mediaItems, eq(watchEvents.mediaItemId, mediaItems.id))
    .leftJoin(syncRecords, eq(syncRecords.watchEventId, watchEvents.id))
    .where(where)
    .orderBy(desc(watchEvents.watchedAtUtc))
    .all();
  return rows.map((row) => ({
    eventId: row.eventId,
    title: row.title,
    showTitle: row.showTitle,
    kind: row.kind === "episode" ? "episode" : "movie",
    seasonNumber: row.seasonNumber,
    episodeNumber: row.episodeNumber,
    artworkUrl: row.artworkUrl,
    watchedAt: row.watchedAt,
    durationWatchedSeconds: row.durationWatchedSeconds,
    completionPercent: row.completionPercent,
    syncStatus: row.syncStatus,
    skipReason: row.skipReason,
    lastErrorMessage: row.lastErrorMessage,
  }));
}

export function historyCount(): number {
  const query = getDb().select({ id: watchEvents.id }).from(watchEvents);
  if (!getDataPrefs().countPartials) {
    return query.where(eq(watchEvents.isComplete, true)).all().length;
  }
  return query.all().length;
}

export type DayGroup = {
  key: string;
  label: string;
  rows: HistoryRow[];
};

export function groupByDay(rows: HistoryRow[]): DayGroup[] {
  const tz = timezone();
  const groups = new Map<string, DayGroup>();
  for (const row of rows) {
    const key = dayKey(row.watchedAt, tz);
    let group = groups.get(key);
    if (!group) {
      group = { key, label: dayLabel(row.watchedAt, tz), rows: [] };
      groups.set(key, group);
    }
    group.rows.push(row);
  }
  return [...groups.values()];
}

function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function dayLabel(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) {
    return "—";
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function formatSeasonEpisode(
  season: number | null,
  episode: number | null,
): string | null {
  if (season == null || episode == null) {
    return null;
  }
  return `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
}

export function skipReasonCopy(reason: string | null): string | null {
  switch (reason) {
    case "before_cutoff":
      return "older than Newly watched only";
    case "user_ignored":
      return "ignored";
    case "marked_watched":
      return "marked watched";
    case "library_excluded":
      return "library excluded";
    case "below_threshold":
      return "below threshold";
    case "already_on_trakt":
      return "already on Trakt";
    default:
      return null;
  }
}

export function rowSubtitle(row: HistoryRow): {
  text: string;
  tone: "muted" | "failed" | "unmatched";
} {
  if (row.syncStatus === "failed") {
    const identity = episodePrefix(row);
    const error = row.lastErrorMessage ?? "sync failed";
    return {
      text: identity ? `${identity} · ${error}` : error,
      tone: "failed",
    };
  }
  if (row.syncStatus === "unmatched") {
    const kind =
      row.kind === "episode" ? (episodePrefix(row) ?? "TV") : "Movie";
    return { text: `${kind} · no TMDB id`, tone: "unmatched" };
  }
  const skip = skipReasonCopy(row.skipReason);
  if (row.kind === "episode") {
    const code = formatSeasonEpisode(row.seasonNumber, row.episodeNumber);
    const title = row.title;
    const bits = [code, title, skip].filter(Boolean);
    return {
      text: bits.join(" · "),
      tone: "muted",
    };
  }
  const bits = ["Movie"];
  if (row.skipReason === "below_threshold" && row.completionPercent != null) {
    bits.push(`${row.completionPercent}% watched`);
  }
  if (skip) {
    bits.push(skip);
  }
  return { text: bits.join(" · "), tone: "muted" };
}

function episodePrefix(row: HistoryRow): string | null {
  return formatSeasonEpisode(row.seasonNumber, row.episodeNumber);
}

export function displayTitle(row: HistoryRow): string {
  return row.kind === "episode" ? (row.showTitle ?? row.title) : row.title;
}
