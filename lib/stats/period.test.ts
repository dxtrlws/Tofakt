import { describe, expect, it } from "vitest";
import {
  formatDelta,
  monthBounds,
  monthKey,
  parseMonthParam,
  parseYearParam,
  shiftMonth,
  yearBounds,
} from "./period";

describe("parseMonthParam", () => {
  const now = new Date("2026-09-07T20:00:00.000Z");

  it("reads YYYY-MM", () => {
    expect(parseMonthParam("2026-08", now, "America/New_York")).toEqual({
      year: 2026,
      month: 8,
    });
  });

  it("falls back to the current month in zone", () => {
    expect(parseMonthParam("nope", now, "America/New_York")).toEqual({
      year: 2026,
      month: 9,
    });
  });
});

describe("monthBounds", () => {
  it("bounds September in America/New_York", () => {
    const range = monthBounds({ year: 2026, month: 9 }, "America/New_York");
    expect(range.start.toISOString()).toBe("2026-09-01T04:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-10-01T04:00:00.000Z");
  });
});

describe("shiftMonth", () => {
  it("wraps the year", () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({
      year: 2027,
      month: 1,
    });
    expect(monthKey(shiftMonth({ year: 2026, month: 1 }, -1))).toBe("2025-12");
  });
});

describe("formatDelta", () => {
  it("shows signed change", () => {
    expect(formatDelta(91, 79)).toBe("+12 vs last month");
    expect(formatDelta(10, 12)).toBe("-2 vs last month");
  });
});

describe("parseYearParam", () => {
  const now = new Date("2026-09-07T20:00:00.000Z");

  it("reads a year", () => {
    expect(parseYearParam("2025", now, "America/New_York")).toBe(2025);
  });

  it("falls back to the current year in zone", () => {
    expect(parseYearParam("nope", now, "America/New_York")).toBe(2026);
  });
});

describe("yearBounds", () => {
  it("bounds 2026 in America/New_York", () => {
    const range = yearBounds(2026, "America/New_York");
    expect(range.start.toISOString()).toBe("2026-01-01T05:00:00.000Z");
    expect(range.end.toISOString()).toBe("2027-01-01T05:00:00.000Z");
  });
});

describe("timezone matrix", () => {
  const zones = {
    UTC: {
      jan: ["2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z"],
      sep: ["2026-09-01T00:00:00.000Z", "2026-10-01T00:00:00.000Z"],
      year: ["2026-01-01T00:00:00.000Z", "2027-01-01T00:00:00.000Z"],
    },
    "America/New_York": {
      jan: ["2026-01-01T05:00:00.000Z", "2026-02-01T05:00:00.000Z"],
      sep: ["2026-09-01T04:00:00.000Z", "2026-10-01T04:00:00.000Z"],
      year: ["2026-01-01T05:00:00.000Z", "2027-01-01T05:00:00.000Z"],
    },
    "Asia/Kolkata": {
      jan: ["2025-12-31T18:30:00.000Z", "2026-01-31T18:30:00.000Z"],
      sep: ["2026-08-31T18:30:00.000Z", "2026-09-30T18:30:00.000Z"],
      year: ["2025-12-31T18:30:00.000Z", "2026-12-31T18:30:00.000Z"],
    },
    "Pacific/Auckland": {
      jan: ["2025-12-31T11:00:00.000Z", "2026-01-31T11:00:00.000Z"],
      sep: ["2026-08-31T12:00:00.000Z", "2026-09-30T11:00:00.000Z"],
      year: ["2025-12-31T11:00:00.000Z", "2026-12-31T11:00:00.000Z"],
    },
  } as const;

  for (const [zone, expected] of Object.entries(zones)) {
    it(`bounds January, September, and 2026 in ${zone}`, () => {
      const jan = monthBounds({ year: 2026, month: 1 }, zone);
      const sep = monthBounds({ year: 2026, month: 9 }, zone);
      const year = yearBounds(2026, zone);
      expect(jan.start.toISOString()).toBe(expected.jan[0]);
      expect(jan.end.toISOString()).toBe(expected.jan[1]);
      expect(sep.start.toISOString()).toBe(expected.sep[0]);
      expect(sep.end.toISOString()).toBe(expected.sep[1]);
      expect(year.start.toISOString()).toBe(expected.year[0]);
      expect(year.end.toISOString()).toBe(expected.year[1]);
    });
  }

  it("keeps 11pm on January 31 in America/New_York inside January", () => {
    const watchedAt = new Date("2026-02-01T04:00:00.000Z");
    const jan = monthBounds({ year: 2026, month: 1 }, "America/New_York");
    const feb = monthBounds({ year: 2026, month: 2 }, "America/New_York");
    expect(watchedAt >= jan.start && watchedAt < jan.end).toBe(true);
    expect(watchedAt < feb.start).toBe(true);
  });
});
