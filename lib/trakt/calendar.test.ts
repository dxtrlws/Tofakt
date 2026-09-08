import { describe, expect, it } from "vitest";
import { parseTraktCalendarItems } from "./calendar";

describe("parseTraktCalendarItems", () => {
  it("reads episode_type and show titles", () => {
    const items = parseTraktCalendarItems([
      {
        first_aired: "2026-09-09T01:00:00.000Z",
        episode: {
          season: 2,
          number: 1,
          title: "Season premiere",
          episode_type: "season_premiere",
          ids: { tmdb: 1 },
        },
        show: {
          title: "The Pitt",
          ids: { tmdb: 123 },
        },
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]?.show.title).toBe("The Pitt");
    expect(items[0]?.episode.episode_type).toBe("season_premiere");
  });
});
