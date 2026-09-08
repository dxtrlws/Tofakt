import { describe, expect, it } from "vitest";
import {
  formatHours,
  historyHref,
  monthRange,
  relativeTime,
  summarize,
} from "./query";

describe("relativeTime", () => {
  const now = new Date("2026-09-07T20:00:00.000Z");

  it("uses minutes, days, and weeks", () => {
    expect(relativeTime(new Date("2026-09-07T19:56:00.000Z"), now)).toBe(
      "4 minutes ago",
    );
    expect(relativeTime(new Date("2026-09-05T20:00:00.000Z"), now)).toBe(
      "2 days ago",
    );
    expect(relativeTime(new Date("2026-08-31T20:00:00.000Z"), now)).toBe(
      "1 week ago",
    );
  });
});

describe("formatHours", () => {
  it("keeps one decimal under 10 hours", () => {
    expect(formatHours(11.2 * 3600)).toBe("11.2");
    expect(formatHours(1.2 * 3600)).toBe("1.2");
    expect(formatHours(6 * 3600)).toBe("6");
  });
});

describe("monthRange", () => {
  it("bounds September in America/New_York", () => {
    const range = monthRange(
      new Date("2026-09-07T20:00:00.000Z"),
      "America/New_York",
    );
    expect(range.name).toBe("September");
    expect(range.start.toISOString()).toBe("2026-09-01T04:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-10-01T04:00:00.000Z");
  });
});

describe("historyHref", () => {
  it("sends pending to the default History view", () => {
    expect(historyHref("pending")).toBe("/history");
    expect(historyHref("failed")).toBe("/history?state=failed");
  });
});

describe("summarize", () => {
  it("shows the Trakt username when connected", () => {
    expect(
      summarize("trakt", {
        provider: "trakt",
        status: "ok",
        baseUrl: null,
        serverId: null,
        authMethod: null,
        accountLabel: "dxtrlws",
        hasSecret: true,
        hasRefresh: true,
        hasClientCredentials: true,
        expiresAt: null,
        lastVerifiedAt: null,
        lastError: null,
        capabilities: [],
        region: null,
        versionLabel: null,
      }).detail,
    ).toBe("dxtrlws");
  });

  it("flags a missing TMDB key", () => {
    expect(
      summarize("tmdb", {
        provider: "tmdb",
        status: "unknown",
        baseUrl: null,
        serverId: null,
        authMethod: null,
        accountLabel: null,
        hasSecret: false,
        hasRefresh: false,
        hasClientCredentials: false,
        expiresAt: null,
        lastVerifiedAt: null,
        lastError: null,
        capabilities: [],
        region: null,
        versionLabel: null,
      }).detail,
    ).toBe("Key missing");
  });
});
