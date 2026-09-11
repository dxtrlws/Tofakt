import { describe, expect, it } from "vitest";
import { flashToToast } from "./flash";

describe("flashToToast", () => {
  it("maps error to a failed toast even when info is present", () => {
    expect(
      flashToToast({ error: "Trakt is not connected.", info: "Synced 2." }),
    ).toEqual({
      level: "error",
      message: "Trakt is not connected.",
    });
  });

  it("maps info to a success toast", () => {
    expect(flashToToast({ info: "Data preferences saved." })).toEqual({
      level: "ok",
      message: "Data preferences saved.",
    });
  });

  it("maps warn level to a warning toast", () => {
    expect(
      flashToToast({
        info: "Synced 2 (0 already on Trakt, 1 unmatched).",
        level: "warn",
      }),
    ).toEqual({
      level: "warn",
      message: "Synced 2 (0 already on Trakt, 1 unmatched).",
    });
  });

  it("skips empty and whitespace-only flashes", () => {
    expect(flashToToast({})).toBeNull();
    expect(flashToToast({ error: "  ", info: "   " })).toBeNull();
  });

  it("skips device-flow start and poll ticks", () => {
    expect(
      flashToToast({
        info: "Enter this code on Trakt, then wait here.",
        flow: { id: "1" },
      }),
    ).toBeNull();
    expect(flashToToast({ info: "Waiting for approval…" })).toBeNull();
    expect(
      flashToToast({ info: "Approve Watchlog in tofa, then wait here." }),
    ).toBeNull();
  });
});
