import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({
  calls: 0,
  fail: false,
  inserts: 0,
  gate: null as Promise<void> | null,
}));

vi.mock("drizzle-orm", () => ({ eq: () => ({}) }));

vi.mock("../db/schema", () => ({ tmdbTitleCache: { id: "id" } }));

vi.mock("../db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({ where: () => ({ get: () => undefined }) }),
    }),
    insert: () => ({
      values: () => ({
        run: () => {
          ctx.inserts += 1;
        },
      }),
    }),
    update: () => ({
      set: () => ({ where: () => ({ run: () => undefined }) }),
    }),
  }),
}));

vi.mock("../logger", () => ({
  logger: { warn() {}, info() {}, error() {}, debug() {} },
}));

vi.mock("./client", () => ({
  tmdbDetails: async () => {
    ctx.calls += 1;
    if (ctx.gate) {
      await ctx.gate;
    }
    if (ctx.fail) {
      throw new Error("TMDB rate limited");
    }
    return { poster_path: "/poster.jpg", backdrop_path: "/backdrop.jpg" };
  },
}));

import { tmdbPosterUrl } from "./poster";

let nextId = 5000;

function freshId(): number {
  nextId += 1;
  return nextId;
}

beforeEach(() => {
  ctx.calls = 0;
  ctx.fail = false;
  ctx.inserts = 0;
  ctx.gate = null;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("tmdbPosterUrl", () => {
  it("caches a hit and never refetches it", async () => {
    const id = freshId();
    expect(await tmdbPosterUrl("key", "movie", id)).toBe(
      "https://image.tmdb.org/t/p/w342/poster.jpg",
    );
    expect(await tmdbPosterUrl("key", "movie", id)).toBe(
      "https://image.tmdb.org/t/p/w342/poster.jpg",
    );
    expect(ctx.calls).toBe(1);
    expect(ctx.inserts).toBe(1);
  });

  it("does not persist a failed lookup", async () => {
    ctx.fail = true;
    expect(await tmdbPosterUrl("key", "movie", freshId())).toBeNull();
    expect(ctx.inserts).toBe(0);
  });

  // A rate limit or a timeout used to be cached as "this title has no poster"
  // for a full day, so the artwork stayed blank until the process restarted.
  it("retries a failed lookup once the failure window passes", async () => {
    vi.useFakeTimers();
    const id = freshId();
    ctx.fail = true;
    expect(await tmdbPosterUrl("key", "movie", id)).toBeNull();
    expect(ctx.calls).toBe(1);

    // Still inside the window: held off rather than hammering TMDB.
    expect(await tmdbPosterUrl("key", "movie", id)).toBeNull();
    expect(ctx.calls).toBe(1);

    vi.setSystemTime(Date.now() + 31_000);
    ctx.fail = false;
    expect(await tmdbPosterUrl("key", "movie", id)).toBe(
      "https://image.tmdb.org/t/p/w342/poster.jpg",
    );
    expect(ctx.calls).toBe(2);
  });

  it("shares one request between concurrent lookups of the same title", async () => {
    const id = freshId();
    let release = () => {};
    ctx.gate = new Promise<void>((resolve) => {
      release = () => {
        resolve();
      };
    });
    const both = Promise.all([
      tmdbPosterUrl("key", "tv", id),
      tmdbPosterUrl("key", "tv", id),
    ]);
    release();
    expect(await both).toEqual([
      "https://image.tmdb.org/t/p/w342/poster.jpg",
      "https://image.tmdb.org/t/p/w342/poster.jpg",
    ]);
    expect(ctx.calls).toBe(1);
  });
});
