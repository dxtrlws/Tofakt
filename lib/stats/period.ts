export type MonthId = { year: number; month: number };

export function parseMonthParam(
  raw: string | string[] | undefined | null,
  now: Date,
  timeZone: string,
): MonthId {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (year >= 1970 && month >= 1 && month <= 12) {
      return { year, month };
    }
  }
  return monthIdAt(now, timeZone);
}

export function monthIdAt(now: Date, timeZone: string): MonthId {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
  };
}

export function monthKey(id: MonthId): string {
  return `${id.year}-${String(id.month).padStart(2, "0")}`;
}

export function shiftMonth(id: MonthId, delta: number): MonthId {
  const date = new Date(Date.UTC(id.year, id.month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export function monthName(id: MonthId, timeZone = "UTC"): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "long",
  }).format(new Date(Date.UTC(id.year, id.month - 1, 15)));
}

export function monthBounds(
  id: MonthId,
  timeZone: string,
): { start: Date; end: Date } {
  const start = zonedLocalTime(id.year, id.month, 1, timeZone);
  const next = shiftMonth(id, 1);
  const end = zonedLocalTime(next.year, next.month, 1, timeZone);
  return { start, end };
}

export function parseYearParam(
  raw: string | string[] | undefined | null,
  now: Date,
  timeZone: string,
): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const year = Number(value);
  if (Number.isInteger(year) && year >= 1970 && year <= 2100) {
    return year;
  }
  return monthIdAt(now, timeZone).year;
}

export function yearBounds(
  year: number,
  timeZone: string,
): { start: Date; end: Date } {
  return {
    start: monthBounds({ year, month: 1 }, timeZone).start,
    end: monthBounds({ year: year + 1, month: 1 }, timeZone).start,
  };
}

export function listRecentYears(
  now: Date,
  timeZone: string,
  viewedYear: number,
): number[] {
  const current = monthIdAt(now, timeZone).year;
  const years = new Set<number>([current, viewedYear]);
  for (let year = current - 7; year <= current; year += 1) {
    if (year >= 1970) {
      years.add(year);
    }
  }
  return [...years].sort((a, b) => a - b);
}

export function isoDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function hourInZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  return Number(parts.find((part) => part.type === "hour")?.value);
}

export function weekdayInZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).formatToParts(date);
  const name = parts.find((part) => part.type === "weekday")?.value;
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[name ?? "Sun"] ?? 0;
}

export function formatHours(seconds: number): string {
  const hours = seconds / 3600;
  const rounded = Math.round(hours * 10) / 10;
  if (Number.isInteger(rounded)) {
    return String(rounded);
  }
  return rounded.toFixed(1);
}

export function formatDelta(current: number, previous: number): string | null {
  const delta = current - previous;
  if (delta === 0) {
    return "Same as last month";
  }
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta} vs last month`;
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
