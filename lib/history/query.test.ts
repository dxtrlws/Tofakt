import { describe, expect, it } from "vitest";
import {
  dayLabel,
  formatDuration,
  formatSeasonEpisode,
  parseHistoryQuery,
  rowSubtitle,
} from "./query";

describe("parseHistoryQuery", () => {
  it("defaults the status filter to pending", () => {
    expect(parseHistoryQuery({ get: () => null })).toEqual({
      kind: "all",
      state: "pending",
      q: "",
    });
  });

  it("keeps an explicit status filter", () => {
    expect(
      parseHistoryQuery({
        get: (name) => (name === "state" ? "synced" : null),
      }).state,
    ).toBe("synced");
  });
});

describe("history formatting", () => {
  it("formats day headers like the Paper ledger", () => {
    expect(dayLabel(new Date("2026-09-05T01:24:30.000Z"), "UTC")).toBe(
      "Saturday, September 5",
    );
  });

  it("formats durations as minutes or hours", () => {
    expect(formatDuration(120)).toBe("2m");
    expect(formatDuration(5760)).toBe("1h 36m");
  });

  it("pads season and episode numbers", () => {
    expect(formatSeasonEpisode(3, 10)).toBe("S03E10");
  });

  it("labels an ignored movie in the subtitle", () => {
    expect(
      rowSubtitle({
        eventId: "1",
        title: "Suzume",
        showTitle: null,
        kind: "movie",
        seasonNumber: null,
        episodeNumber: null,
        artworkUrl: null,
        watchedAt: new Date(),
        durationWatchedSeconds: 7320,
        completionPercent: 100,
        syncStatus: "skipped",
        skipReason: "user_ignored",
        lastErrorMessage: null,
      }).text,
    ).toBe("Movie · ignored");
  });

  it("explains a hold-back on an episode", () => {
    expect(
      rowSubtitle({
        eventId: "2",
        title: "OutKast",
        showTitle: "Lanterns",
        kind: "episode",
        seasonNumber: 1,
        episodeNumber: 3,
        artworkUrl: null,
        watchedAt: new Date(),
        durationWatchedSeconds: 3120,
        completionPercent: 100,
        syncStatus: "skipped",
        skipReason: "before_cutoff",
        lastErrorMessage: null,
      }).text,
    ).toBe("S01E03 · OutKast · older than Newly watched only");
  });
});
