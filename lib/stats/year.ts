import { inArray } from "drizzle-orm";
import { refreshTraktConnection } from "../connections/service";
import { getConnection, readAccessToken } from "../connections/store";
import { getDb } from "../db";
import { ratings } from "../db/schema";
import { logHomeTraktError, traktCreds } from "../home/trakt";
import { timezone } from "../ingest/run";
import { tmdbImageUrl, tmdbTitleMeta } from "../tmdb/poster";
import { type TraktHistoryItem, traktHistoryInRange } from "../trakt/history";
import {
  type GenreBar,
  type GenreWatch,
  genreWatchFromPlays,
  hydrateMonthPlays,
  type MonthBar,
  type MonthMoment,
  type MonthPlay,
  type MonthRanked,
  playBackdropUrl,
  playToMoment,
  serviceBars,
  uniqueGenreBars,
} from "./month";
import {
  formatHours,
  hourInZone,
  isoDate,
  listRecentYears,
  type MonthId,
  monthIdAt,
  monthName,
  weekdayInZone,
  yearBounds,
} from "./period";

export type YearMonthBar = {
  month: number;
  key: string;
  label: string;
  short: string;
  hours: number;
  plays: number;
  seconds: number;
  tone: "peak" | "past" | "current" | "empty";
};

export type YearChartBar = {
  key: string;
  label: string;
  plays: number;
  seconds: number;
};

export type YearKindStats = {
  title: string;
  badge: string;
  hoursLabel: string;
  plays: number;
  hoursPerMonth: string;
  hoursPerWeek: string;
  hoursPerDay: string;
  playsPerMonth: string;
  playsPerWeek: string;
  playsPerDay: string;
  weeks: YearChartBar[];
  months: YearChartBar[];
  weekdays: YearChartBar[];
  hoursOfDay: YearChartBar[];
};

export type YearBusiestDay = {
  dayLabel: string;
  weekday: string;
  hoursLabel: string;
  plays: number;
  posters: Array<{
    id: string;
    title: string;
    overlay: string;
    artworkUrl: string | null;
  }>;
};

export type YearRanked = MonthRanked;

export type YearGenreBar = GenreBar;

export type YearOrgs = {
  networksByTmdb: Map<number, string[]>;
  companiesByTmdb: Map<number, string[]>;
  logoByName: Map<string, string | null>;
};

export type YearReview = {
  year: number;
  prevYear: number;
  nextYear: number;
  years: number[];
  timeZone: string;
  empty: boolean;
  traktConnected: boolean;
  live: boolean;
  plays: number;
  moviePlays: number;
  tvPlays: number;
  hoursLabel: string;
  hoursSeconds: number;
  fullDaysLabel: string;
  summary: string;
  vsLastYear: string | null;
  busiestMonth: { name: string; line: string } | null;
  newShare: string | null;
  rewatchShare: string | null;
  months: YearMonthBar[];
  first: MonthMoment | null;
  last: MonthMoment | null;
  binge: MonthMoment | null;
  busiestDay: YearBusiestDay | null;
  tvServices: MonthBar[];
  movieServices: MonthBar[];
  movieGenres: YearGenreBar[];
  tvGenres: YearGenreBar[];
  movieGenreWatch: GenreWatch;
  tvGenreWatch: GenreWatch;
  tvNetworks: MonthBar[];
  movieStudios: MonthBar[];
  movies: YearKindStats;
  tv: YearKindStats;
  topShows: YearRanked[];
  topMovies: YearRanked[];
};

export type YearBundle = {
  review: YearReview;
  rows: MonthPlay[];
};

export async function loadYearReview(
  year: number,
  now = new Date(),
): Promise<YearReview> {
  const { review } = await loadYearBundle(year, now);
  return review;
}

