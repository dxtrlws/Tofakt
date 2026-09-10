import { and, desc, gte, inArray, lt, or } from "drizzle-orm";
import { refreshTraktConnection } from "../connections/service";
import { getConnection, readAccessToken } from "../connections/store";
import { getDb } from "../db";
import { mediaItems, providerSnapshots, ratings } from "../db/schema";
import { formatSeasonEpisode } from "../history/query";
import {
  logHomeTraktError,
  resolveTraktArtwork,
  traktCreds,
} from "../home/trakt";
import { timezone } from "../ingest/run";
import { tmdbBackdropUrl, tmdbImageUrl } from "../tmdb/poster";
import { type TraktHistoryItem, traktHistoryInRange } from "../trakt/history";
import {
  formatDelta,
  formatHours,
  hourInZone,
  isoDate,
  type MonthId,
  monthBounds,
  monthKey,
  monthName,
  shiftMonth,
  weekdayInZone,
} from "./period";

export type MonthPlay = {
  id: string;
  title: string;
  showTitle: string | null;
  kind: "movie" | "episode";
  seasonNumber: number | null;
  episodeNumber: number | null;
  artworkUrl: string | null;
  artworkKey: string | null;
  tmdbId: number | null;
  watchedAt: Date;
  seconds: number;
  genres: string[];
  mediaItemId: string | null;
  tofaMediaId: string | null;
};

export type MonthBar = {
  name: string;
  plays: number;
  seconds: number;
  shows?: number;
  movies?: number;
  logoUrl?: string | null;
};

export type GenreBar = MonthBar & { caption: string };

export type GenreWatch = {
  most: { name: string; count: number } | null;
  least: { name: string; count: number } | null;
  count: number;
};

export type MonthRanked = {
  title: string;
  artworkUrl: string | null;
  backdropUrl: string | null;
  plays: number;
  hoursLabel: string;
  note: string;
  unmatched?: boolean;
};

export type MonthReview = {
  id: MonthId;
  name: string;
  year: number;
  monthKey: string;
  prevKey: string;
  nextKey: string;
  years: number[];
  timeZone: string;
  empty: boolean;
  traktConnected: boolean;
  plays: number;
  moviePlays: number;
  tvPlays: number;
  hoursLabel: string;
  hoursSeconds: number;
  daysActive: number;
  peakHourLabel: string | null;
  vsLastMonth: string | null;
  first: MonthMoment | null;
  last: MonthMoment | null;
  posters: Array<{
    id: string;
    title: string;
    overlay: string;
    artworkUrl: string | null;
  }>;
  services: MonthBar[];
  movieGenres: GenreBar[];
  tvGenres: GenreBar[];
  movieGenreWatch: GenreWatch;
  tvGenreWatch: GenreWatch;
  daily: number[];
  hoursPerActiveDay: string;
  playsPerActiveDay: string;
  topShows: MonthRanked[];
  topMovies: MonthRanked[];
  ratingsCount: number;
  ratingsAvg: string | null;
  ratingsSource: string | null;
  ratingsBuckets: number[];
  heatmap: boolean[][];
  heatmapHours: number[][];
};

export type MonthMoment = {
  title: string;
  line: string;
  when: string;
  artworkUrl: string | null;
  backdropUrl: string | null;
};

export type MonthBundle = {
  review: MonthReview;
  rows: MonthPlay[];
};

export async function loadMonthReview(
  id: MonthId,
  now = new Date(),
): Promise<MonthReview> {
  const { review } = await loadMonthBundle(id, now);
  return review;
}

export async function loadMonthBundle(
  id: MonthId,
  now = new Date(),
): Promise<MonthBundle> {
  const timeZone = timezone();
  const { start, end } = monthBounds(id, timeZone);
  const prev = shiftMonth(id, -1);
  const prevBounds = monthBounds(prev, timeZone);
  const years = listYears(timeZone, now, id.year);
  const fetched = await loadTraktPlays(
    start,
    end,
    prevBounds.start,
    prevBounds.end,
  );
  const plays = attachLocalMedia(
    await withArtwork(playsFromTraktItems(fetched.items)),
  );
  const review = await withMomentBackdrops(
    monthReviewFromPlays({
      id,
      now,
      timeZone,
      plays,
      prevPlays: fetched.prevCount,
      years,
      ratings: listRatings(start, end),
      traktConnected: fetched.connected,
    }),
    plays,
  );
  return { review, rows: plays };
}

