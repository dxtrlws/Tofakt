import { beforeEach, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({
  count: 0,
  fetchedAt: null as Date | null,
  missingPayload: false,
  pulls: 0,
  pullStarted: 0,
  hang: null as Promise<void> | null,
}));

vi.mock("../sync/reconcile", () => ({
  pullTraktHistory: async () => {
    ctx.pullStarted += 1;
    if (ctx.hang) {
      await ctx.hang;
    }
    ctx.pulls += 1;
    ctx.count = Math.max(ctx.count, 1);
    ctx.fetchedAt = new Date();
    ctx.missingPayload = false;
    return { count: ctx.count, matched: 0 };
  },
  snapshotCount: () => ctx.count,
  snapshotFetchedAt: () => ctx.fetchedAt,
  snapshotMissingPayload: () => ctx.missingPayload,
}));

vi.mock("../data/settings", () => ({
  getSettingJson: () => undefined,
  setSettingJson: () => undefined,
}));

vi.mock("../logger", () => ({
  logger: { warn() {}, info() {}, error() {}, debug() {} },
}));

import { ensureHistorySnapshot, HISTORY_TTL_MS } from "./cache";

describe("ensureHistorySnapshot", () => {
  beforeEach(() => {
    ctx.count = 0;
    ctx.fetchedAt = null;
    ctx.missingPayload = false;
    ctx.pulls = 0;
    ctx.pullStarted = 0;
    ctx.hang = null;
  });

  it("awaits a pull when the snapshot is empty", async () => {
    const result = await ensureHistorySnapshot();
    expect(result.ready).toBe(true);
    expect(ctx.pulls).toBe(1);
  });

  it("returns stale rows without waiting on a background pull", async () => {
    ctx.count = 2;
    ctx.fetchedAt = new Date(Date.now() - HISTORY_TTL_MS - 1000);
    let release: (value?: void) => void = () => undefined;
    ctx.hang = new Promise<void>((resolve) => {
      release = resolve;
    });
    const result = await ensureHistorySnapshot();
    expect(result.ready).toBe(true);
    expect(ctx.pullStarted).toBe(1);
    expect(ctx.pulls).toBe(0);
    release();
    await ctx.hang;
  });
});
