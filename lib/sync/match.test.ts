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

  it("matches an episode by show TMDB plus season and episode", () => {
    const hit = matchSnapshot(
      {
        kind: "episode",
        tmdbId: 4170850,
        imdbId: null,
        tvdbId: null,
        showTmdbId: 125988,
        seasonNumber: 1,
        episodeNumber: 3,
        watchedAt,
      },
      [
        {
          traktHistoryId: 11,
          kind: "episode",
          tmdbId: 4170850,
          imdbId: null,
          tvdbId: null,
          showTmdbId: 125988,
          seasonNumber: 1,
          episodeNumber: 3,
          watchedAt: new Date("2026-09-04T02:50:00.000Z"),
        },
      ],
      windowMinutes,
    );
    expect(hit?.traktHistoryId).toBe(11);
  });

  it("matches an episode when Trakt has episode TMDB and local only has show TMDB", () => {
    const hit = matchSnapshot(
      {
        kind: "episode",
        tmdbId: null,
        imdbId: null,
        tvdbId: null,
        showTmdbId: 125988,
        seasonNumber: 1,
        episodeNumber: 3,
        watchedAt,
      },
      [
        {
          traktHistoryId: 12,
          kind: "episode",
          tmdbId: 4170850,
          imdbId: null,
          tvdbId: null,
          showTmdbId: 125988,
          seasonNumber: 1,
          episodeNumber: 3,
          watchedAt,
        },
      ],
      windowMinutes,
    );
    expect(hit?.traktHistoryId).toBe(12);
  });

  it("does not match a different episode of the same show", () => {
    const hit = matchSnapshot(
      {
        kind: "episode",
        tmdbId: null,
        imdbId: null,
        tvdbId: null,
        showTmdbId: 125988,
        seasonNumber: 1,
        episodeNumber: 3,
        watchedAt,
      },
      [
        {
          traktHistoryId: 13,
          kind: "episode",
          tmdbId: 4170851,
          imdbId: null,
          tvdbId: null,
          showTmdbId: 125988,
          seasonNumber: 1,
          episodeNumber: 4,
          watchedAt,
        },
      ],
      windowMinutes,
    );
    expect(hit).toBeUndefined();
  });
});