export async function monthExportRows(id: MonthId, now = new Date()) {
  const { rows } = await loadMonthBundle(id, now);
  return rows;
}

export function playsFromTraktItems(items: TraktHistoryItem[]): MonthPlay[] {
  const plays: MonthPlay[] = [];
  for (const item of items) {
    const watchedAt = new Date(item.watched_at);
    if (Number.isNaN(watchedAt.getTime())) {
      continue;
    }
    const isMovie =
      item.type === "movie" || Boolean(item.movie && !item.episode);
    if (isMovie) {
      const tmdbId = item.movie?.ids.tmdb ?? null;
      const runtime = item.movie?.runtime ?? 0;
      plays.push({
        id: String(item.id ?? `${item.watched_at}-movie`),
        title: item.movie?.title?.trim() || "Untitled",
        showTitle: null,
        kind: "movie",
        seasonNumber: null,
        episodeNumber: null,
        artworkUrl: null,
        artworkKey: tmdbId ? `movie:${tmdbId}` : null,
        tmdbId,
        watchedAt,
        seconds: Math.max(0, runtime) * 60,
        genres: (item.movie?.genres ?? []).map(displayGenre),
        mediaItemId: null,
        tofaMediaId: null,
      });
      continue;
    }
    const tmdbId = item.show?.ids?.tmdb ?? null;
    const runtime = item.episode?.runtime ?? 0;
    plays.push({
      id: String(item.id ?? `${item.watched_at}-episode`),
      title: item.episode?.title?.trim() || "Untitled",
      showTitle: item.show?.title?.trim() || null,
      kind: "episode",
      seasonNumber: item.episode?.season ?? null,
      episodeNumber: item.episode?.number ?? null,
      artworkUrl: null,
      artworkKey: tmdbId ? `show:${tmdbId}` : null,
      tmdbId,
      watchedAt,
      seconds: Math.max(0, runtime) * 60,
      genres: (item.show?.genres ?? []).map(displayGenre),
      mediaItemId: null,
      tofaMediaId: null,
    });
  }
  return plays.sort((a, b) => a.watchedAt.getTime() - b.watchedAt.getTime());
}

export function monthReviewFromPlays(input: {
  id: MonthId;
  now: Date;
  timeZone: string;
  plays: MonthPlay[];
  prevPlays: number;
  years: number[];
  ratings: Array<{ rating: number; source: string }>;
  traktConnected: boolean;
}): MonthReview {
  const { id, timeZone, plays, prevPlays, years, ratings: ratingRows } = input;
  const prev = shiftMonth(id, -1);
  const next = shiftMonth(id, 1);
  const name = monthName(id, timeZone);
  const daysInMonth = new Date(Date.UTC(id.year, id.month, 0)).getUTCDate();
  const base = {
    id,
    name,
    year: id.year,
    monthKey: monthKey(id),
    prevKey: monthKey(prev),
    nextKey: monthKey(next),
    years,
    timeZone,
    traktConnected: input.traktConnected,
  };
  if (plays.length === 0) {
    return {
      ...base,
      empty: true,
      plays: 0,
      moviePlays: 0,
      tvPlays: 0,
      hoursLabel: "0",
      hoursSeconds: 0,
      daysActive: 0,
      peakHourLabel: null,
      vsLastMonth: prevPlays === 0 ? null : formatDelta(0, prevPlays),
      first: null,
      last: null,
      posters: [],
      services: [],
      movieGenres: [],
      tvGenres: [],
      movieGenreWatch: emptyGenreWatch(),
      tvGenreWatch: emptyGenreWatch(),
      daily: Array.from({ length: daysInMonth }, () => 0),
      hoursPerActiveDay: "0",
      playsPerActiveDay: "0",
      topShows: [],
      topMovies: [],
      ratingsCount: 0,
      ratingsAvg: null,
      ratingsSource: null,
      ratingsBuckets: Array.from({ length: 10 }, () => 0),
      heatmap: emptyHeatmap(id, timeZone),
      heatmapHours: emptyHeatmapHours(id, timeZone),
    };
  }
  const moviePlays = plays.filter((play) => play.kind === "movie").length;
  const tvPlays = plays.length - moviePlays;
  const seconds = plays.reduce((sum, play) => sum + play.seconds, 0);
  const daySet = new Set(
    plays.map((play) => isoDate(play.watchedAt, timeZone)),
  );
  const first = plays[0];
  const last = plays[plays.length - 1];
  return {
    ...base,
    empty: false,
    plays: plays.length,
    moviePlays,
    tvPlays,
    hoursLabel: formatHours(seconds),
    hoursSeconds: seconds,
    daysActive: daySet.size,
    peakHourLabel: peakHour(plays, timeZone),
    vsLastMonth: formatDelta(plays.length, prevPlays),
    first: first ? playToMoment(first, timeZone) : null,
    last: last ? playToMoment(last, timeZone) : null,
    posters: uniquePosters(plays),
    services: serviceBars(plays),
    movieGenres: uniqueGenreBars(plays, "movie"),
    tvGenres: uniqueGenreBars(plays, "episode"),
    movieGenreWatch: genreWatchFromPlays(plays, "movie"),
    tvGenreWatch: genreWatchFromPlays(plays, "episode"),
    daily: dailyCounts(plays, timeZone, daysInMonth),
    hoursPerActiveDay: formatHours(seconds / Math.max(1, daySet.size)),
    playsPerActiveDay: (plays.length / Math.max(1, daySet.size)).toFixed(1),
    topShows: rankedShows(plays),
    topMovies: rankedMovies(plays),
    ratingsCount: ratingRows.length,
    ratingsAvg: averageRating(ratingRows),
    ratingsSource: ratingRows[0]?.source === "tofa" ? "tofa" : "Trakt",
    ratingsBuckets: ratingBuckets(ratingRows),
    heatmap: heatmapFlags(plays, id, timeZone),
    heatmapHours: heatmapHours(plays, id, timeZone),
  };
}

