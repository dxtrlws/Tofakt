import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSyncSettings, saveSyncSettings } from "./settings";

const store = vi.hoisted(() => new Map<string, unknown>());

vi.mock("../data/settings", () => ({
  getSettingJson: (key: string) => store.get(key),
  setSettingJson: (key: string, value: unknown) => {
    if (value == null) {
      store.delete(key);
      return;
    }
    store.set(key, value);
  },
}));

describe("getSyncSettings", () => {
  beforeEach(() => {
    store.clear();
  });

  it("defaults reconciliation to off", () => {
    expect(getSyncSettings()).toMatchObject({
      mode: "manual",
      reconcileEnabled: false,
      reconcileEveryMinutes: 60,
    });
  });

  it("stores a reconciliation schedule", () => {
    saveSyncSettings({
      reconcileEnabled: true,
      reconcileEveryMinutes: 180,
    });
    expect(getSyncSettings()).toMatchObject({
      reconcileEnabled: true,
      reconcileEveryMinutes: 180,
    });
  });
});
