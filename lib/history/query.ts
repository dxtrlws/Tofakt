import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { getDataPrefs } from "../data/prefs";
import { getDb } from "../db";
import { mediaItems, syncRecords, watchEvents } from "../db/schema";
import { timezone } from "../ingest/run";
import {
  type DayGroup,
  dayLabel,
  type HistoryKindFilter,
  type HistoryQuery,
  type HistoryRow,
  type HistoryStateFilter,
} from "./display";

export type {
  DayGroup,
  HistoryKindFilter,
  HistoryQuery,
  HistoryRow,
  HistoryStateFilter,
} from "./display";
export {
  dayLabel,
  displayTitle,
  formatDuration,
  formatSeasonEpisode,
  formatTime,
  rowSubtitle,
  skipReasonCopy,
} from "./display";

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