async function loadTraktPlays(
  start: Date,
  end: Date,
  prevStart: Date,
  prevEnd: Date,
): Promise<{
  connected: boolean;
  items: TraktHistoryItem[];
  prevCount: number;
}> {
  try {
    let creds = await traktCreds();
    if (!creds) {
      return { connected: false, items: [], prevCount: 0 };
    }
    const pull = async (clientId: string, token: string) => {
      const [current, previous] = await Promise.all([
        traktHistoryInRange(clientId, token, start, end),
        traktHistoryInRange(clientId, token, prevStart, prevEnd),
      ]);
      return { current, previous };
    };
    let { current, previous } = await pull(creds.clientId, creds.token);
    if (current.status === 401 || previous.status === 401) {
      await refreshTraktConnection();
      creds = await traktCreds();
      if (!creds) {
        return { connected: false, items: [], prevCount: 0 };
      }
      ({ current, previous } = await pull(creds.clientId, creds.token));
    }
    if (current.status !== 200) {
      logHomeTraktError(new Error(`trakt month history ${current.status}`));
      return { connected: true, items: [], prevCount: 0 };
    }
    return {
      connected: true,
      items: current.items,
      prevCount: previous.status === 200 ? previous.items.length : 0,
    };
  } catch (err) {
    logHomeTraktError(err);
    return { connected: false, items: [], prevCount: 0 };
  }
}

async function withMomentBackdrops(
  review: MonthReview,
  plays: MonthPlay[],
): Promise<MonthReview> {
  if (!review.first || plays.length === 0) {
    return review;
  }
  const firstByTitle = new Map<string, MonthPlay>();
  for (const play of plays) {
    const title =
      play.kind === "movie" ? play.title : (play.showTitle ?? play.title);
    if (!firstByTitle.has(title)) {
      firstByTitle.set(title, play);
    }
  }
  const firstPlay = plays[0];
  const lastPlay = plays[plays.length - 1];
  const [firstUrl, lastUrl, showUrls, movieUrls] = await Promise.all([
    playBackdropUrl(firstPlay),
    playBackdropUrl(lastPlay),
    Promise.all(
      review.topShows.map((item) =>
        playBackdropUrl(firstByTitle.get(item.title)),
      ),
    ),
    Promise.all(
      review.topMovies.map((item) =>
        playBackdropUrl(firstByTitle.get(item.title)),
      ),
    ),
  ]);
  return {
    ...review,
    first: { ...review.first, backdropUrl: firstUrl },
    last: review.last ? { ...review.last, backdropUrl: lastUrl } : null,
    topShows: review.topShows.map((item, index) => ({
      ...item,
      backdropUrl: showUrls[index] ?? null,
    })),
    topMovies: review.topMovies.map((item, index) => ({
      ...item,
      backdropUrl: movieUrls[index] ?? null,
    })),
  };
}

