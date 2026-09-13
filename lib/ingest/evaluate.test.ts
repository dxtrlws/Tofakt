import { describe, expect, it } from "vitest";
import type { PlaySession } from "../tofa/history";
import { evaluatePlay } from "./evaluate";

const play = (overrides: Partial<PlaySession> = {}): PlaySession => ({
  id: "play-1",
  title: "Inception",
  started_at: "2026-09-05T01:00:00.000Z",
  ended_at: "2026-09-05T02:28:00.000Z",
  progress_percent: 100,
  seconds_watched: 5280,
  ...overrides,
});

const movie = {
  kind: "movie" as const,
  runtimeSeconds: 8880,
  tofaLibraryId: "lib",
};

const thresholds = { movie: 90, episode: 85 };
const sync = {
  mode: "manual" as const,
  cutoffIso: null,
  windowMinutes: 30,
  timestampConvention: "completion" as const,
  excludedLibraryIds: [] as string[],
  reconcileEnabled: false,
  reconcileEveryMinutes: 60,
};

describe("evaluatePlay", () => {
  it("keeps a real movie session complete and pending-eligible", () => {
    const result = evaluatePlay(play(), movie, thresholds, sync);
    expect(result.isPlayback).toBe(true);
    expect(result.isComplete).toBe(true);
    expect(result.convention).toBe("completion");
  });

  it("rejects a tofa mark-watched row even at 100%", () => {
    const result = evaluatePlay(
      play({
        started_at: "2026-09-05T01:24:30.623707Z",
        ended_at: "2026-09-05T01:24:30.667739Z",
        seconds_watched: 0,
        progress_percent: 100,
        position_ms: 3619408,
        duration_ms: 3619408,
      }),
      movie,
      thresholds,
      sync,
    );
    expect(result.isPlayback).toBe(false);
    expect(result.isComplete).toBe(false);
    expect(result.durationWatchedSeconds).toBe(0);
  });

  it("timestamps at start when that convention is selected", () => {
    const result = evaluatePlay(play(), movie, thresholds, {
      ...sync,
      timestampConvention: "start",
    });
    expect(result.convention).toBe("start");
    expect(result.watchedAt.toISOString()).toBe("2026-09-05T01:00:00.000Z");
  });
});
