import { describe, expect, it } from "vitest";
import { playsFromTraktItems } from "./month";
import { uniqueOrgBars, yearReviewFromPlays } from "./year";

function episode(
  id: number,
  watchedAt: string,
  show: string,
  season: number,
  number: number,
  runtime = 48,
  tmdbId = 1,
) {
  return {
    id,
    watched_at: watchedAt,
    type: "episode" as const,
    episode: { title: `E${number}`, season, number, runtime },
    show: { title: show, genres: ["drama"], ids: { tmdb: tmdbId } },
  };
}

describe("yearReviewFromPlays", () => {
  it("is empty when the year has no Trakt plays", () => {
    const review = yearReviewFromPlays({
      year: 2026,
      now: new Date("2026-09-07T12:00:00.000Z"),
      timeZone: "America/New_York",
      live: true,
      plays: [],
      prevPlays: 0,
      years: [2026],
      traktConnected: true,
    });
    expect(review.empty).toBe(true);
    expect(review.summary).toBe("No Trakt plays in this year");
    expect(review.busiestMonth).toBeNull();
  });

  it("aggregates Trakt plays into year stats without using tofa", () => {
    const plays = playsFromTraktItems([
      episode(1, "2026-01-02T17:00:00.000Z", "Reacher", 4, 1, 50, 123),
      ...Array.from({ length: 8 }, (_, index) =>
        episode(
          10 + index,
          `2026-08-16T${String(16 + index).padStart(2, "0")}:00:00.000Z`,
          "FROM",
          1,
          index + 1,
          48,
          456,
        ),
      ),
      episode(20, "2026-08-17T16:00:00.000Z", "FROM", 1, 1, 48, 456),
      {
        id: 30,
        watched_at: "2026-08-20T20:00:00.000Z",
        type: "movie" as const,
        movie: {
          title: "Weapons",
          runtime: 128,
          genres: ["horror"],
          ids: { tmdb: 1078605 },
        },
      },
      episode(40, "2026-09-02T16:00:00.000Z", "Lanterns", 1, 4, 55, 789),
    ]);
    const review = yearReviewFromPlays({
      year: 2026,
      now: new Date("2026-09-07T16:00:00.000Z"),
      timeZone: "America/New_York",
      live: true,
      plays,
      prevPlays: 4,
      years: [2026],
      traktConnected: true,
    });
    expect(review.empty).toBe(false);
    expect(review.plays).toBe(12);
    expect(review.moviePlays).toBe(1);
    expect(review.tvPlays).toBe(11);
    expect(review.vsLastYear).toBe("+8 vs 2025");
    expect(review.summary).toContain("live year so far");
    expect(review.busiestMonth?.name).toBe("Aug");
    expect(review.busiestMonth?.line).toContain("10 plays");
    expect(review.months[7]?.tone).toBe("peak");
    expect(review.months[8]?.tone).toBe("current");
    expect(review.months[9]?.tone).toBe("empty");
    expect(review.first?.title).toBe("Reacher");
    expect(review.last?.title).toBe("Lanterns");
    expect(review.binge?.title).toBe("FROM");
    expect(review.binge?.line).toContain("8 episodes");
    expect(review.busiestDay?.dayLabel).toBe("Aug 16");
    expect(review.busiestDay?.posters).toEqual([
      {
        id: expect.any(String),
        title: "FROM",
        overlay: "8 episodes",
        artworkUrl: null,
      },
    ]);
    expect(review.movies.plays).toBe(1);
    expect(review.tv.plays).toBe(11);
    expect(review.movieGenres[0]?.name).toBe("Horror");
    expect(review.tvGenreWatch.most).toEqual({ name: "Drama", count: 3 });
    expect(review.tvGenreWatch.least).toBeNull();
    expect(review.tvGenreWatch.count).toBe(1);
    expect(review.movieGenreWatch.most).toEqual({ name: "Horror", count: 1 });
    expect(review.movieGenreWatch.count).toBe(1);
    expect(review.newShare).toBe("92%");
    expect(review.rewatchShare).toBe("8% rewatch");
    expect(review.topShows[0]?.title).toBe("FROM");
    expect(review.topShows[0]?.note).toBe("Longest binge · 8 episodes");
    expect(review.topMovies[0]?.title).toBe("Weapons");
    expect(review.topMovies[0]?.note).toBe("First play this year");
    expect(review.tvServices[0]?.name).toBe("Not currently streaming");
    expect(review.tvNetworks).toEqual([]);
    expect(review.movieStudios).toEqual([]);
  });

  it("lists unique shows and movies on the busiest day, not episodes", () => {
    const review = yearReviewFromPlays({
      year: 2026,
      now: new Date("2026-09-07T16:00:00.000Z"),
      timeZone: "America/New_York",
      live: true,
      plays: playsFromTraktItems([
        episode(1, "2026-08-16T16:00:00.000Z", "FROM", 1, 1, 48, 456),
        episode(2, "2026-08-16T17:00:00.000Z", "FROM", 1, 2, 48, 456),
        episode(3, "2026-08-16T18:00:00.000Z", "Reacher", 4, 1, 50, 123),
        {
          id: 4,
          watched_at: "2026-08-16T20:00:00.000Z",
          type: "movie" as const,
          movie: {
            title: "Weapons",
            runtime: 128,
            genres: ["horror"],
            ids: { tmdb: 1078605 },
          },
        },
      ]),
      prevPlays: 0,
      years: [2026],
      traktConnected: true,
    });
    expect(review.busiestDay?.posters.map((poster) => poster.title)).toEqual([
      "Weapons",
      "FROM",
      "Reacher",
    ]);
    expect(review.busiestDay?.posters.map((poster) => poster.overlay)).toEqual([
      "Movie",
      "2 episodes",
      "1 episode",
    ]);
  });

  it("ranks the top 10 titles and buckets leftover genres as Other", () => {
    const extraShows = Array.from({ length: 12 }, (_, index) =>
      episode(
        100 + index,
        `2026-03-0${(index % 8) + 1}T16:00:00.000Z`,
        `Show ${index + 1}`,
        1,
        1,
        40,
        1000 + index,
      ),
    );
    const genreMovies = [
      "action",
      "comedy",
      "drama",
      "horror",
      "thriller",
      "crime",
      "mystery",
      "romance",
      "science fiction",
      "western",
    ].map((genre, index) => ({
      id: 200 + index,
      watched_at: `2026-04-${String(index + 1).padStart(2, "0")}T20:00:00.000Z`,
      type: "movie" as const,
      movie: {
        title: `Film ${index + 1}`,
        runtime: 100,
        genres: [genre],
        ids: { tmdb: 2000 + index },
      },
    }));
    const review = yearReviewFromPlays({
      year: 2026,
      now: new Date("2026-09-07T16:00:00.000Z"),
      timeZone: "America/New_York",
      live: true,
      plays: playsFromTraktItems([...extraShows, ...genreMovies]),
      prevPlays: 0,
      years: [2026],
      traktConnected: true,
    });
    expect(review.topShows).toHaveLength(10);
    expect(review.topMovies).toHaveLength(10);
    expect(review.movieGenres.map((bar) => bar.name)).toEqual([
      "Action",
      "Comedy",
      "Crime",
      "Drama",
      "Horror",
      "Mystery",
      "Romance",
      "Other",
    ]);
    expect(review.movieGenres.at(-1)?.caption).toBe("3 categories");
    expect(review.movieGenreWatch.most).toEqual({ name: "Action", count: 1 });
    expect(review.movieGenreWatch.least).toEqual({ name: "Western", count: 1 });
    expect(review.movieGenreWatch.count).toBe(10);
    expect(
      review.movieGenres.find((bar) => bar.name === "Sci-Fi"),
    ).toBeUndefined();
  });

  it("counts a show once on its first network and a film under every studio", () => {
    const plays = playsFromTraktItems([
      episode(1, "2026-01-02T17:00:00.000Z", "Reacher", 4, 1, 50, 11),
      episode(2, "2026-01-03T17:00:00.000Z", "Reacher", 4, 2, 50, 11),
      episode(3, "2026-02-02T17:00:00.000Z", "FROM", 1, 1, 48, 22),
      {
        id: 4,
        watched_at: "2026-03-02T20:00:00.000Z",
        type: "movie" as const,
        movie: {
          title: "Dune",
          runtime: 155,
          genres: ["science fiction"],
          ids: { tmdb: 33 },
        },
      },
      {
        id: 5,
        watched_at: "2026-03-03T20:00:00.000Z",
        type: "movie" as const,
        movie: {
          title: "Arrival",
          runtime: 116,
          genres: ["science fiction"],
          ids: { tmdb: 44 },
        },
      },
    ]);
    const networksByTmdb = new Map<number, string[]>([
      [11, ["Amazon", "Prime Video"]],
      [22, ["MGM+"]],
    ]);
    const companiesByTmdb = new Map<number, string[]>([
      [33, ["Legendary", "Warner Bros."]],
      [44, ["Paramount"]],
    ]);
    expect(
      uniqueOrgBars(
        plays,
        "episode",
        (id) => networksByTmdb.get(id) ?? [],
        "primary",
      ),
    ).toEqual([
      {
        name: "Amazon",
        plays: 1,
        seconds: 100 * 60,
        shows: 1,
        movies: 0,
        logoUrl: null,
      },
      {
        name: "MGM+",
        plays: 1,
        seconds: 48 * 60,
        shows: 1,
        movies: 0,
        logoUrl: null,
      },
    ]);
    expect(
      uniqueOrgBars(
        plays,
        "movie",
        (id) => companiesByTmdb.get(id) ?? [],
        "all",
      ),
    ).toEqual([
      {
        name: "Legendary",
        plays: 1,
        seconds: 155 * 60,
        shows: 0,
        movies: 1,
        logoUrl: null,
      },
      {
        name: "Warner Bros.",
        plays: 1,
        seconds: 155 * 60,
        shows: 0,
        movies: 1,
        logoUrl: null,
      },
      {
        name: "Paramount",
        plays: 1,
        seconds: 116 * 60,
        shows: 0,
        movies: 1,
        logoUrl: null,
      },
    ]);
    const review = yearReviewFromPlays({
      year: 2026,
      now: new Date("2026-09-07T16:00:00.000Z"),
      timeZone: "America/New_York",
      live: true,
      plays,
      prevPlays: 0,
      years: [2026],
      traktConnected: true,
      orgs: {
        networksByTmdb,
        companiesByTmdb,
        logoByName: new Map([
          ["Amazon", "/amazon.png"],
          ["Legendary", "/legendary.png"],
        ]),
      },
    });
    expect(review.tvNetworks[0]?.name).toBe("Amazon");
    expect(review.tvNetworks[0]?.logoUrl).toContain("/amazon.png");
    expect(review.movieStudios.map((bar) => bar.name)).toEqual([
      "Legendary",
      "Warner Bros.",
      "Paramount",
    ]);
    expect(review.movieStudios[0]?.logoUrl).toContain("/legendary.png");
    expect(review.movieGenres[0]?.name).toBe("Sci-Fi");
  });
});
