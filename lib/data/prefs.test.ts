import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDataPrefs, isValidTimeZone, saveDataPrefs } from "./prefs";

const store = vi.hoisted(() => new Map<string, unknown>());

vi.mock("../settings", () => ({
  getSettingJson: (key: string) => store.get(key),
  setSettingJson: (key: string, value: unknown) => {
    if (value == null) {
      store.delete(key);
      return;
    }
    store.set(key, value);
  },
}));

vi.mock("../audit", () => ({
  writeAudit: () => undefined,
}));

describe("isValidTimeZone", () => {
  it("accepts IANA names", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
  });

  it("rejects empty or invented names", () => {
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });
});

describe("saveDataPrefs", () => {
  beforeEach(() => {
    store.clear();
  });

  it("stores week start, partials, and timezone", () => {
    saveDataPrefs({
      timezone: "America/New_York",
      weekStarts: "monday",
      countPartials: true,
    });
    expect(getDataPrefs()).toEqual({
      weekStarts: "monday",
      countPartials: true,
    });
    expect(store.get("timezone")).toBe("America/New_York");
  });

  it("ignores an invalid timezone", () => {
    saveDataPrefs({ timezone: "Nope", weekStarts: "sunday" });
    expect(store.has("timezone")).toBe(false);
  });
});
