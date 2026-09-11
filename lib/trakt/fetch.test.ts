import { beforeEach, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({
  calls: [] as string[],
  responses: [] as Array<{
    status: number;
    json: unknown;
    text: string;
    headers: Record<string, string>;
  }>,
  slept: [] as number[],
}));

vi.mock("../net/fetch-json", () => ({
  fetchJson: async (url: string) => {
    ctx.calls.push(url);
    const next = ctx.responses.shift();
    if (!next) {
      throw new Error("unexpected fetch");
    }
    return next;
  },
}));

vi.mock("./rate-limit", async (importOriginal) => {
  const orig = await importOriginal<typeof import("./rate-limit")>();
  const limiter = new orig.TraktLimiter(
    1000,
    async (ms) => {
      ctx.slept.push(ms);
    },
    () => 0,
  );
  return { ...orig, traktLimiter: limiter };
});

import { traktFetchGet } from "./fetch";

describe("traktFetchGet", () => {
  beforeEach(() => {
    ctx.calls = [];
    ctx.responses = [];
    ctx.slept = [];
  });

  it("retries a 429 using Retry-After then succeeds", async () => {
    ctx.responses.push(
      {
        status: 429,
        json: null,
        text: "rate limited",
        headers: { "retry-after": "0" },
      },
      {
        status: 200,
        json: [],
        text: "[]",
        headers: {},
      },
    );
    const res = await traktFetchGet("https://api.trakt.tv/sync/history", {});
    expect(res.status).toBe(200);
    expect(ctx.calls).toHaveLength(2);
    expect(ctx.slept).toEqual([0]);
  });
});
