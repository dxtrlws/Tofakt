import { describe, expect, it } from "vitest";
import { durationWatchedSeconds } from "./duration";

describe("durationWatchedSeconds", () => {
  it("uses seconds_watched when it is greater than zero", () => {
    expect(
      durationWatchedSeconds({
        secondsWatched: 3210,
        positionMs: 1000,
        durationMs: 3600000,
      }),
    ).toBe(3210);
  });

  it("falls back to position_ms when seconds_watched is zero", () => {
    expect(
      durationWatchedSeconds({
        secondsWatched: 0,
        positionMs: 3619408,
        durationMs: 3619408,
      }),
    ).toBe(3619);
  });

  it("does not treat media runtime as time watched", () => {
    expect(
      durationWatchedSeconds({
        secondsWatched: 0,
        positionMs: 0,
        durationMs: 120000,
      }),
    ).toBeNull();
  });

  it("treats a sub-two-second wall clock as a mark-watched row", () => {
    expect(
      durationWatchedSeconds({
        secondsWatched: 0,
        positionMs: 3619408,
        durationMs: 3619408,
        wallClockMs: 44,
      }),
    ).toBe(0);
  });
});
