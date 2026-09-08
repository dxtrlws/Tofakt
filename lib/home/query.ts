import { and, desc, eq, or, sql } from "drizzle-orm";
import { toPublic } from "../connections/public";
import { getConnection } from "../connections/store";
import type { PublicConnection } from "../connections/types";
import { getDb } from "../db";
import { jobs, mediaItems, syncRecords, watchEvents } from "../db/schema";
import {
  displayTitle,
  formatSeasonEpisode,
  type HistoryRow,
} from "../history/query";
import { timezone } from "../ingest/run";
import { pendingCount } from "../sync/preview";
import {
  emptyMonth,
  loadTraktMonth,
  loadTraktRecent,
  loadTraktUpcoming,
  logHomeTraktError,
  traktCreds,
} from "./trakt";
import type {
  HomeAttention,
  HomeConnection,
  HomeMonth,
  HomePoster,
} from "./types";
import {
  airsInLabel,
  episodeTypeLabel,
  isoDate,
  matchesUpcomingFilter,
  type UpcomingFilter,
} from "./upcoming";

export type {
  HomeAttention,
  HomeConnection,
  HomeMonth,
  HomePoster,
} from "./types";
export type { UpcomingFilter } from "./upcoming";

export type HomeDashboard = {
  connections: HomeConnection[];
  pending: number;
  attentionCount: number;
  lastSyncLabel: string;
  pendingPlays: HomePoster[];
  recent: HomePoster[];
  upcoming: HomePoster[];
  upcomingFilter: UpcomingFilter;
  month: HomeMonth;
  attention: HomeAttention[];
  timeZone: string;
  traktOk: boolean;
};

export async function loadHomeDashboard(
  upcomingFilter: UpcomingFilter = "all",
  now = new Date(),
): Promise<HomeDashboard> {
  const timeZone = timezone();
  const attention = listAttention(8);
  const pendingPlays = listPendingPlays(12, now);
  const range = monthRange(now, timeZone);
  let recent: HomePoster[] = [];
  let upcoming: HomePoster[] = [];
  let month = emptyMonth(range.name);
  let traktOk = false;
  try {
    const creds = await traktCreds();
    if (creds) {
      traktOk = true;
      const [traktRecent, traktMonth, traktUpcoming] = await Promise.all([
        loadTraktRecent(creds, now),
        loadTraktMonth(creds, timeZone, range),
        loadTraktUpcoming(creds, isoDate(now, timeZone)),
      ]);
      recent = traktRecent;
      month = traktMonth;
      upcoming = traktUpcoming
        .filter((item) =>
          matchesUpcomingFilter(item.episodeType, upcomingFilter),
        )
        .map((item) => {
          const typeLabel = episodeTypeLabel(item.episodeType);
          return {
            id: item.id,
            title: item.title,
            subtitle: typeLabel
              ? `${item.subtitle} · ${typeLabel}`
              : item.subtitle,
            overlay: item.overlay,
            overlayMuted: item.overlayMuted,
            badge: item.airsAt
              ? airsInLabel(item.airsAt, now, timeZone)
              : "Soon",
            badgeTone: "soon",
            artworkUrl: item.artworkUrl,
            href: null,
          };
        });
    }
  } catch (err) {
    logHomeTraktError(err);
    traktOk = false;
  }
  return {
    connections: [
      summarize("tofa", toPublic(getConnection("tofa"), "tofa")),
      summarize("trakt", toPublic(getConnection("trakt"), "trakt")),
      summarize("tmdb", toPublic(getConnection("tmdb"), "tmdb")),
    ],
    pending: pendingCount(),
    attentionCount: attentionCount(),
    lastSyncLabel: lastSyncLabel(now),
    pendingPlays,
    recent,
    upcoming,
    upcomingFilter,
    month,
    attention,
    timeZone,
    traktOk,
  };
}

export function summarize(
  provider: "tofa" | "trakt" | "tmdb",
  conn: PublicConnection,
): HomeConnection {
  if (provider === "tmdb" && !conn.hasSecret) {
    return {
      provider,
      status: conn.status === "ok" ? "warn" : conn.status,
      label: "TMDB",
      detail: "Key missing",
    };
  }
  if (provider === "trakt" && conn.status === "ok") {
    return {
      provider,
      status: "ok",
      label: "Trakt",
      detail: conn.accountLabel ?? "Connected",
    };
  }
  if (conn.status === "ok") {
    return {
      provider,
      status: "ok",
      label:
        provider === "tofa" ? "tofa" : provider === "trakt" ? "Trakt" : "TMDB",
      detail: "Connected",
    };
  }
  if (conn.status === "down") {
    return {
      provider,
      status: "down",
      label:
        provider === "tofa" ? "tofa" : provider === "trakt" ? "Trakt" : "TMDB",
      detail: "Down",
    };
  }
  return {
    provider,
    status: conn.status,
    label:
      provider === "tofa" ? "tofa" : provider === "trakt" ? "Trakt" : "TMDB",
    detail: conn.lastError ? "Needs attention" : "Not connected",
  };
}