export async function playBackdropUrl(
  play: MonthPlay | undefined,
): Promise<string | null> {
  if (!play) {
    return null;
  }
  const tmdb = getConnection("tmdb");
  const key = tmdb ? readAccessToken(tmdb) : null;
  if (key && play.tmdbId != null) {
    const url = await tmdbBackdropUrl(
      key,
      play.kind === "movie" ? "movie" : "tv",
      play.tmdbId,
    );
    if (url) {
      return url;
    }
  }
  if (play.tofaMediaId) {
    return `/api/artwork/${play.tofaMediaId}/backdrop`;
  }
  return null;
}

export async function hydrateMonthPlays(
  items: TraktHistoryItem[],
): Promise<MonthPlay[]> {
  return attachLocalMedia(await withArtwork(playsFromTraktItems(items)));
}

async function withArtwork(plays: MonthPlay[]): Promise<MonthPlay[]> {
  const refs = plays.flatMap((play) => {
    if (!play.artworkKey || play.tmdbId == null) {
      return [];
    }
    return [
      {
        key: play.artworkKey,
        kind: play.kind === "movie" ? ("movie" as const) : ("tv" as const),
        tmdbId: play.tmdbId,
      },
    ];
  });
  const art = await resolveTraktArtwork(refs);
  return plays.map((play) => ({
    ...play,
    artworkUrl: play.artworkKey ? (art.get(play.artworkKey) ?? null) : null,
  }));
}

function attachLocalMedia(plays: MonthPlay[]): MonthPlay[] {
  const ids = [
    ...new Set(
      plays.map((play) => play.tmdbId).filter((id): id is number => id != null),
    ),
  ];
  if (ids.length === 0) {
    return plays;
  }
  const rows = getDb()
    .select({
      id: mediaItems.id,
      kind: mediaItems.kind,
      tmdbId: mediaItems.tmdbId,
      showTmdbId: mediaItems.showTmdbId,
      tofaMediaId: mediaItems.tofaMediaId,
    })
    .from(mediaItems)
    .where(
      or(inArray(mediaItems.tmdbId, ids), inArray(mediaItems.showTmdbId, ids)),
    )
    .all();
  const movieByTmdb = new Map<
    number,
    { id: string; tofaMediaId: string | null }
  >();
  const showByTmdb = new Map<
    number,
    { id: string; tofaMediaId: string | null }
  >();
  for (const row of rows) {
    const value = { id: row.id, tofaMediaId: row.tofaMediaId };
    if (row.kind === "movie" && row.tmdbId) {
      movieByTmdb.set(row.tmdbId, value);
    }
    if (row.showTmdbId) {
      showByTmdb.set(row.showTmdbId, value);
    }
  }
  return plays.map((play) => {
    const local =
      play.kind === "movie"
        ? play.tmdbId != null
          ? (movieByTmdb.get(play.tmdbId) ?? null)
          : null
        : play.tmdbId != null
          ? (showByTmdb.get(play.tmdbId) ?? null)
          : null;
    return {
      ...play,
      mediaItemId: local?.id ?? null,
      tofaMediaId: local?.tofaMediaId ?? null,
    };
  });
}

function listYears(timeZone: string, now: Date, viewedYear: number): number[] {
  const current = Number(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric" }).format(now),
  );
  const years = new Set<number>([current, viewedYear]);
  for (let year = current - 7; year <= current; year += 1) {
    if (year >= 1970) {
      years.add(year);
    }
  }
  return [...years].sort((a, b) => a - b);
}

export function playToMoment(play: MonthPlay, timeZone: string): MonthMoment {
  const title =
    play.kind === "episode" ? (play.showTitle ?? play.title) : play.title;
  const se = formatSeasonEpisode(play.seasonNumber, play.episodeNumber);
  const when = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(play.watchedAt);
  return {
    title,
    line: se ? `${se} · ${play.title}` : "Movie",
    when: when.replace(" at ", " · "),
    artworkUrl: play.artworkUrl,
    backdropUrl: null,
  };
}

