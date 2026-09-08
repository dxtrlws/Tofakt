import { MIN_PLAYBACK_SESSION_MS } from "./timestamps";

export type DurationInput = {
  secondsWatched?: number | null;
  positionMs?: number | null;
  durationMs?: number | null;
  wallClockMs?: number | null;
};

export function durationWatchedSeconds(input: DurationInput): number | null {
  if (input.secondsWatched && input.secondsWatched > 0) {
    return Math.round(input.secondsWatched);
  }
  if (
    input.wallClockMs != null &&
    Number.isFinite(input.wallClockMs) &&
    input.wallClockMs < MIN_PLAYBACK_SESSION_MS
  ) {
    return 0;
  }
  if (input.wallClockMs && input.wallClockMs >= MIN_PLAYBACK_SESSION_MS) {
    return Math.round(input.wallClockMs / 1000);
  }
  if (input.positionMs && input.positionMs > 0) {
    return Math.round(input.positionMs / 1000);
  }
  return null;
}
