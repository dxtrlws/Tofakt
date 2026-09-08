import { describe, expect, it } from "vitest";
import { matchSnapshot } from "./match";

describe("matchSnapshot", () => {
  const windowMinutes = 30;
  const watchedAt = new Date("2026-09-04T02:31:00.000Z");

  it("matches a movie within the reconciliation window", () => {
    const hit = matchSnapshot(
      {
        kind: "movie",
        tmdbId: 27205,
        imdbId: null,
        tvdbId: null,
        showTmdbId: null,
        seasonNumber: null,
        episodeNumber: null,
        watchedAt,
      },
      [
        {
          traktHistoryId: 9,
          kind: "movie",
          tmdbId: 27205,
          imdbId: null,
          tvdbId: null,
          seasonNumber: null,
          episodeNumber: null,
          watchedAt: new Date("2026-09-04T02:40:00.000Z"),
        },
      ],
      windowMinutes,
    );
    expect(hit?.traktHistoryId).toBe(9);
  });

  it("does not match outside the window", () => {
    const hit = matchSnapshot(
      {
        kind: "movie",
        tmdbId: 27205,
        imdbId: null,
        tvdbId: null,
        showTmdbId: null,
        seasonNumber: null,
        episodeNumber: null,
        watchedAt,
      },
      [
        {
          traktHistoryId: 9,
          kind: "movie",
          tmdbId: 27205,
          imdbId: null,
          tvdbId: null,
          seasonNumber: null,
          episodeNumber: null,
          watchedAt: new Date("2026-09-04T04:00:00.000Z"),
        },
      ],
      windowMinutes,
    );
    expect(hit).toBeUndefined();
  });
});
