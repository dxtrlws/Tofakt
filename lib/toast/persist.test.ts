import { beforeEach, describe, expect, it, vi } from "vitest";
import { persistToast, takeToastSeed } from "./persist";

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
  deleteSetting: (key: string) => {
    store.delete(key);
  },
}));

describe("takeToastSeed", () => {
  beforeEach(() => {
    store.clear();
  });

  it("returns a persisted toast once then clears it", () => {
    persistToast({ info: "Sync preferences saved." });
    expect(takeToastSeed()).toMatchObject({
      level: "ok",
      message: "Sync preferences saved.",
    });
    expect(takeToastSeed()).toBeNull();
  });

  it("discards a stale seed without showing it", () => {
    persistToast({ info: "Data preferences saved." });
    const stored = store.get("ui.toast") as { nonce: number };
    store.set("ui.toast", { ...stored, nonce: Date.now() - 11_000 });
    expect(takeToastSeed()).toBeNull();
    expect(store.has("ui.toast")).toBe(false);
  });
});
