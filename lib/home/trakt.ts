import { inArray, or } from "drizzle-orm";
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
import { mediaItems } from "../db/schema";
import { formatSeasonEpisode } from "../history/query";
import { logger } from "../logger";
import { mapPool } from "../net/pool";
import {
  listHistoryItemsInRange,
  listRecentHistoryItems,
} from "../sync/reconcile";
import { TMDB_LOOKUP_CONCURRENCY, tmdbPosterUrl } from "../tmdb/poster";
import { ensureHistorySnapshot, loadCachedShowCalendar } from "../trakt/cache";
import type { TraktHistoryItem } from "../trakt/history";
import type { HomeMonth, HomePoster } from "./types";
import { isoDate } from "./upcoming";

type TraktCreds = { clientId: string; token: string };

export async function traktCreds(): Promise<TraktCreds | null> {
  await refreshDueTokens();
  let row = getConnection("trakt");
  if (!row) {
    return null;
  }
  if (!readAccessToken(row)) {
    await refreshTraktConnection();
    row = getConnection("trakt");
  }
  if (!row) {
    return null;
  }
  const app = readTraktAppSecrets(row);
  const token = readAccessToken(row);
  if (!app || !token) {
    return null;
  }
  return { clientId: app.clientId, token };
}

export async function loadTraktRecent(
  _creds: TraktCreds,
  now: Date,
): Promise<HomePoster[]> {
  await ensureHistorySnapshot({ revalidate: false });
  return postersFromHistory(listRecentHistoryItems(12), now);
}

export async function loadTraktMonth(
  _creds: TraktCreds,
  timeZone: string,
  range: { start: Date; end: Date; name: string },
): Promise<HomeMonth> {
  await ensureHistorySnapshot({ revalidate: false });
  const items = listHistoryItemsInRange(range.start, range.end);
  return monthFromHistory(items, timeZone, range.name);
}

export type TraktArtRef = { key: string; kind: "movie" | "tv"; tmdbId: number };

export async function resolveTraktArtwork(
  refs: TraktArtRef[],
): Promise<Map<string, string>> {
  return resolveArtwork(refs);
}

export async function loadTraktUpcoming(
  creds: TraktCreds,
  startDate: string,
): Promise<Array<HomePoster & { episodeType: string | null }>> {
  const items = await loadCachedShowCalendar(
    creds.clientId,
    creds.token,
    startDate,
    21,
  );
  const posters: Array<HomePoster & { episodeType: string | null }> = [];
  const refs: ArtRef[] = [];
  for (const item of items) {
    const aired = new Date(item.first_aired);
    if (Number.isNaN(aired.getTime())) {
      continue;
    }
    const showTmdb = item.show.ids?.tmdb ?? null;
    const season = item.episode.season ?? null;
    const number = item.episode.number ?? null;
    const se = formatSeasonEpisode(season, number);
    const episodeTitle = item.episode.title?.trim();
    const id = `${item.show.ids?.trakt ?? item.show.title ?? "show"}-${season}-${number}-${item.first_aired}`;
    const key = showTmdb ? `show:${showTmdb}` : id;
    const episodeLine =
      season != null && number != null ? `S${season} · E${number}` : se;
    if (showTmdb) {
      refs.push({ key, kind: "tv", tmdbId: showTmdb });
    }
    posters.push({
      id,
      title: item.show.title?.trim() || "Untitled",
      subtitle: [episodeLine, episodeTitle].filter(Boolean).join(" · "),
      overlay: se ?? "",
      overlayMuted: null,
      badge: null,
      badgeTone: "soon",
      artworkUrl: null,
      href: null,
      artworkKey: key,
      episodeType: item.episode.episode_type ?? null,
      airsAt: aired,
    });
  }
  const art = await resolveArtwork(refs);
  return posters.map((poster) => ({
    ...poster,
    artworkUrl: poster.artworkKey ? (art.get(poster.artworkKey) ?? null) : null,
  }));
}

type ArtRef = TraktArtRef;

type HistoryPoster = HomePoster & { artworkKey: string | null };

async function postersFromHistory(
  items: TraktHistoryItem[],
  now: Date,
): Promise<HomePoster[]> {
  const refs: ArtRef[] = [];
  const posters: HistoryPoster[] = items.map((item) => {
    const mapped = mapHistoryItem(item, now);
    if (mapped.artworkKey && mapped.tmdbId) {
      refs.push({
        key: mapped.artworkKey,
        kind: mapped.kind === "movie" ? "movie" : "tv",
        tmdbId: mapped.tmdbId,
      });
    }
    return mapped.poster;
  });
  const art = await resolveArtwork(refs);
  return posters.map((poster) => ({
    id: poster.id,
    title: poster.title,
    subtitle: poster.subtitle,
    overlay: poster.overlay,
    overlayMuted: poster.overlayMuted,
    badge: poster.badge,
    badgeTone: poster.badgeTone,
    artworkUrl: poster.artworkKey ? (art.get(poster.artworkKey) ?? null) : null,
    href: poster.href,
  }));
}

