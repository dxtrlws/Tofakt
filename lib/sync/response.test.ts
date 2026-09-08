import { describe, expect, it } from "vitest";
import type { SyncCandidate } from "./payload";
import { applyPostResponse } from "./response";

const movie = (id: string, tmdb: number, at: string): SyncCandidate => ({
  eventId: id,
  kind: "movie",
  tmdbId: tmdb,
  imdbId: null,
  tvdbId: null,
  showTmdbId: null,
  seasonNumber: null,
  episodeNumber: null,
  watchedAt: new Date(at),
});

describe("applyPostResponse", () => {
  const items = [
    movie("a", 1, "2026-09-04T02:31:00.000Z"),
    movie("b", 2, "2026-09-04T03:31:00.000Z"),
  ];

  it("marks not_found items unmatched and the rest synced when counts match", () => {
    const outcome = applyPostResponse(items, {
      added: { movies: 1, episodes: 0 },
      not_found: {
        movies: [{ ids: { tmdb: 2 }, watched_at: "2026-09-04T03:31:00.000Z" }],
      },
    });
    expect(outcome.synced).toEqual(["a"]);
    expect(outcome.unmatched).toEqual(["b"]);
    expect(outcome.pending).toEqual([]);
  });

  it("leaves unaccounted items pending", () => {
    const outcome = applyPostResponse(items, {
      added: { movies: 0, episodes: 0 },
      not_found: {},
    });
    expect(outcome.synced).toEqual([]);
    expect(outcome.pending).toEqual(["a", "b"]);
  });
});
