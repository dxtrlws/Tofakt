export type UpcomingFilter = "all" | "premieres" | "finales";

const PREMIERES = new Set([
  "series_premiere",
  "season_premiere",
  "mid_season_premiere",
]);

const FINALES = new Set([
  "series_finale",
  "season_finale",
  "mid_season_finale",
]);

export function parseUpcomingFilter(
  raw: string | string[] | undefined | null,
): UpcomingFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "premieres" || value === "finales") {
    return value;
  }
  return "all";
}

export function matchesUpcomingFilter(
  episodeType: string | null | undefined,
  filter: UpcomingFilter,
): boolean {
  if (filter === "all") {
    return true;
  }
  const type = episodeType ?? "standard";
  if (filter === "premieres") {
    return PREMIERES.has(type);
  }
  return FINALES.has(type);
}

export function episodeTypeLabel(
  episodeType: string | null | undefined,
): string | null {
  switch (episodeType) {
    case "series_premiere":
      return "Series premiere";
    case "season_premiere":
      return "Season premiere";
    case "mid_season_premiere":
      return "Mid-season premiere";
    case "season_finale":
      return "Finale";
    case "series_finale":
      return "Series finale";
    case "mid_season_finale":
      return "Mid-season finale";
    default:
      return null;
  }
}

export function upcomingFilterLabel(filter: UpcomingFilter): string {
  switch (filter) {
    case "premieres":
      return "Premieres";
    case "finales":
      return "Finales";
    default:
      return "All";
  }
}

export function airsInLabel(aired: Date, now: Date, timeZone: string): string {
  const days = calendarDaysApart(now, aired, timeZone);
  if (days <= 0) {
    return "Today";
  }
  if (days === 1) {
    return "Tomorrow";
  }
  if (days < 7) {
    return `In ${days} days`;
  }
  if (days < 14) {
    return "Next week";
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
  }).format(aired);
}

export function isoDate(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function calendarDaysApart(
  from: Date,
  to: Date,
  timeZone: string,
): number {
  const start = Date.parse(`${isoDate(from, timeZone)}T00:00:00Z`);
  const end = Date.parse(`${isoDate(to, timeZone)}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}