function mapHistoryItem(
  item: TraktHistoryItem,
  now: Date,
): {
  poster: HistoryPoster;
  artworkKey: string | null;
  tmdbId: number | null;
  kind: "movie" | "episode";
} {
  const watchedAt = new Date(item.watched_at);
  const isMovie = item.type === "movie" || Boolean(item.movie && !item.episode);
  if (isMovie) {
    const tmdbId = item.movie?.ids.tmdb ?? null;
    const runtime = item.movie?.runtime ?? null;
    const key = tmdbId ? `movie:${tmdbId}` : null;
    return {
      kind: "movie",
      tmdbId,
      artworkKey: key,
      poster: {
        id: String(item.id ?? `${item.watched_at}-movie`),
        title: item.movie?.title?.trim() || "Untitled",
        subtitle: relativeFrom(watchedAt, now),
        overlay: "Movie",
        overlayMuted: runtimeLabel(runtime),
        badge: null,
        badgeTone: "soon",
        artworkUrl: null,
        href: null,
        artworkKey: key,
      },
    };
  }
  const showTmdb = item.show?.ids?.tmdb ?? null;
  const season = item.episode?.season ?? null;
  const number = item.episode?.number ?? null;
  const runtime = item.episode?.runtime ?? null;
  const key = showTmdb ? `show:${showTmdb}` : null;
  return {
    kind: "episode",
    tmdbId: showTmdb,
    artworkKey: key,
    poster: {
      id: String(item.id ?? `${item.watched_at}-episode`),
      title: item.show?.title?.trim() || "Untitled",
      subtitle: relativeFrom(watchedAt, now),
      overlay: formatSeasonEpisode(season, number) ?? "",
      overlayMuted: runtimeLabel(runtime),
      badge: null,
      badgeTone: "soon",
      artworkUrl: null,
      href: null,
      artworkKey: key,
    },
  };
}

function monthFromHistory(
  items: TraktHistoryItem[],
  timeZone: string,
  name: string,
): HomeMonth {
  const sorted = [...items].sort(
    (a, b) => Date.parse(a.watched_at) - Date.parse(b.watched_at),
  );
  const days = new Set<string>();
  let seconds = 0;
  for (const item of sorted) {
    const at = new Date(item.watched_at);
    if (Number.isNaN(at.getTime())) {
      continue;
    }
    days.add(isoDate(at, timeZone));
    const minutes = item.movie?.runtime ?? item.episode?.runtime;
    if (minutes) {
      seconds += minutes * 60;
    }
  }
  const first = sorted[0];
  let firstPlay: string | null = null;
  if (first) {
    const isMovie =
      first.type === "movie" || Boolean(first.movie && !first.episode);
    const title = isMovie
      ? (first.movie?.title?.trim() ?? "Untitled")
      : (first.show?.title?.trim() ?? "Untitled");
    const se = formatSeasonEpisode(
      first.episode?.season ?? null,
      first.episode?.number ?? null,
    );
    const when = new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(first.watched_at));
    firstPlay = `First play · ${title}${se ? ` ${se}` : ""} · ${when}`;
  }
  return {
    name,
    plays: sorted.length,
    hours: seconds / 3600,
    hoursLabel: formatHoursLocal(seconds),
    daysActive: days.size,
    firstPlay,
  };
}

function runtimeLabel(minutes: number | null | undefined): string | null {
  if (minutes == null || minutes <= 0) {
    return null;
  }
  return `${Math.round(minutes)} MIN`;
}

function relativeFrom(from: Date, now: Date): string {
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

function formatHoursLocal(seconds: number): string {
  const hours = seconds / 3600;
  const rounded = Math.round(hours * 10) / 10;
  if (Number.isInteger(rounded)) {
    return String(rounded);
  }
  return rounded.toFixed(1);
}

async function resolveArtwork(refs: ArtRef[]): Promise<Map<string, string>> {
  const unique = [...new Map(refs.map((ref) => [ref.key, ref])).values()];
  const ids = unique.map((ref) => ref.tmdbId);
  const local = localArtworkMap(ids);
  const out = new Map<string, string>();
  const missing: ArtRef[] = [];
  for (const ref of unique) {
    const hit =
      local.get(ref.key) ??
      (ref.kind === "tv" ? local.get(`show:${ref.tmdbId}`) : undefined);
    if (hit) {
      out.set(ref.key, hit);
    } else {
      missing.push(ref);
    }
  }
  const tmdb = getConnection("tmdb");
  const key = tmdb ? readAccessToken(tmdb) : null;
  if (!key) {
    return out;
  }
  await mapPool(missing, TMDB_LOOKUP_CONCURRENCY, async (ref) => {
    const url = await tmdbPosterUrl(key, ref.kind, ref.tmdbId);
    if (url) {
      out.set(ref.key, url);
    }
  });
  return out;
}

function localArtworkMap(ids: number[]): Map<string, string> {
  const map = new Map<string, string>();
  const filtered = ids.filter((id) => Number.isFinite(id));
  if (filtered.length === 0) {
    return map;
  }
  const rows = getDb()
    .select({
      kind: mediaItems.kind,
      tmdbId: mediaItems.tmdbId,
      showTmdbId: mediaItems.showTmdbId,
      artworkUrl: mediaItems.artworkUrl,
    })
    .from(mediaItems)
    .where(
      or(
        inArray(mediaItems.tmdbId, filtered),
        inArray(mediaItems.showTmdbId, filtered),
      ),
    )
    .all();
  for (const row of rows) {
    if (!row.artworkUrl) {
      continue;
    }
    if (row.kind === "movie" && row.tmdbId) {
      map.set(`movie:${row.tmdbId}`, row.artworkUrl);
    }
    if (row.showTmdbId) {
      map.set(`show:${row.showTmdbId}`, row.artworkUrl);
    }
  }
  return map;
}

export function emptyMonth(name: string): HomeMonth {
  return {
    name,
    plays: 0,
    hours: 0,
    hoursLabel: "0",
    daysActive: 0,
    firstPlay: null,
  };
}

export function logHomeTraktError(err: unknown): void {
  logger.warn({ err }, "home trakt fetch failed");
}
