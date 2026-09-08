import { describe, expect, it } from "vitest";
import {
  airsInLabel,
  calendarDaysApart,
  episodeTypeLabel,
  matchesUpcomingFilter,
  parseUpcomingFilter,
} from "./upcoming";

describe("parseUpcomingFilter", () => {
  it("defaults to all", () => {
    expect(parseUpcomingFilter(undefined)).toBe("all");
    expect(parseUpcomingFilter("nope")).toBe("all");
  });

  it("accepts premieres and finales", () => {
    expect(parseUpcomingFilter("premieres")).toBe("premieres");
    expect(parseUpcomingFilter(["finales"])).toBe("finales");
  });
});

describe("matchesUpcomingFilter", () => {
  it("lets every episode through All", () => {
    expect(matchesUpcomingFilter("standard", "all")).toBe(true);
    expect(matchesUpcomingFilter("season_finale", "all")).toBe(true);
  });

  it("keeps premieres and finales in their buckets", () => {
    expect(matchesUpcomingFilter("season_premiere", "premieres")).toBe(true);
    expect(matchesUpcomingFilter("series_premiere", "premieres")).toBe(true);
    expect(matchesUpcomingFilter("season_finale", "premieres")).toBe(false);
    expect(matchesUpcomingFilter("season_finale", "finales")).toBe(true);
    expect(matchesUpcomingFilter("mid_season_finale", "finales")).toBe(true);
    expect(matchesUpcomingFilter("standard", "finales")).toBe(false);
  });
});

describe("episodeTypeLabel", () => {
  it("names premiere and finale types", () => {
    expect(episodeTypeLabel("season_premiere")).toBe("Season premiere");
    expect(episodeTypeLabel("season_finale")).toBe("Finale");
    expect(episodeTypeLabel("standard")).toBeNull();
  });
});

describe("airsInLabel", () => {
  const tz = "America/New_York";
  const now = new Date("2026-09-07T20:00:00.000Z");

  it("uses today, tomorrow, in N days, and next week", () => {
    expect(airsInLabel(new Date("2026-09-07T23:00:00.000Z"), now, tz)).toBe(
      "Today",
    );
    expect(airsInLabel(new Date("2026-09-08T20:00:00.000Z"), now, tz)).toBe(
      "Tomorrow",
    );
    expect(airsInLabel(new Date("2026-09-10T20:00:00.000Z"), now, tz)).toBe(
      "In 3 days",
    );
    expect(airsInLabel(new Date("2026-09-16T20:00:00.000Z"), now, tz)).toBe(
      "Next week",
    );
  });
});

describe("calendarDaysApart", () => {
  it("counts calendar days in the zone", () => {
    expect(
      calendarDaysApart(
        new Date("2026-09-07T20:00:00.000Z"),
        new Date("2026-09-10T03:00:00.000Z"),
        "America/New_York",
      ),
    ).toBe(2);
  });
});
