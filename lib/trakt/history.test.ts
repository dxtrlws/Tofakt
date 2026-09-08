import { describe, expect, it } from "vitest";
import { parseTraktHistoryItems, retryAfterMs } from "./history";

describe("parseTraktHistoryItems", () => {
  it("accepts movies whose IMDb id is null", () => {
    const items = parseTraktHistoryItems([
      {
        id: 1,
        watched_at: "2026-09-04T02:31:00.000Z",
        action: "watch",
        type: "movie",
        movie: {
          title: "Inception",
          runtime: 148,
          genres: ["science-fiction", "action"],
          ids: {
            trakt: 16662,
            tmdb: 27205,
            imdb: null,
            tvdb: null,
            slug: "inception-2010",
          },
        },
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]?.movie?.ids.imdb).toBeNull();
    expect(items[0]?.movie?.ids.tmdb).toBe(27205);
    expect(items[0]?.movie?.runtime).toBe(148);
    expect(items[0]?.movie?.title).toBe("Inception");
    expect(items[0]?.movie?.genres).toEqual(["science-fiction", "action"]);
  });
});

describe("retryAfterMs", () => {
  it("reads seconds and ignores a missing header", () => {
    expect(retryAfterMs({ "retry-after": "12" })).toBe(12_000);
    expect(retryAfterMs({})).toBeNull();
  });
});
