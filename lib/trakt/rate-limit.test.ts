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
});
