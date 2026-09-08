export type EligibilityKind = "movie" | "episode";

export type EligibilityInput = {
  kind: EligibilityKind;
  progressPercent?: number | null;
  durationWatchedSeconds?: number | null;
  runtimeSeconds?: number | null;
  movieThreshold: number;
  episodeThreshold: number;
  tmdbId?: number | null;
  imdbId?: string | null;
  tvdbId?: number | null;
  showTmdbId?: number | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  ignored?: boolean;
  libraryExcluded?: boolean;
  /** False for tofa mark-watched / import rows with no real playback session. */
  isPlayback?: boolean;
  beforeCutoff?: boolean;
};

export type EligibilityResult =
  | { status: "pending"; skipReason: null }
  | {
      status: "skipped" | "unmatched";
      skipReason:
        | "below_threshold"
        | "marked_watched"
        | "unmatched"
        | "user_ignored"
        | "library_excluded"
        | "before_cutoff";
    };

export function completionPercent(input: EligibilityInput): number | null {
  if (
    typeof input.progressPercent === "number" &&
    Number.isFinite(input.progressPercent)
  ) {
    return Math.max(0, Math.min(100, Math.round(input.progressPercent)));
  }
  if (
    input.durationWatchedSeconds &&
    input.runtimeSeconds &&
    input.runtimeSeconds > 0
  ) {
    return Math.max(
      0,
      Math.min(
        100,
        Math.round((input.durationWatchedSeconds / input.runtimeSeconds) * 100),
      ),
    );
  }
  return null;
}

export function metCompletionThreshold(input: EligibilityInput): boolean {
  const percent = completionPercent(input);
  if (percent == null) {
    return true;
  }
  const threshold =
    input.kind === "episode" ? input.episodeThreshold : input.movieThreshold;
  return percent >= threshold;
}

export function isPlayback(input: EligibilityInput): boolean {
  return input.isPlayback !== false;
}

export function isComplete(input: EligibilityInput): boolean {
  return isPlayback(input) && metCompletionThreshold(input);
}

export function hasResolvableExternalId(input: EligibilityInput): boolean {
  if (input.tmdbId || input.imdbId || input.tvdbId) {
    return true;
  }
  return Boolean(
    input.showTmdbId &&
      input.seasonNumber != null &&
      input.episodeNumber != null,
  );
}

export function eligibilityForEvent(
  input: EligibilityInput,
): EligibilityResult {
  if (input.ignored) {
    return { status: "skipped", skipReason: "user_ignored" };
  }
  if (!isPlayback(input)) {
    return { status: "skipped", skipReason: "marked_watched" };
  }
  if (!metCompletionThreshold(input)) {
    return { status: "skipped", skipReason: "below_threshold" };
  }
  if (input.libraryExcluded) {
    return { status: "skipped", skipReason: "library_excluded" };
  }
  if (input.beforeCutoff) {
    return { status: "skipped", skipReason: "before_cutoff" };
  }
  if (!hasResolvableExternalId(input)) {
    return { status: "unmatched", skipReason: "unmatched" };
  }
  return { status: "pending", skipReason: null };
}