export async function loadYearBundle(
  year: number,
  now = new Date(),
): Promise<YearBundle> {
  const timeZone = timezone();
  const current = monthIdAt(now, timeZone);
  const live = year === current.year;
  const { start, end } = yearBounds(year, timeZone);
  const prevBounds = yearBounds(year - 1, timeZone);
  const fetched = await loadTraktYear(
    start,
    end,
    prevBounds.start,
    prevBounds.end,
  );
  const plays = await hydrateMonthPlays(fetched.items);
  const review = yearReviewFromPlays({
    year,
    now,
    timeZone,
    live,
    plays,
    prevPlays: fetched.prevCount,
    years: listRecentYears(now, timeZone, year),
    traktConnected: fetched.connected,
    orgs: await loadTitleOrgs(plays),
    ratingsByTitle: movieRatingsByTitle(plays),
  });
  return {
    review: await withYearBackdrops(review, plays, timeZone),
    rows: plays,
  };
}

export function yearReviewFromPlays(input: {
  year: number;
  now: Date;
  timeZone: string;
  live: boolean;
  plays: MonthPlay[];
  prevPlays: number;
  years: number[];
  traktConnected: boolean;
  orgs?: YearOrgs;
  ratingsByTitle?: Map<string, number>;
}): YearReview {
  const { year, now, timeZone, live, plays, prevPlays, years } = input;
  const current = monthIdAt(now, timeZone);
  const months = monthBars(plays, year, timeZone, live ? current : null);
  const seconds = plays.reduce((sum, play) => sum + play.seconds, 0);
  const fullDays = Math.max(0, Math.round(seconds / 86400));
  const fullDaysLabel = `${fullDays} full ${fullDays === 1 ? "day" : "days"}`;
  const peak = [...months].sort(
    (a, b) => b.plays - a.plays || b.seconds - b.seconds,
  )[0];
  const moviePlays = plays.filter((play) => play.kind === "movie").length;
  const split = newRewatch(plays);
  const elapsed = elapsedUnits(year, now, timeZone, live);
  const binge = longestBinge(plays, timeZone);
  const busy = busiestDay(plays, timeZone);
  const firstPlay = plays[0];
  const lastPlay = plays[plays.length - 1];
  const bingePlay = bingePlayOf(plays, binge, timeZone);
  const empty = plays.length === 0;
  const first = firstPlay ? playToMoment(firstPlay, timeZone) : null;
  const last = lastPlay ? playToMoment(lastPlay, timeZone) : null;
  const bingeMoment = bingePlay
    ? {
        ...playToMoment(bingePlay, timeZone),
        line: `${binge?.episodes} episodes · ${formatHours(binge?.seconds ?? 0)} hours`,
        when: binge?.dayLabel ?? "",
      }
    : null;
  return {
    year,
    prevYear: year - 1,
    nextYear: year + 1,
    years,
    timeZone,
    empty,
    traktConnected: input.traktConnected,
    live,
    plays: plays.length,
    moviePlays,
    tvPlays: plays.length - moviePlays,
    hoursLabel: formatHours(seconds),
    hoursSeconds: seconds,
    fullDaysLabel,
    summary: empty
      ? input.traktConnected
        ? "No Trakt plays in this year"
        : "Connect Trakt to load this year"
      : `The equivalent of ${fullDaysLabel}${live ? " · live year so far" : ""}`,
    vsLastYear: formatYearDelta(plays.length, prevPlays, year - 1),
    busiestMonth:
      peak && peak.plays > 0
        ? {
            name: peak.label.slice(0, 3),
            line: `${peak.plays} ${peak.plays === 1 ? "play" : "plays"} · ${formatHours(peak.seconds)}h`,
          }
        : null,
    newShare: empty ? null : `${split.newPct}%`,
    rewatchShare: empty ? null : `${split.rewatchPct}% rewatch`,
    months,
    first,
    last,
    binge: bingeMoment,
    busiestDay: busy
      ? {
          dayLabel: busy.dayLabel,
          weekday: busy.weekday,
          hoursLabel: formatHours(busy.seconds),
          plays: plays.filter(
            (play) => isoDate(play.watchedAt, timeZone) === busy.day,
          ).length,
          posters: dayPosters(
            plays.filter(
              (play) => isoDate(play.watchedAt, timeZone) === busy.day,
            ),
          ),
        }
      : null,
    tvServices: serviceBars(
      plays.filter((play) => play.kind === "episode"),
      true,
    ),
    movieServices: serviceBars(
      plays.filter((play) => play.kind === "movie"),
      true,
    ),
    movieGenres: uniqueGenreBars(plays, "movie"),
    tvGenres: uniqueGenreBars(plays, "episode"),
    movieGenreWatch: genreWatchFromPlays(plays, "movie"),
    tvGenreWatch: genreWatchFromPlays(plays, "episode"),
    tvNetworks: uniqueOrgBars(
      plays,
      "episode",
      (tmdbId) => input.orgs?.networksByTmdb.get(tmdbId) ?? [],
      "primary",
      NAMED_ORGS,
      input.orgs?.logoByName,
    ),
    movieStudios: uniqueOrgBars(
      plays,
      "movie",
      (tmdbId) => input.orgs?.companiesByTmdb.get(tmdbId) ?? [],
      "all",
      NAMED_ORGS,
      input.orgs?.logoByName,
    ),
    movies: kindStats(plays, "movie", year, timeZone, elapsed),
    tv: kindStats(plays, "episode", year, timeZone, elapsed),
    topShows: rankedShows(plays, binge, busy, lastPlay),
    topMovies: rankedMovies(plays, firstPlay, input.ratingsByTitle),
  };
}

