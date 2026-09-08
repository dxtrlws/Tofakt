import { describe, expect, it } from "vitest";
import { overlapStartIso, shouldStopPaging } from "./paging";

describe("shouldStopPaging", () => {
  it("walks every page when there is no watermark", () => {
    expect(
      shouldStopPaging({
        hasMore: true,
        pageOldestStartedAt: "2020-01-01T00:00:00.000Z",
        overlapStartIso: null,
      }),
    ).toBe(false);
  });

  it("stops once a page is entirely older than the 24h overlap", () => {
    const watermark = "2026-09-05T01:24:30.000Z";
    expect(
      shouldStopPaging({
        hasMore: true,
        pageOldestStartedAt: "2026-09-03T00:00:00.000Z",
        overlapStartIso: overlapStartIso(watermark),
      }),
    ).toBe(true);
  });

  it("keeps paging through the overlap window", () => {
    const watermark = "2026-09-05T01:24:30.000Z";
    expect(
      shouldStopPaging({
        hasMore: true,
        pageOldestStartedAt: "2026-09-04T12:00:00.000Z",
        overlapStartIso: overlapStartIso(watermark),
      }),
    ).toBe(false);
  });
});