export function uniquePosters(plays: MonthPlay[]) {
  const seen = new Set<string>();
  const out: MonthReview["posters"] = [];
  for (const play of [...plays].reverse()) {
    const key =
      play.kind === "episode" ? (play.showTitle ?? play.title) : play.title;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const se = formatSeasonEpisode(play.seasonNumber, play.episodeNumber);
    out.push({
      id: play.id,
      title:
        play.kind === "episode" ? (play.showTitle ?? play.title) : play.title,
      overlay: se ?? "Movie",
      artworkUrl: play.artworkUrl,
    });
    if (out.length >= 12) {
      break;
    }
  }
  return out;
}

export function serviceBars(
  plays: MonthPlay[],
  uniqueTitles = false,
): MonthBar[] {
  const ids = plays
    .map((play) => play.mediaItemId)
    .filter((id): id is string => Boolean(id));
  const snapshots =
    ids.length === 0
      ? []
      : getDb()
          .select()
          .from(providerSnapshots)
          .where(inArray(providerSnapshots.mediaItemId, ids))
          .all();
  const byMedia = new Map<string, typeof snapshots>();
  for (const row of snapshots) {
    const list = byMedia.get(row.mediaItemId) ?? [];
    list.push(row);
    byMedia.set(row.mediaItemId, list);
  }
  const counts = new Map<
    string,
    {
      plays: number;
      seconds: number;
      titles: Set<string>;
      shows: Set<string>;
      movies: Set<string>;
      logoPath: string | null;
    }
  >();
  for (const play of plays) {
    const provider = primaryProvider(byMedia.get(play.mediaItemId ?? "") ?? []);
    const current = counts.get(provider.name) ?? {
      plays: 0,
      seconds: 0,
      titles: new Set<string>(),
      shows: new Set<string>(),
      movies: new Set<string>(),
      logoPath: provider.logoPath,
    };
    current.plays += 1;
    current.seconds += play.seconds;
    const title =
      play.kind === "movie" ? play.title : (play.showTitle ?? play.title);
    current.titles.add(title);
    if (play.kind === "movie") {
      current.movies.add(title);
    } else {
      current.shows.add(title);
    }
    if (!current.logoPath && provider.logoPath) {
      current.logoPath = provider.logoPath;
    }
    counts.set(provider.name, current);
  }
  return [...counts.entries()]
    .map(([name, value]) => ({
      name,
      plays: uniqueTitles ? value.titles.size : value.plays,
      seconds: value.seconds,
      shows: value.shows.size,
      movies: value.movies.size,
      logoUrl: tmdbImageUrl(value.logoPath, "w154"),
    }))
    .sort((a, b) => b.plays - a.plays || b.seconds - a.seconds);
}

function primaryProvider(
  rows: Array<{
    providerName: string;
    monetizationType: string;
    logoPath?: string | null;
  }>,
): { name: string; logoPath: string | null } {
  const order = ["flatrate", "ads", "free", "rent", "buy"];
  const ranked = [...rows].sort(
    (a, b) =>
      order.indexOf(a.monetizationType) - order.indexOf(b.monetizationType),
  );
  const row = ranked[0];
  if (!row) {
    return { name: "Not currently streaming", logoPath: null };
  }
  return displayProvider(row.providerName, row.logoPath ?? null);
}

/** TMDB channel packages we show under the parent service brand. */
const PROVIDER_DISPLAY: Record<string, { name: string; logoPath: string }> = {
  "HBO Max Amazon Channel": {
    name: "HBO Max",
    logoPath: "/skypuy7SXuugIQeYg0IglmzoKaS.png",
  },
};

export function displayProvider(
  name: string,
  logoPath: string | null,
): { name: string; logoPath: string | null } {
  const alias = PROVIDER_DISPLAY[name];
  if (!alias) {
    return { name, logoPath };
  }
  return { name: alias.name, logoPath: alias.logoPath };
}

export function genreBars(
  plays: MonthPlay[],
  kind: "movie" | "episode",
): MonthBar[] {
  const subset = plays.filter((play) => play.kind === kind);
  const counts = new Map<string, { plays: number; seconds: number }>();
  for (const play of subset) {
    const names = play.genres.length > 0 ? play.genres : ["Uncategorized"];
    for (const name of names) {
      const current = counts.get(name) ?? { plays: 0, seconds: 0 };
      current.plays += 1;
      current.seconds += play.seconds;
      counts.set(name, current);
    }
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 8);
}

const NAMED_GENRES = 7;

function emptyGenreWatch(): GenreWatch {
  return { most: null, least: null, count: 0 };
}

type GenreTally = {
  name: string;
  titles: number;
  seconds: number;
};