async function loadTraktYear(
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
        traktHistoryInRange(clientId, token, start, end, 50),
        traktHistoryInRange(clientId, token, prevStart, prevEnd, 50),
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
      logHomeTraktError(new Error(`trakt year history ${current.status}`));
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

function monthBars(
  plays: MonthPlay[],
  year: number,
  timeZone: string,
  current: MonthId | null,
): YearMonthBar[] {
  const buckets = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    key: `${year}-${String(index + 1).padStart(2, "0")}`,
    label: monthName({ year, month: index + 1 }, timeZone),
    short: "JFMAMJJASOND"[index] ?? "",
    hours: 0,
    plays: 0,
    seconds: 0,
    tone: "empty" as YearMonthBar["tone"],
  }));
  for (const play of plays) {
    const id = monthIdAt(play.watchedAt, timeZone);
    if (id.year !== year) {
      continue;
    }
    const bucket = buckets[id.month - 1];
    if (!bucket) {
      continue;
    }
    bucket.plays += 1;
    bucket.seconds += play.seconds;
    bucket.hours = bucket.seconds / 3600;
  }
  let peakIndex = 0;
  for (let index = 1; index < 12; index += 1) {
    const bucket = buckets[index];
    const peak = buckets[peakIndex];
    if (
      bucket &&
      peak &&
      (bucket.plays > peak.plays ||
        (bucket.plays === peak.plays && bucket.seconds > peak.seconds))
    ) {
      peakIndex = index;
    }
  }
  return buckets.map((bucket, index) => {
    const future =
      current != null &&
      (year > current.year ||
        (year === current.year && bucket.month > current.month));
    const isCurrent =
      current != null &&
      year === current.year &&
      bucket.month === current.month;
    let tone: YearMonthBar["tone"] = "empty";
    if (bucket.plays > 0 && index === peakIndex) {
      tone = "peak";
    } else if (isCurrent) {
      tone = "current";
    } else if (bucket.plays > 0 && !future) {
      tone = "past";
    }
    return { ...bucket, tone };
  });
}

function newRewatch(plays: MonthPlay[]): {
  newPct: number;
  rewatchPct: number;
} {
  const seen = new Set<string>();
  let fresh = 0;
  for (const play of plays) {
    const key = playKey(play);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    fresh += 1;
  }
  const newPct = Math.round((fresh / Math.max(1, plays.length)) * 100);
  return { newPct, rewatchPct: Math.max(0, 100 - newPct) };
}

function playKey(play: MonthPlay): string {
  if (play.kind === "movie") {
    return `movie:${play.tmdbId ?? play.title}`;
  }
  return `ep:${play.tmdbId ?? "x"}:${play.showTitle ?? play.title}:${play.seasonNumber ?? 0}:${play.episodeNumber ?? 0}`;
}

