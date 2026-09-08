import { describe, expect, it } from "vitest";
import { monthReviewFromPlays, playsFromTraktItems } from "./month";

describe("playsFromTraktItems", () => {
  it("maps movies and episodes with runtime hours and genres", () => {
    const plays = playsFromTraktItems([
      {
        id: 1,
        watched_at: "2026-09-01T05:24:00.000Z",
        type: "episode",
        episode: { title: "The Relic", season: 3, number: 1, runtime: 60 },
        show: {
          title: "Silo",
          genres: ["science-fiction", "drama"],
          ids: { tmdb: 125988 },
        },
      },
      {
        id: 2,
        watched_at: "2026-09-02T08:00:00.000Z",
        type: "movie",
        movie: {
          title: "Suzume",
          runtime: 60,
          genres: ["drama"],
          ids: { tmdb: 916224 },
        },
      },
    ]);
    expect(plays).toHaveLength(2);
    expect(plays[0]?.showTitle).toBe("Silo");
    expect(plays[0]?.seconds).toBe(3600);
    expect(plays[0]?.genres).toEqual(["Science Fiction", "Drama"]);
    expect(plays[1]?.kind).toBe("movie");
    expect(plays[1]?.genres).toEqual(["Drama"]);
  });
});

describe("monthReviewFromPlays", () => {
  it("is empty when the month has no Trakt plays", () => {
    const review = monthReviewFromPlays({
      id: { year: 2026, month: 10 },
      now: new Date("2026-10-01T12:00:00.000Z"),
      timeZone: "America/New_York",
      plays: [],
      prevPlays: 0,
      years: [2026],
      ratings: [],
      traktConnected: true,
    });
    expect(review.empty).toBe(true);
    expect(review.plays).toBe(0);
    expect(review.name).toBe("October");
    expect(review.traktConnected).toBe(true);
  });

  it("counts Trakt plays, hours, and first play in the zone", () => {
    const plays = playsFromTraktItems([
      {
        id: 1,
        watched_at: "2026-09-01T05:24:00.000Z",
        type: "episode",
        episode: { title: "The Relic", season: 3, number: 1, runtime: 60 },
        show: {
          title: "Silo",
          genres: ["drama"],
          ids: { tmdb: 125988 },
        },
      },
      {
        id: 2,
        watched_at: "2026-09-02T05:00:00.000Z",
        type: "episode",
        episode: { title: "The Order", season: 3, number: 2, runtime: 60 },
        show: {
          title: "Silo",
          genres: ["drama"],
          ids: { tmdb: 125988 },
        },
      },
      {
        id: 3,
        watched_at: "2026-09-02T08:00:00.000Z",
        type: "movie",
        movie: {
          title: "Suzume",
          runtime: 60,
          genres: ["drama"],
          ids: { tmdb: 916224 },
        },
      },
    ]);
    const review = monthReviewFromPlays({
      id: { year: 2026, month: 9 },
      now: new Date("2026-09-07T12:00:00.000Z"),
      timeZone: "America/New_York",
      plays,
      prevPlays: 1,
      years: [2026],
      ratings: [],
      traktConnected: true,
    });
    expect(review.empty).toBe(false);
    expect(review.plays).toBe(3);
    expect(review.tvPlays).toBe(2);
    expect(review.moviePlays).toBe(1);
    expect(review.hoursLabel).toBe("3");
    expect(review.daysActive).toBe(2);
    expect(review.first?.title).toBe("Silo");
    expect(review.first?.backdropUrl).toBeNull();
    expect(review.vsLastMonth).toBe("+2 vs last month");
    expect(review.movieGenres[0]?.name).toBe("Drama");
    expect(review.movieGenres[0]?.plays).toBe(1);
    expect(review.movieGenres[0]?.caption).toBe("1 film");
    expect(review.tvGenres[0]?.name).toBe("Drama");
    expect(review.tvGenres[0]?.plays).toBe(1);
    expect(review.tvGenres[0]?.caption).toBe("1 show");
    expect(review.daily[0]).toBe(1);
    expect(review.daily[1]).toBe(2);
    expect(review.heatmapHours.flat().some((hours) => hours > 0)).toBe(true);
  });
});