function tallyGenres(
  plays: MonthPlay[],
  kind: "movie" | "episode",
): GenreTally[] {
  const titles = new Map<string, { genres: Set<string>; seconds: number }>();
  for (const play of plays) {
    if (play.kind !== kind) {
      continue;
    }
    const title =
      kind === "movie" ? play.title : (play.showTitle ?? play.title);
    const row = titles.get(title) ?? { genres: new Set<string>(), seconds: 0 };
    row.seconds += play.seconds;
    const names = play.genres.length > 0 ? play.genres : ["Uncategorized"];
    for (const name of names) {
      row.genres.add(shortGenre(name));
    }
    titles.set(title, row);
  }
  const genreTitles = new Map<string, Set<string>>();
  const genreSeconds = new Map<string, number>();
  for (const [title, row] of titles) {
    for (const genre of row.genres) {
      const set = genreTitles.get(genre) ?? new Set<string>();
      set.add(title);
      genreTitles.set(genre, set);
      genreSeconds.set(genre, (genreSeconds.get(genre) ?? 0) + row.seconds);
    }
  }
  return [...genreTitles.entries()]
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .map(([name, set]) => ({
      name,
      titles: set.size,
      seconds: genreSeconds.get(name) ?? 0,
    }));
}

export function genreWatchFromPlays(
  plays: MonthPlay[],
  kind: "movie" | "episode",
): GenreWatch {
  const tallies = tallyGenres(plays, kind);
  const most = tallies[0];
  const least = tallies[tallies.length - 1];
  if (!most) {
    return emptyGenreWatch();
  }
  return {
    most: { name: most.name, count: most.titles },
    least:
      least && least.name !== most.name
        ? { name: least.name, count: least.titles }
        : null,
    count: tallies.length,
  };
}

export function uniqueGenreBars(
  plays: MonthPlay[],
  kind: "movie" | "episode",
): GenreBar[] {
  const unit = kind === "movie" ? "films" : "shows";
  const sorted = tallyGenres(plays, kind);
  const named = sorted.slice(0, NAMED_GENRES);
  const rest = sorted.slice(NAMED_GENRES);
  const bars: GenreBar[] = named.map((row) => ({
    name: row.name,
    plays: row.titles,
    seconds: row.seconds,
    caption: `${row.titles} ${row.titles === 1 ? unit.slice(0, -1) : unit}`,
  }));
  if (rest.length > 0) {
    bars.push({
      name: "Other",
      plays: Math.max(
        1,
        rest.reduce((sum, row) => sum + row.titles, 0),
      ),
      seconds: rest.reduce((sum, row) => sum + row.seconds, 0),
      caption: `${rest.length} ${rest.length === 1 ? "category" : "categories"}`,
    });
  }
  return bars;
}

function shortGenre(name: string): string {
  const compact = name
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
  if (compact === "science fiction" || compact === "sci fi") {
    return "Sci-Fi";
  }
  return name;
}

function dailyCounts(
  plays: MonthPlay[],
  timeZone: string,
  daysInMonth: number,
): number[] {
  const counts = Array.from({ length: daysInMonth }, () => 0);
  for (const play of plays) {
    const day = Number(isoDate(play.watchedAt, timeZone).slice(-2));
    if (day >= 1 && day <= daysInMonth) {
      counts[day - 1] += 1;
    }
  }
  return counts;
}

function rankedShows(plays: MonthPlay[]): MonthRanked[] {
  const map = new Map<
    string,
    { title: string; artworkUrl: string | null; plays: number; seconds: number }
  >();
  for (const play of plays) {
    if (play.kind !== "episode") {
      continue;
    }
    const title = play.showTitle ?? play.title;
    const current = map.get(title) ?? {
      title,
      artworkUrl: play.artworkUrl,
      plays: 0,
      seconds: 0,
    };
    current.plays += 1;
    current.seconds += play.seconds;
    if (!current.artworkUrl) {
      current.artworkUrl = play.artworkUrl;
    }
    map.set(title, current);
  }
  return [...map.values()]
    .sort((a, b) => b.plays - a.plays || b.seconds - a.seconds)
    .slice(0, 10)
    .map((row) => ({
      title: row.title,
      artworkUrl: row.artworkUrl,
      backdropUrl: null,
      plays: row.plays,
      hoursLabel: formatHours(row.seconds),
      note: `${row.plays} ${row.plays === 1 ? "episode" : "episodes"} this month`,
    }));
}