export function relativeTime(from: Date, now: Date): string {
  const deltaSec = Math.round((from.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(deltaSec);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "always" });
  if (abs < 60) {
    return "just now";
  }
  if (abs < 3600) {
    return rtf.format(Math.round(deltaSec / 60), "minute");
  }
  if (abs < 86400) {
    return rtf.format(Math.round(deltaSec / 3600), "hour");
  }
  if (abs < 86400 * 7) {
    return rtf.format(Math.round(deltaSec / 86400), "day");
  }
  if (abs < 86400 * 30) {
    return rtf.format(Math.round(deltaSec / (86400 * 7)), "week");
  }
  return rtf.format(Math.round(deltaSec / (86400 * 30)), "month");
}

export function formatHours(seconds: number): string {
  const hours = seconds / 3600;
  const rounded = Math.round(hours * 10) / 10;
  if (Number.isInteger(rounded)) {
    return String(rounded);
  }
  return rounded.toFixed(1);
}

export function historyHref(status: string): string {
  if (status === "pending") {
    return "/history";
  }
  if (status === "skipped") {
    return "/history?state=skipped";
  }
  if (status === "synced" || status === "failed" || status === "unmatched") {
    return `/history?state=${status}`;
  }
  return "/history?state=skipped";
}

function listPendingPlays(limit: number, now: Date): HomePoster[] {
  return mapRows(
    getDb()
      .select(rowSelect())
      .from(watchEvents)
      .leftJoin(mediaItems, eq(watchEvents.mediaItemId, mediaItems.id))
      .leftJoin(syncRecords, eq(syncRecords.watchEventId, watchEvents.id))
      .where(
        and(
          eq(watchEvents.isComplete, true),
          eq(syncRecords.status, "pending"),
        ),
      )
      .orderBy(desc(watchEvents.watchedAtUtc))
      .limit(limit)
      .all(),
  ).map((row) => ({
    id: row.eventId,
    title: displayTitle(row),
    subtitle: relativeTime(row.watchedAt, now),
    overlay:
      formatSeasonEpisode(row.seasonNumber, row.episodeNumber) ?? "Movie",
    overlayMuted: null,
    badge: "Pending",
    badgeTone: "pending",
    artworkUrl: row.artworkUrl,
    href: "/history",
  }));
}

function listAttention(limit: number): HomeAttention[] {
  const rows = mapRows(
    getDb()
      .select(rowSelect())
      .from(watchEvents)
      .leftJoin(mediaItems, eq(watchEvents.mediaItemId, mediaItems.id))
      .leftJoin(syncRecords, eq(syncRecords.watchEventId, watchEvents.id))
      .where(
        and(
          eq(watchEvents.isComplete, true),
          or(
            eq(syncRecords.status, "failed"),
            eq(syncRecords.status, "unmatched"),
          ),
        ),
      )
      .orderBy(desc(watchEvents.watchedAtUtc))
      .limit(limit)
      .all(),
  );
  return rows.map((row) => {
    const se = formatSeasonEpisode(row.seasonNumber, row.episodeNumber);
    const title = se ? `${displayTitle(row)} ${se}` : displayTitle(row);
    const failed = row.syncStatus === "failed";
    return {
      eventId: row.eventId,
      title,
      artworkUrl: row.artworkUrl,
      href: historyHref(row.syncStatus),
      line: failed
        ? `Failed · ${row.lastErrorMessage ?? "sync failed"}`
        : "Unmatched · Fix match",
      tone: failed ? "failed" : "unmatched",
    };
  });
}

function attentionCount(): number {
  const row = getDb()
    .select({ n: sql<number>`count(*)` })
    .from(syncRecords)
    .innerJoin(watchEvents, eq(watchEvents.id, syncRecords.watchEventId))
    .where(
      and(
        eq(watchEvents.isComplete, true),
        or(
          eq(syncRecords.status, "failed"),
          eq(syncRecords.status, "unmatched"),
        ),
      ),
    )
    .get();
  return Number(row?.n ?? 0);
}

export function monthRange(
  now: Date,
  timeZone: string,
): { start: Date; end: Date; name: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const start = zonedLocalTime(year, month, 1, timeZone);
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = zonedLocalTime(endYear, endMonth, 1, timeZone);
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "long",
  }).format(now);
  return { start, end, name };
}

function zonedLocalTime(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, 12);
  const offset = tzOffsetMs(new Date(guess), timeZone);
  const utc = Date.UTC(year, month - 1, day, 0, 0, 0) - offset;
  const adjusted = new Date(utc);
  const again = tzOffsetMs(adjusted, timeZone);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - again);
}

function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second"),
  );
  return asUtc - date.getTime();
}

function lastSyncLabel(now: Date): string {
  const row = getDb().select().from(jobs).where(eq(jobs.id, "sync")).get();
  if (!row?.finishedAt) {
    return "Last successful sync never";
  }
  return `Last successful sync ${relativeTime(row.finishedAt, now)}`;
}

function rowSelect() {
  return {
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
  };
}

function mapRows(
  rows: Array<{
    eventId: string;
    title: string;
    showTitle: string | null;
    kind: "movie" | "episode" | null;
    seasonNumber: number | null;
    episodeNumber: number | null;
    artworkUrl: string | null;
    watchedAt: Date;
    durationWatchedSeconds: number | null;
    completionPercent: number | null;
    syncStatus: string;
    skipReason: string | null;
    lastErrorMessage: string | null;
  }>,
): HistoryRow[] {
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
