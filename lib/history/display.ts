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

export type DayGroup = {
  key: string;
  label: string;
  rows: HistoryRow[];
};

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
