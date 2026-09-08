import { describe, expect, it } from "vitest";
import { isPlaybackSession, watchedAtFromPlay } from "./timestamps";

describe("watchedAtFromPlay", () => {
  it("prefers ended_at when present", () => {
    const result = watchedAtFromPlay({
      startedAt: "2026-09-05T01:24:30.623Z",
      endedAt: "2026-09-05T01:24:30.667Z",
    });
    expect(result.convention).toBe("completion");
    expect(result.watchedAt.toISOString()).toBe("2026-09-05T01:24:30.667Z");
    expect(result.clamped).toBe(false);
  });

  it("uses started_at when ended_at is missing", () => {
    const result = watchedAtFromPlay({
      startedAt: "2026-09-05T01:24:30.623Z",
    });
    expect(result.convention).toBe("start");
    expect(result.watchedAt.toISOString()).toBe("2026-09-05T01:24:30.623Z");
  });

  it("clamps future timestamps to now", () => {
    const now = new Date("2026-09-05T02:00:00.000Z");
    const result = watchedAtFromPlay({
      startedAt: "2026-09-05T01:00:00.000Z",
      endedAt: "2026-09-06T00:00:00.000Z",
      now,
    });
    expect(result.clamped).toBe(true);
    expect(result.watchedAt.toISOString()).toBe(now.toISOString());
  });

  it("honors the start convention even when ended_at is present", () => {
    const result = watchedAtFromPlay({
      startedAt: "2026-09-05T01:00:00.000Z",
      endedAt: "2026-09-05T02:00:00.000Z",
      prefer: "start",
    });
    expect(result.convention).toBe("start");
    expect(result.watchedAt.toISOString()).toBe("2026-09-05T01:00:00.000Z");
  });

  it("estimates completion from start plus duration when ended_at is missing", () => {
    const result = watchedAtFromPlay({
      startedAt: "2026-09-05T01:00:00.000Z",
      prefer: "completion",
      durationWatchedSeconds: 600,
      runtimeSeconds: 3600,
    });
    expect(result.convention).toBe("completion");
    expect(result.watchedAt.toISOString()).toBe("2026-09-05T01:10:00.000Z");
  });
});

describe("isPlaybackSession", () => {
  it("rejects tofa mark-watched rows that finish in tens of milliseconds", () => {
    expect(
      isPlaybackSession({
        startedAt: "2026-09-05T01:24:30.623707Z",
        endedAt: "2026-09-05T01:24:30.667739Z",
      }),
    ).toBe(false);
  });

  it("accepts a real session that lasted minutes", () => {
    expect(
      isPlaybackSession({
        startedAt: "2026-09-03T23:00:00.000Z",
        endedAt: "2026-09-03T23:52:20.000Z",
      }),
    ).toBe(true);
  });

  it("treats a missing ended_at as a real session", () => {
    expect(
      isPlaybackSession({
        startedAt: "2026-09-05T01:24:30.623Z",
      }),
    ).toBe(true);
  });
});