function longestBinge(
  plays: MonthPlay[],
  timeZone: string,
): {
  title: string;
  episodes: number;
  seconds: number;
  day: string;
  dayLabel: string;
} | null {
  const byShowDay = new Map<
    string,
    { title: string; day: string; eps: number; seconds: number; at: Date }
  >();
  for (const play of plays) {
    if (play.kind !== "episode") {
      continue;
    }
    const title = play.showTitle ?? play.title;
    const day = isoDate(play.watchedAt, timeZone);
    const key = `${title}::${day}`;
    const current = byShowDay.get(key) ?? {
      title,
      day,
      eps: 0,
      seconds: 0,
      at: play.watchedAt,
    };
    current.eps += 1;
    current.seconds += play.seconds;
    byShowDay.set(key, current);
  }
  let best: {
    title: string;
    day: string;
    eps: number;
    seconds: number;
    at: Date;
  } | null = null;
  for (const row of byShowDay.values()) {
    if (
      !best ||
      row.eps > best.eps ||
      (row.eps === best.eps && row.seconds > best.seconds)
    ) {
      best = row;
    }
  }
  if (!best || best.eps < 2) {
    return null;
  }
  return {
    title: best.title,
    episodes: best.eps,
    seconds: best.seconds,
    day: best.day,
    dayLabel: shortDate(best.at, timeZone),
  };
}

function busiestDay(
  plays: MonthPlay[],
  timeZone: string,
): {
  day: string;
  dayLabel: string;
  weekday: string;
  seconds: number;
  showTitle: string | null;
} | null {
  const days = new Map<
    string,
    { seconds: number; at: Date; shows: Map<string, number> }
  >();
  for (const play of plays) {
    const day = isoDate(play.watchedAt, timeZone);
    const current = days.get(day) ?? {
      seconds: 0,
      at: play.watchedAt,
      shows: new Map<string, number>(),
    };
    current.seconds += play.seconds;
    if (play.kind === "episode") {
      const title = play.showTitle ?? play.title;
      current.shows.set(title, (current.shows.get(title) ?? 0) + play.seconds);
    }
    days.set(day, current);
  }
  let best: {
    day: string;
    seconds: number;
    at: Date;
    shows: Map<string, number>;
  } | null = null;
  for (const [day, row] of days) {
    if (!best || row.seconds > best.seconds) {
      best = { day, seconds: row.seconds, at: row.at, shows: row.shows };
    }
  }
  if (!best) {
    return null;
  }
  let showTitle: string | null = null;
  let showSeconds = 0;
  for (const [title, seconds] of best.shows) {
    if (seconds > showSeconds) {
      showTitle = title;
      showSeconds = seconds;
    }
  }
  return {
    day: best.day,
    dayLabel: shortDate(best.at, timeZone),
    weekday: new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long",
    }).format(best.at),
    seconds: best.seconds,
    showTitle,
  };
}

function rankedShows(
  plays: MonthPlay[],
  binge: { title: string; episodes: number } | null,
  busy: { dayLabel: string; showTitle: string | null } | null,
  lastPlay: MonthPlay | undefined,
): YearRanked[] {
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
  const lastTitle =
    lastPlay?.kind === "episode"
      ? (lastPlay.showTitle ?? lastPlay.title)
      : null;
  return [...map.values()]
    .sort((a, b) => b.plays - a.plays || b.seconds - a.seconds)
    .slice(0, 10)
    .map((row) => ({
      title: row.title,
      artworkUrl: row.artworkUrl,
      plays: row.plays,
      hoursLabel: formatHours(row.seconds),
      note: showNote(row.title, row.plays, binge, busy, lastTitle),
      backdropUrl: null,
    }));
}

function rankedMovies(
  plays: MonthPlay[],
  firstPlay: MonthPlay | undefined,
  ratingsByTitle?: Map<string, number>,
): YearRanked[] {
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
  const firstMovieTitle =
    firstPlay?.kind === "movie"
      ? firstPlay.title
      : plays.find((play) => play.kind === "movie")?.title;
  return [...map.values()]
    .sort((a, b) => b.plays - a.plays || b.seconds - a.seconds)
    .slice(0, 10)
    .map((row) => {
      const unmatched = row.tmdbId == null;
      const rating = ratingsByTitle?.get(row.title);
      let note = `${row.plays} ${row.plays === 1 ? "play" : "plays"} this year`;
      if (unmatched) {
        note = "Unmatched · no TMDB id";
      } else if (firstMovieTitle === row.title) {
        note = "First play this year";
      } else if (rating != null) {
        note = `Rated ${rating} · Trakt`;
      }
      return {
        title: row.title,
        artworkUrl: row.artworkUrl,
        plays: row.plays,
        hoursLabel: formatHours(row.seconds),
        note,
        backdropUrl: null,
        unmatched,
      };
    });
}

