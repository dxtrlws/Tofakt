import {
  formatHours,
  hourInZone,
  isoDate,
  type MonthId,
  monthBounds,
  monthIdAt,
  monthKey,
  monthName,
} from "./period";

export type KindChartBar = {
  key: string;
  label: string;
  plays: number;
  seconds: number;
};

export type KindWatchStats = {
  kind: "movie" | "episode";
  periodName: string;
  noun: string;
  hoursLabel: string;
  hoursSeconds: number;
  plays: number;
  headlineCount: number;
  mostActiveDay: { label: string; plays: number } | null;
  peakTime: string | null;
  bars: KindChartBar[];
  barGranularity: "day" | "month";
  hoursSeries: number[];
  playsSeries: number[];
  hoursPerWeek: string;
  hoursPerDay: string;
  playsPerWeek: string;
  playsPerDay: string;
};

type KindPlay = {
  kind: "movie" | "episode";
  title: string;
  showTitle: string | null;
  watchedAt: Date;
  seconds: number;
};

export function emptyKindWatch(
  kind: "movie" | "episode",
  periodName: string,
): KindWatchStats {
  return {
    kind,
    periodName,
    noun: kind === "movie" ? "Movies" : "TV Shows",
    hoursLabel: "0",
    hoursSeconds: 0,
    plays: 0,
    headlineCount: 0,
    mostActiveDay: null,
    peakTime: null,
    bars: [],
    barGranularity: "day",
    hoursSeries: [],
    playsSeries: [],
    hoursPerWeek: "0",
    hoursPerDay: "0",
    playsPerWeek: "0",
    playsPerDay: "0",
  };
}

export function elapsedDaysInRange(
  start: Date,
  end: Date,
  now: Date,
  live: boolean,
): number {
  const stop = live ? now : end;
  return Math.max(1, (stop.getTime() - start.getTime()) / 86400000);
}

export function monthElapsedDays(
  id: MonthId,
  now: Date,
  timeZone: string,
): number {
  const { start, end } = monthBounds(id, timeZone);
  const live = monthKey(id) === monthKey(monthIdAt(now, timeZone));
  return elapsedDaysInRange(start, end, now, live);
}

export function monthKindBars(
  plays: KindPlay[],
  timeZone: string,
  daysInMonth: number,
): KindChartBar[] {
  const bars = Array.from({ length: daysInMonth }, (_, index) => ({
    key: String(index + 1),
    label: String(index + 1),
    plays: 0,
    seconds: 0,
  }));
  for (const play of plays) {
    const day = Number(isoDate(play.watchedAt, timeZone).slice(-2));
    const bar = bars[day - 1];
    if (bar) {
      bar.plays += 1;
      bar.seconds += play.seconds;
    }
  }
  return bars;
}

export function yearKindBars(
  plays: KindPlay[],
  year: number,
  timeZone: string,
): KindChartBar[] {
  const bars = Array.from({ length: 12 }, (_, index) => ({
    key: String(index + 1),
    label: monthName({ year, month: index + 1 }, timeZone).slice(0, 3),
    plays: 0,
    seconds: 0,
  }));
  for (const play of plays) {
    const month = monthIdAt(play.watchedAt, timeZone).month;
    const bar = bars[month - 1];
    if (bar) {
      bar.plays += 1;
      bar.seconds += play.seconds;
    }
  }
  return bars;
}

export function buildKindWatchStats(input: {
  plays: KindPlay[];
  kind: "movie" | "episode";
  timeZone: string;
  periodName: string;
  elapsedDays: number;
  bars: KindChartBar[];
  barGranularity?: "day" | "month";
}): KindWatchStats {
  const subset = input.plays.filter((play) => play.kind === input.kind);
  const empty = emptyKindWatch(input.kind, input.periodName);
  const barGranularity = input.barGranularity ?? "day";
  if (subset.length === 0) {
    return { ...empty, bars: input.bars, barGranularity };
  }
  const seconds = subset.reduce((sum, play) => sum + play.seconds, 0);
  const unique = new Set(
    subset.map((play) =>
      input.kind === "movie" ? play.title : (play.showTitle ?? play.title),
    ),
  );
  const hours = seconds / 3600;
  const weeks = input.elapsedDays / 7;
  const noun =
    unique.size === 1
      ? input.kind === "movie"
        ? "Movie"
        : "TV Show"
      : input.kind === "movie"
        ? "Movies"
        : "TV Shows";
  return {
    kind: input.kind,
    periodName: input.periodName,
    noun,
    hoursLabel: formatHours(seconds),
    hoursSeconds: seconds,
    plays: subset.length,
    headlineCount: unique.size,
    mostActiveDay: mostActiveDay(subset, input.timeZone),
    peakTime: peakWatchTime(subset, input.timeZone),
    bars: input.bars,
    barGranularity,
    hoursSeries: input.bars.map((bar) => bar.seconds / 3600),
    playsSeries: input.bars.map((bar) => bar.plays),
    hoursPerWeek: perRate(hours, weeks),
    hoursPerDay: perRate(hours, input.elapsedDays),
    playsPerWeek: perRate(subset.length, weeks),
    playsPerDay: perRate(subset.length, input.elapsedDays),
  };
}

function mostActiveDay(
  plays: KindPlay[],
  timeZone: string,
): { label: string; plays: number } | null {
  const days = new Map<string, { plays: number; seconds: number; at: Date }>();
  for (const play of plays) {
    const day = isoDate(play.watchedAt, timeZone);
    const current = days.get(day) ?? {
      plays: 0,
      seconds: 0,
      at: play.watchedAt,
    };
    current.plays += 1;
    current.seconds += play.seconds;
    days.set(day, current);
  }
  let best: { day: string; plays: number; seconds: number; at: Date } | null =
    null;
  for (const [day, row] of days) {
    if (
      !best ||
      row.plays > best.plays ||
      (row.plays === best.plays && row.seconds > best.seconds)
    ) {
      best = { day, ...row };
    }
  }
  if (!best || best.plays === 0) {
    return null;
  }
  return {
    label: new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "short",
      day: "numeric",
    }).format(best.at),
    plays: best.plays,
  };
}

function peakWatchTime(plays: KindPlay[], timeZone: string): string | null {
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
  return formatClockHour(best);
}

export function formatClockHour(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:00 ${period}`;
}

function perRate(value: number, denom: number): string {
  const rounded = Math.round((value / Math.max(1, denom)) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
