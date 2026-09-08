import { describe, expect, it } from "vitest";
import { buildHistoryBody, candidateKey } from "./payload";

describe("buildHistoryBody", () => {
  it("sends movies and episode-level ids separately from show wrappers", () => {
    const body = buildHistoryBody([
      {
        eventId: "1",
        kind: "movie",
        tmdbId: 27205,
        imdbId: null,
        tvdbId: null,
        showTmdbId: null,
        seasonNumber: null,
        episodeNumber: null,
        watchedAt: new Date("2026-09-04T02:31:00.000Z"),
      },
      {
        eventId: "2",
        kind: "episode",
        tmdbId: 4170850,
        imdbId: null,
        tvdbId: null,
        showTmdbId: 125988,
        seasonNumber: 3,
        episodeNumber: 10,
        watchedAt: new Date("2026-09-04T03:12:00.000Z"),
      },
      {
        eventId: "3",
        kind: "episode",
        tmdbId: null,
        imdbId: null,
        tvdbId: null,
        showTmdbId: 218589,
        seasonNumber: 1,
        episodeNumber: 1,
        watchedAt: new Date("2026-09-04T04:00:00.000Z"),
      },
    ]);
    expect(body.movies).toHaveLength(1);
    expect(body.episodes).toHaveLength(1);
    expect(body.shows).toHaveLength(1);
  });

  it("uses a stable key so a synced event cannot be posted twice by identity", () => {
    const item = {
      eventId: "1",
      kind: "movie" as const,
      tmdbId: 27205,
      imdbId: null,
      tvdbId: null,
      showTmdbId: null,
      seasonNumber: null,
      episodeNumber: null,
      watchedAt: new Date("2026-09-04T02:31:00.000Z"),
    };
    expect(candidateKey(item)).toBe("movie:27205:2026-09-04T02:31:00.000Z");
  });
});
