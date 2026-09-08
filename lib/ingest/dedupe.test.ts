import { describe, expect, it } from "vitest";
import { dedupeForPlay, fingerprintKey, tofaMediaKey } from "./dedupe";

describe("dedupeForPlay", () => {
  it("uses the tofa history id when present", () => {
    const result = dedupeForPlay({
      id: "9b054280-7068-44f1-81dc-7ced5320d977",
      mediaId: "show-1",
      watchedAt: new Date("2026-09-05T01:24:30.667Z"),
    });
    expect(result).toEqual({
      key: "9b054280-7068-44f1-81dc-7ced5320d977",
      strategy: "tofa_history_id",
    });
  });

  it("falls back to a minute-truncated fingerprint when id is missing", () => {
    const watchedAt = new Date("2026-09-05T01:24:30.667Z");
    const result = dedupeForPlay({
      id: null,
      mediaId: "media-1",
      watchedAt,
    });
    expect(result.strategy).toBe("fingerprint");
    expect(result.key).toBe(fingerprintKey("media-1", watchedAt));
    expect(result.key).toBe(
      fingerprintKey("media-1", new Date("2026-09-05T01:24:11.000Z")),
    );
  });
});

describe("tofaMediaKey", () => {
  it("stores episodes under the episode uuid, not the show uuid", () => {
    expect(
      tofaMediaKey({
        mediaType: "tv",
        mediaId: "show-uuid",
        episodeId: "episode-uuid",
        seasonNumber: 3,
        episodeNumber: 10,
        historyId: "play-1",
      }),
    ).toBe("episode-uuid");
  });

  it("stores movies under the movie uuid", () => {
    expect(
      tofaMediaKey({
        mediaType: "movie",
        mediaId: "movie-uuid",
        episodeId: null,
        historyId: "play-2",
      }),
    ).toBe("movie-uuid");
  });
});