function rankedMovies(plays: MonthPlay[]): MonthRanked[] {
  const map = new Map<
    string,
    {
      title: string;
      artworkUrl: string | null;
      plays: number;
      seconds: number;
      tmdbId: number | null;
    }
  >();
  for (const play of plays) {
    if (play.kind !== "movie") {
      continue;
    }
    const current = map.get(play.title) ?? {
      title: play.title,
      artworkUrl: play.artworkUrl,
      plays: 0,
      seconds: 0,
      tmdbId: play.tmdbId,
    };
    current.plays += 1;
    current.seconds += play.seconds;
    if (!current.artworkUrl) {
      current.artworkUrl = play.artworkUrl;
    }
    map.set(play.title, current);
  }
  return [...map.values()]
    .sort((a, b) => b.plays - a.plays || b.seconds - a.seconds)
    .slice(0, 10)
    .map((row) => {
      const unmatched = row.tmdbId == null;
      return {
        title: row.title,
        artworkUrl: row.artworkUrl,
        backdropUrl: null,
        plays: row.plays,
        hoursLabel: formatHours(row.seconds),
        note: unmatched
          ? "Unmatched · no TMDB id"
          : `${row.plays} ${row.plays === 1 ? "play" : "plays"} this month`,
        unmatched,
      };
    });
}

function listRatings(start: Date, end: Date) {
  return getDb()
    .select()
    .from(ratings)
    .where(and(gte(ratings.ratedAt, start), lt(ratings.ratedAt, end)))
    .orderBy(desc(ratings.ratedAt))
    .all();
}

function averageRating(rows: Array<{ rating: number }>): string | null {
  if (rows.length === 0) {
    return null;
  }
  const avg = rows.reduce((sum, row) => sum + row.rating, 0) / rows.length;
  return (Math.round(avg * 10) / 10).toFixed(1);
}

function ratingBuckets(rows: Array<{ rating: number }>): number[] {
  const buckets = Array.from({ length: 10 }, () => 0);
  for (const row of rows) {
    const value = Math.min(10, Math.max(1, Math.round(row.rating)));
    buckets[value - 1] += 1;
  }
  return buckets;
}

function peakHour(plays: MonthPlay[], timeZone: string): string | null {
  const hours = new Array(24).fill(0);
  for (const play of plays) {
    hours[hourInZone(play.watchedAt, timeZone)] += 1;
  }
  let best = 0;
  for (let hour = 1; hour < 24; hour += 1) {
    if (hours[hour] > hours[best]) {
      best = hour;
    }
  }
  if (hours[best] === 0) {
    return null;
  }
  return `Peak hour ${hourClock(best)}`;
}

function hourClock(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:00 ${period}`;
}

function heatmapHours(
  plays: MonthPlay[],
  id: MonthId,
  timeZone: string,
): number[][] {
  const weeks = emptyHeatmapHours(id, timeZone);
  for (const play of plays) {
    const day = Number(isoDate(play.watchedAt, timeZone).slice(-2));
    const weekday = weekdayInZone(play.watchedAt, timeZone);
    const firstWeekday = weekdayInZone(
      monthBounds(id, timeZone).start,
      timeZone,
    );
    const index = firstWeekday + day - 1;
    const week = Math.floor(index / 7);
    if (weeks[weekday] && weeks[weekday][week] != null) {
      weeks[weekday][week] += play.seconds / 3600;
    }
  }
  return weeks;
}

function heatmapFlags(
  plays: MonthPlay[],
  id: MonthId,
  timeZone: string,
): boolean[][] {
  return heatmapHours(plays, id, timeZone).map((row) =>
    row.map((hours) => hours > 0),
  );
}

function emptyHeatmap(id: MonthId, timeZone: string): boolean[][] {
  return emptyHeatmapHours(id, timeZone).map((row) => row.map(() => false));
}

function emptyHeatmapHours(id: MonthId, timeZone: string): number[][] {
  const days = new Date(Date.UTC(id.year, id.month, 0)).getUTCDate();
  const first = weekdayInZone(monthBounds(id, timeZone).start, timeZone);
  const cells = first + days;
  const weeks = Math.ceil(cells / 7);
  return Array.from({ length: 7 }, () =>
    Array.from({ length: weeks }, () => 0),
  );
}

function displayGenre(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "Uncategorized";
  }
  return trimmed
    .split(/[-_]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
