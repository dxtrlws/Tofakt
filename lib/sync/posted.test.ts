import { describe, expect, it } from "vitest";
import { assignRemoteIds, isWatchlogPosted, WATCHLOG_POSTED } from "./posted";

describe("isWatchlogPosted", () => {
  it("is only plays Watchlog itself sent", () => {
    expect(
      isWatchlogPosted({ status: "synced", skipReason: WATCHLOG_POSTED }),
    ).toBe(true);
    expect(
      isWatchlogPosted({ status: "synced", skipReason: "already_on_trakt" }),
    ).toBe(false);
    expect(isWatchlogPosted({ status: "pending", skipReason: null })).toBe(
      false,
    );
  });
});

describe("assignRemoteIds", () => {
  const watchedAt = new Date("2026-09-04T02:31:00.000Z");
  const play = {
    eventId: "evt-1",
    kind: "movie" as const,
    tmdbId: 27205,
    imdbId: null,
    tvdbId: null,
    showTmdbId: null,
    seasonNumber: null,
    episodeNumber: null,
    watchedAt,
  };

  it("stores the matching Trakt history id after a post", () => {
    expect(
      assignRemoteIds(
        [play],
        [
          {
            traktHistoryId: 441,
            kind: "movie",
            tmdbId: 27205,
            imdbId: null,
            tvdbId: null,
            seasonNumber: null,
            episodeNumber: null,
            watchedAt,
          },
        ],
        30,
      ),
    ).toEqual([{ eventId: "evt-1", remoteId: 441 }]);
  });

  it("does not assign the same Trakt history id to two local plays", () => {
    const second = { ...play, eventId: "evt-2" };
    const hits = assignRemoteIds(
      [play, second],
      [
        {
          traktHistoryId: 441,
          kind: "movie",
          tmdbId: 27205,
          imdbId: null,
          tvdbId: null,
          seasonNumber: null,
          episodeNumber: null,
          watchedAt,
        },
      ],
      30,
    );
    expect(hits).toEqual([{ eventId: "evt-1", remoteId: 441 }]);
  });
});
