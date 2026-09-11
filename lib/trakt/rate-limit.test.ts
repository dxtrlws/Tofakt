import { describe, expect, it } from "vitest";
import { TraktLimiter } from "./rate-limit";

describe("TraktLimiter", () => {
  it("spaces writes by the configured interval", async () => {
    let now = 0;
    const slept: number[] = [];
    const limiter = new TraktLimiter(
      1000,
      async (ms) => {
        slept.push(ms);
        now += ms;
      },
      () => now,
    );
    await limiter.waitWrite();
    await limiter.waitWrite();
    expect(slept[0]).toBe(1000);
  });

  it("caps GETs at 500 per 5 minutes", async () => {
    let now = 0;
    const slept: number[] = [];
    const limiter = new TraktLimiter(
      1000,
      async (ms) => {
        slept.push(ms);
        now += ms;
      },
      () => now,
    );
    for (let i = 0; i < 500; i += 1) {
      await limiter.waitGet();
    }
    expect(slept).toEqual([]);
    expect(limiter.snapshot()).toEqual({
      gets: 500,
      budget: 500,
      windowMinutes: 5,
    });
    await limiter.waitGet();
    expect(slept[0]).toBe(5 * 60_000);
  });

  it("waits until X-Ratelimit until when remaining is 0", async () => {
    let now = Date.parse("2026-09-11T00:00:00.000Z");
    const slept: number[] = [];
    const limiter = new TraktLimiter(
      1000,
      async (ms) => {
        slept.push(ms);
        now += ms;
      },
      () => now,
    );
    limiter.noteGetHeaders({
      "x-ratelimit": JSON.stringify({
        name: "AUTHED_API_GET_LIMIT",
        remaining: 0,
        until: "2026-09-11T00:00:08.000Z",
      }),
    });
    await limiter.waitGet();
    expect(slept[0]).toBe(8000);
  });
});
