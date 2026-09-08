import { describe, expect, it } from "vitest";
import { eligibilityForEvent, isComplete } from "./eligibility";

const base = {
  movieThreshold: 90,
  episodeThreshold: 85,
  tmdbId: 125988,
};

describe("eligibilityForEvent", () => {
  it("skips movies below the 90% threshold", () => {
    expect(
      eligibilityForEvent({
        ...base,
        kind: "movie",
        progressPercent: 1,
      }),
    ).toEqual({ status: "skipped", skipReason: "below_threshold" });
  });

  it("accepts episodes at the 85% threshold", () => {
    expect(
      eligibilityForEvent({
        ...base,
        kind: "episode",
        progressPercent: 85,
        tmdbId: 7173966,
        showTmdbId: 125988,
        seasonNumber: 3,
        episodeNumber: 10,
      }),
    ).toEqual({ status: "pending", skipReason: null });
  });

  it("marks unmatched when no external id can be resolved", () => {
    expect(
      eligibilityForEvent({
        kind: "movie",
        progressPercent: 100,
        movieThreshold: 90,
        episodeThreshold: 85,
      }),
    ).toEqual({ status: "unmatched", skipReason: "unmatched" });
  });

  it("treats show TMDB + season/episode as resolvable", () => {
    expect(
      eligibilityForEvent({
        kind: "episode",
        progressPercent: 100,
        movieThreshold: 90,
        episodeThreshold: 85,
        showTmdbId: 125988,
        seasonNumber: 3,
        episodeNumber: 10,
      }).status,
    ).toBe("pending");
  });

  it("keeps ignored plays skipped", () => {
    expect(
      eligibilityForEvent({
        ...base,
        kind: "movie",
        progressPercent: 100,
        ignored: true,
      }),
    ).toEqual({ status: "skipped", skipReason: "user_ignored" });
  });

  it("skips plays before the forward-only cutoff", () => {
    expect(
      eligibilityForEvent({
        ...base,
        kind: "movie",
        progressPercent: 100,
        beforeCutoff: true,
      }),
    ).toEqual({ status: "skipped", skipReason: "before_cutoff" });
  });

  it("skips mark-watched rows that were not actually played", () => {
    expect(
      eligibilityForEvent({
        ...base,
        kind: "episode",
        progressPercent: 100,
        isPlayback: false,
      }),
    ).toEqual({ status: "skipped", skipReason: "marked_watched" });
  });
});

describe("isComplete", () => {
  it("treats a missing percentage as complete", () => {
    expect(
      isComplete({
        kind: "movie",
        movieThreshold: 90,
        episodeThreshold: 85,
      }),
    ).toBe(true);
  });

  it("does not treat a 100% mark-watched row as complete", () => {
    expect(
      isComplete({
        kind: "episode",
        progressPercent: 100,
        movieThreshold: 90,
        episodeThreshold: 85,
        isPlayback: false,
      }),
    ).toBe(false);
  });
});
