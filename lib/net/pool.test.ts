import { describe, expect, it } from "vitest";
import { mapPool } from "./pool";

describe("mapPool", () => {
  it("keeps results in the order of the input", async () => {
    const out = await mapPool([1, 2, 3, 4, 5], 2, async (n) => {
      await new Promise((resolve) => setTimeout(resolve, (5 - n) * 2));
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50]);
  });

  it("never runs more than `limit` at once", async () => {
    let live = 0;
    let peak = 0;
    await mapPool(
      Array.from({ length: 40 }, (_, i) => i),
      4,
      async () => {
        live += 1;
        peak = Math.max(peak, live);
        await new Promise((resolve) => setTimeout(resolve, 1));
        live -= 1;
      },
    );
    expect(peak).toBe(4);
  });

  it("returns an empty list for no items", async () => {
    expect(await mapPool([], 4, async () => 1)).toEqual([]);
  });
});
