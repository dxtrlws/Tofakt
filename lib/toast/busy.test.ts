import { describe, expect, it } from "vitest";
import {
  absorbMapped,
  BUSY_DELAY_MS,
  type BusyRegistry,
  beginBusy,
  endBusy,
} from "./busy";

function registry(): BusyRegistry {
  return { nextId: 0, timers: new Map(), toasts: [] };
}

describe("beginBusy / endBusy", () => {
  it("does not show a busy toast until the delay elapses", () => {
    const current = registry();
    const queued: Array<() => void> = [];
    const clock = {
      setTimeout: (fn: () => void) => {
        queued.push(fn);
        return queued.length;
      },
      clearTimeout: () => undefined,
    };
    const id = beginBusy(current, "Syncing plays…", clock);
    expect(current.toasts).toEqual([]);
    expect(id).toBe("1");
    queued[0]?.();
    expect(current.toasts).toEqual([
      { id: "1", level: "busy", message: "Syncing plays…" },
    ]);
  });

  it("skips the busy toast when the action finishes before the delay", () => {
    const current = registry();
    const queued: Array<() => void> = [];
    const clock = {
      setTimeout: (fn: () => void) => {
        queued.push(fn);
        return queued.length;
      },
      clearTimeout: () => {
        queued.length = 0;
      },
    };
    const id = beginBusy(current, "Saving preferences…", clock, BUSY_DELAY_MS);
    endBusy(current, id, { info: "Sync preferences saved." }, clock);
    expect(queued).toEqual([]);
    expect(current.toasts).toEqual([
      { id: "1", level: "ok", message: "Sync preferences saved." },
    ]);
  });

  it("replaces a shown busy toast in place with the result", () => {
    const current = registry();
    const queued: Array<() => void> = [];
    const clock = {
      setTimeout: (fn: () => void) => {
        queued.push(fn);
        return queued.length;
      },
      clearTimeout: () => undefined,
    };
    const id = beginBusy(current, "Syncing plays…", clock);
    queued[0]?.();
    endBusy(
      current,
      id,
      { info: "Synced 12 (0 already on Trakt, 0 unmatched)." },
      clock,
    );
    expect(current.toasts).toEqual([
      {
        id: "1",
        level: "ok",
        message: "Synced 12 (0 already on Trakt, 0 unmatched).",
      },
    ]);
  });

  it("skips empty completion flashes", () => {
    const current = registry();
    const clock = {
      setTimeout: () => 1,
      clearTimeout: () => undefined,
    };
    const id = beginBusy(current, "Saving…", clock);
    endBusy(current, id, {}, clock);
    expect(current.toasts).toEqual([]);
  });

  it("keeps phrase errors inline instead of toasting them", () => {
    const current = registry();
    const clock = {
      setTimeout: () => 1,
      clearTimeout: () => undefined,
    };
    const id = beginBusy(current, "Clearing…", clock, 0);
    endBusy(current, id, { error: "Type CLEAR to confirm." }, clock, {
      errors: "inline",
    });
    expect(current.toasts).toEqual([]);
  });
});

describe("absorbMapped", () => {
  it("cancels a pending busy timer when the result arrives", () => {
    const current = registry();
    const queued: Array<() => void> = [];
    const clock = {
      setTimeout: (fn: () => void) => {
        queued.push(fn);
        return queued.length;
      },
      clearTimeout: () => {
        queued.length = 0;
      },
    };
    beginBusy(current, "Syncing plays…", clock);
    absorbMapped(
      current,
      { level: "ok", message: "Synced 12 (0 already on Trakt, 0 unmatched)." },
      clock,
    );
    expect(queued).toEqual([]);
    expect(current.toasts).toEqual([
      {
        id: "2",
        level: "ok",
        message: "Synced 12 (0 already on Trakt, 0 unmatched).",
      },
    ]);
  });

  it("replaces an in-flight busy toast with the result", () => {
    const current = registry();
    const queued: Array<() => void> = [];
    const clock = {
      setTimeout: (fn: () => void) => {
        queued.push(fn);
        return queued.length;
      },
      clearTimeout: () => undefined,
    };
    beginBusy(current, "Syncing plays…", clock);
    queued[0]?.();
    absorbMapped(
      current,
      { level: "ok", message: "Synced 12 (0 already on Trakt, 0 unmatched)." },
      clock,
    );
    expect(current.toasts).toEqual([
      {
        id: "1",
        level: "ok",
        message: "Synced 12 (0 already on Trakt, 0 unmatched).",
      },
    ]);
  });

  it("does not duplicate a result that is already showing", () => {
    const current = registry();
    const clock = {
      setTimeout: () => 1,
      clearTimeout: () => undefined,
    };
    current.nextId = 1;
    current.toasts = [
      { id: "1", level: "ok", message: "Sync preferences saved." },
    ];
    absorbMapped(
      current,
      { level: "ok", message: "Sync preferences saved." },
      clock,
    );
    expect(current.toasts).toEqual([
      { id: "1", level: "ok", message: "Sync preferences saved." },
    ]);
  });
});