function showNote(
  title: string,
  plays: number,
  binge: { title: string; episodes: number } | null,
  busy: { dayLabel: string; showTitle: string | null } | null,
  lastTitle: string | null,
): string {
  if (binge?.title === title) {
    return `Longest binge · ${binge.episodes} episodes`;
  }
  if (busy?.showTitle === title) {
    return `Longest day · ${busy.dayLabel}`;
  }
  if (lastTitle === title) {
    return "Last play this year";
  }
  return `${plays} episodes this year`;
}

function formatYearDelta(
  current: number,
  previous: number,
  prevYear: number,
): string | null {
  if (previous === 0 && current === 0) {
    return null;
  }
  const delta = current - previous;
  if (delta === 0) {
    return `Same as ${prevYear}`;
  }
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta} vs ${prevYear}`;
}

async function withYearBackdrops(
  review: YearReview,
  plays: MonthPlay[],
  timeZone: string,
): Promise<YearReview> {
  const bingePlay = bingePlayOf(plays, longestBinge(plays, timeZone), timeZone);
  const firstByTitle = new Map<string, MonthPlay>();
  for (const play of plays) {
    const title =
      play.kind === "movie" ? play.title : (play.showTitle ?? play.title);
    if (!firstByTitle.has(title)) {
      firstByTitle.set(title, play);
    }
  }
  const [firstUrl, lastUrl, bingeUrl, showUrls, movieUrls] = await Promise.all([
    playBackdropUrl(plays[0]),
    playBackdropUrl(plays[plays.length - 1]),
    playBackdropUrl(bingePlay),
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
    first: review.first ? { ...review.first, backdropUrl: firstUrl } : null,
    last: review.last ? { ...review.last, backdropUrl: lastUrl } : null,
    binge: review.binge ? { ...review.binge, backdropUrl: bingeUrl } : null,
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

function bingePlayOf(
  plays: MonthPlay[],
  binge: { title: string; day: string } | null,
  timeZone: string,
): MonthPlay | undefined {
  if (!binge) {
    return undefined;
  }
  return plays.find(
    (play) =>
      play.kind === "episode" &&
      (play.showTitle ?? play.title) === binge.title &&
      isoDate(play.watchedAt, timeZone) === binge.day,
  );
}

function dayPosters(plays: MonthPlay[]) {
  const titles = new Map<
    string,
    {
      id: string;
      title: string;
      kind: "movie" | "episode";
      plays: number;
      seconds: number;
      artworkUrl: string | null;
    }
  >();
  for (const play of plays) {
    const title =
      play.kind === "movie" ? play.title : (play.showTitle ?? play.title);
    const key = `${play.kind}:${play.tmdbId ?? title}`;
    const current = titles.get(key) ?? {
      id: play.id,
      title,
      kind: play.kind,
      plays: 0,
      seconds: 0,
      artworkUrl: play.artworkUrl,
    };
    current.plays += 1;
    current.seconds += play.seconds;
    if (!current.artworkUrl) {
      current.artworkUrl = play.artworkUrl;
    }
    titles.set(key, current);
  }
  return [...titles.values()]
    .sort((a, b) => b.seconds - a.seconds || b.plays - a.plays)
    .slice(0, 6)
    .map((row) => ({
      id: row.id,
      title: row.title,
      overlay:
        row.kind === "movie"
          ? "Movie"
          : `${row.plays} ${row.plays === 1 ? "episode" : "episodes"}`,
      artworkUrl: row.artworkUrl,
    }));
}

function elapsedUnits(
  year: number,
  now: Date,
  timeZone: string,
  live: boolean,
): { days: number; weeks: number; months: number } {
  const { start, end } = yearBounds(year, timeZone);
  const stop = live ? now : end;
  const days = Math.max(1, (stop.getTime() - start.getTime()) / 86400000);
  return { days, weeks: days / 7, months: days / (365.25 / 12) };
}

function kindStats(
  plays: MonthPlay[],
  kind: "movie" | "episode",
  year: number,
  timeZone: string,
  elapsed: { days: number; weeks: number; months: number },
): YearKindStats {
  const subset = plays.filter((play) => play.kind === kind);
  const seconds = subset.reduce((sum, play) => sum + play.seconds, 0);
  const unique = new Set(
    subset.map((play) =>
      kind === "movie" ? play.title : (play.showTitle ?? play.title),
    ),
  );
  const per = (value: number, denom: number) => {
    const rounded = Math.round((value / Math.max(1, denom)) * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  };
  const weeks = Array.from({ length: 53 }, (_, index) => ({
    key: `w${index + 1}`,
    label: `Week ${index + 1}`,
    plays: 0,
    seconds: 0,
  }));
  const months = Array.from({ length: 12 }, (_, index) => ({
    key: String(index + 1),
    label: monthName({ year, month: index + 1 }, timeZone),
    plays: 0,
    seconds: 0,
  }));
  const weekdays = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ].map((label, index) => ({
    key: String(index),
    label,
    plays: 0,
    seconds: 0,
  }));
  const hoursOfDay = Array.from({ length: 24 }, (_, hour) => ({
    key: String(hour),
    label: hourClock(hour),
    plays: 0,
    seconds: 0,
  }));
  for (const play of subset) {
    const week = weeks[weekIndex(play.watchedAt, year, timeZone)];
    const month = months[monthIdAt(play.watchedAt, timeZone).month - 1];
    const weekday = weekdays[weekdayInZone(play.watchedAt, timeZone)];
    const hour = hoursOfDay[hourInZone(play.watchedAt, timeZone)];
    if (week) {
      week.plays += 1;
      week.seconds += play.seconds;
    }
    if (month) {
      month.plays += 1;
      month.seconds += play.seconds;
    }
    if (weekday) {
      weekday.plays += 1;
      weekday.seconds += play.seconds;
    }
    if (hour) {
      hour.plays += 1;
      hour.seconds += play.seconds;
    }
  }
  const hours = seconds / 3600;
  return {
    title: kind === "movie" ? "Movies" : "TV",
    badge:
      kind === "movie"
        ? `${unique.size} ${unique.size === 1 ? "MOVIE" : "MOVIES"}`
        : `${subset.length} ${subset.length === 1 ? "EPISODE" : "EPISODES"}`,
    hoursLabel: formatHours(seconds),
    plays: subset.length,
    hoursPerMonth: per(hours, elapsed.months),
    hoursPerWeek: per(hours, elapsed.weeks),
    hoursPerDay: per(hours, elapsed.days),
    playsPerMonth: per(subset.length, elapsed.months),
    playsPerWeek: per(subset.length, elapsed.weeks),
    playsPerDay: per(subset.length, elapsed.days),
    weeks,
    months,
    weekdays,
    hoursOfDay,
  };
}

function weekIndex(date: Date, year: number, timeZone: string): number {
  const start = yearBounds(year, timeZone).start;
  return Math.min(
    52,
    Math.max(
      0,
      Math.floor((date.getTime() - start.getTime()) / (7 * 86400000)),
    ),
  );
}

function hourClock(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve} ${period}`;
}

function shortDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
  }).format(date);
}

const NAMED_ORGS = 5;

export function uniqueOrgBars(
  plays: MonthPlay[],
  kind: "movie" | "episode",
  orgsFor: (tmdbId: number) => string[],
  mode: "primary" | "all",
  limit = NAMED_ORGS,
  logos?: Map<string, string | null>,
): MonthBar[] {
  const titles = new Map<string, { tmdbId: number | null; seconds: number }>();
  for (const play of plays) {
    if (play.kind !== kind) {
      continue;
    }
    const title =
      kind === "movie" ? play.title : (play.showTitle ?? play.title);
    const row = titles.get(title) ?? {
      tmdbId: play.tmdbId,
      seconds: 0,
    };
    row.seconds += play.seconds;
    if (row.tmdbId == null) {
      row.tmdbId = play.tmdbId;
    }
    titles.set(title, row);
  }
  const counts = new Map<string, { plays: number; seconds: number }>();
  for (const row of titles.values()) {
    if (row.tmdbId == null) {
      continue;
    }
    const names = orgsFor(row.tmdbId);
    const picked = mode === "primary" ? names.slice(0, 1) : names;
    if (picked.length === 0) {
      continue;
    }
    const seen = new Set<string>();
    for (const name of picked) {
      const trimmed = name.trim();
      if (!trimmed || seen.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      const current = counts.get(trimmed) ?? { plays: 0, seconds: 0 };
      current.plays += 1;
      current.seconds += row.seconds;
      counts.set(trimmed, current);
    }
  }
  return [...counts.entries()]
    .map(([name, value]) => ({
      name,
      plays: value.plays,
      seconds: value.seconds,
      shows: kind === "episode" ? value.plays : 0,
      movies: kind === "movie" ? value.plays : 0,
      logoUrl: tmdbImageUrl(logos?.get(name), "w154"),
    }))
    .sort((a, b) => b.plays - a.plays || b.seconds - a.seconds)
    .slice(0, limit);
}

async function loadTitleOrgs(plays: MonthPlay[]): Promise<YearOrgs> {
  const networksByTmdb = new Map<number, string[]>();
  const companiesByTmdb = new Map<number, string[]>();
  const logoByName = new Map<string, string | null>();
  const tmdb = getConnection("tmdb");
  const key = tmdb ? readAccessToken(tmdb) : null;
  if (!key) {
    return { networksByTmdb, companiesByTmdb, logoByName };
  }
  const refs = uniqueTmdbRefs(plays);
  await mapPool(refs, 5, async (ref) => {
    const meta = await tmdbTitleMeta(key, ref.kind, ref.tmdbId);
    if (ref.kind === "tv") {
      networksByTmdb.set(ref.tmdbId, meta.networks);
      for (const org of meta.networkOrgs) {
        rememberLogo(logoByName, org.name, org.logoPath);
      }
    } else {
      companiesByTmdb.set(ref.tmdbId, meta.companies);
      for (const org of meta.companyOrgs) {
        rememberLogo(logoByName, org.name, org.logoPath);
      }
    }
  });
  return { networksByTmdb, companiesByTmdb, logoByName };
}

function rememberLogo(
  logos: Map<string, string | null>,
  name: string,
  logoPath: string | null,
): void {
  const existing = logos.get(name);
  if (existing || (!logoPath && logos.has(name))) {
    return;
  }
  logos.set(name, logoPath);
}

function uniqueTmdbRefs(plays: MonthPlay[]): Array<{
  kind: "movie" | "tv";
  tmdbId: number;
}> {
  const seen = new Set<string>();
  const refs: Array<{ kind: "movie" | "tv"; tmdbId: number }> = [];
  for (const play of plays) {
    if (play.tmdbId == null) {
      continue;
    }
    const kind = play.kind === "movie" ? "movie" : "tv";
    const key = `${kind}:${play.tmdbId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    refs.push({ kind, tmdbId: play.tmdbId });
  }
  return refs;
}

async function mapPool<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) {
    return;
  }
  let index = 0;
  const worker = async () => {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      if (item) {
        await fn(item);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
}

function movieRatingsByTitle(plays: MonthPlay[]): Map<string, number> {
  const out = new Map<string, number>();
  const ids = [
    ...new Set(
      plays
        .filter((play) => play.kind === "movie" && play.mediaItemId)
        .map((play) => play.mediaItemId as string),
    ),
  ];
  if (ids.length === 0) {
    return out;
  }
  const rows = getDb()
    .select({
      mediaItemId: ratings.mediaItemId,
      rating: ratings.rating,
      source: ratings.source,
    })
    .from(ratings)
    .where(inArray(ratings.mediaItemId, ids))
    .all();
  const byMedia = new Map<string, { rating: number; source: string }>();
  for (const row of rows) {
    const current = byMedia.get(row.mediaItemId);
    if (!current || (current.source !== "trakt" && row.source === "trakt")) {
      byMedia.set(row.mediaItemId, row);
    }
  }
  for (const play of plays) {
    if (play.kind !== "movie" || !play.mediaItemId) {
      continue;
    }
    const row = byMedia.get(play.mediaItemId);
    if (row && !out.has(play.title)) {
      out.set(play.title, row.rating);
    }
  }
  return out;
}
