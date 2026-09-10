import { describe, expect, it } from "vitest";
import { tmdbApiOrigin, traktApiBase } from "./upstream";

describe("upstream bases", () => {
  it("defaults to the public Trakt and TMDB APIs", () => {
    expect(traktApiBase()).toBe("https://api.trakt.tv");
    expect(tmdbApiOrigin()).toBe("https://api.themoviedb.org");
  });
});
