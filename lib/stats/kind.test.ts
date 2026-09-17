import { describe, expect, it } from "vitest";
import {
  buildKindWatchStats,
  emptyKindWatch,
  monthElapsedDays,
  monthKindBars,
  yearKindBars,
} from "./kind";

describe("buildKindWatchStats", () => {
  it("returns empty stats when a kind has no plays", () => {
    const stats = buildKindWatchStats({
      plays: [],
      kind: "movie",
      timeZone: "America/New_York",
      periodName: "August",
      elapsedDays: 31,
      bars: monthKindBars([], "America/New_York", 31),
    });
    expect(stats).toMatchObject({
      ...emptyKindWatch("movie", "August"),
      bars: expect.any(Array),
    });
    expect(stats.plays).toBe(0);
    expect(stats.bars).toHaveLength(31);
  });

  it("counts unique movies, daily bars, peak day, and calendar rates", () => {
    const plays = [
      movie("2026-08-02T02:00:00.000Z", "Dune"),
      movie("2026-08-02T03:00:00.000Z", "Heat"),
      movie("2026-08-10T02:00:00.000Z", "Dune"),
    ];
    const stats = buildKindWatchStats({
      plays,
      kind: "movie",
      timeZone: "America/New_York",
      periodName: "August",
      elapsedDays: 31,
      bars: monthKindBars(plays, "America/New_York", 31),
    });
    expect(stats.plays).toBe(3);
    expect(stats.headlineCount).toBe(2);
    expect(stats.noun).toBe("Movies");
    expect(stats.hoursLabel).toBe("6");
    expect(stats.mostActiveDay).toEqual({ label: "Aug 1", plays: 2 });
    expect(stats.peakTime).toBe("10:00 PM");
    expect(stats.bars[0]?.plays).toBe(2);
    expect(stats.bars[8]?.plays).toBe(1);
    expect(stats.hoursPerDay).toBe("0.2");
    expect(stats.hoursPerWeek).toBe("1.4");
    expect(stats.playsPerDay).toBe("0.1");
    expect(stats.playsPerWeek).toBe("0.7");
  });

  it("names a single TV show and buckets year bars by month", () => {
    const plays = [
      episode("2026-01-15T17:00:00.000Z", "Silo"),
      episode("2026-08-16T16:00:00.000Z", "Silo"),
    ];
    const stats = buildKindWatchStats({
      plays,
      kind: "episode",
      timeZone: "America/New_York",
      periodName: "2026",
      elapsedDays: 365,
      bars: yearKindBars(plays, 2026, "America/New_York"),
      barGranularity: "month",
    });
    expect(stats.noun).toBe("TV Show");
    expect(stats.barGranularity).toBe("month");
    expect(stats.headlineCount).toBe(1);
    expect(stats.plays).toBe(2);
    expect(stats.bars).toHaveLength(12);
    expect(stats.bars[0]?.label).toBe("Jan");
    expect(stats.bars[0]?.plays).toBe(1);
    expect(stats.bars[7]?.plays).toBe(1);
  });
});

describe("monthElapsedDays", () => {
  it("uses elapsed time in a live month, not the full calendar month", () => {
    const days = monthElapsedDays(
      { year: 2026, month: 9 },
      new Date("2026-09-07T16:00:00.000Z"),
      "America/New_York",
    );
    expect(days).toBeGreaterThan(6);
    expect(days).toBeLessThan(8);
  });
});

function movie(watchedAt: string, title: string) {
  return {
    kind: "movie" as const,
    title,
    showTitle: null,
    watchedAt: new Date(watchedAt),
    seconds: 7200,
  };
}

function episode(watchedAt: string, show: string) {
  return {
    kind: "episode" as const,
    title: "E1",
    showTitle: show,
    watchedAt: new Date(watchedAt),
    seconds: 3600,
  };
}
