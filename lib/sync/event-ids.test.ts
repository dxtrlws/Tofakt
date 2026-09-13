import { describe, expect, it } from "vitest";
import { parseSyncEventIds } from "./event-ids";

describe("parseSyncEventIds", () => {
  it("reads unique event ids in form order", () => {
    const form = new FormData();
    form.append("eventId", "a");
    form.append("eventId", " b ");
    form.append("eventId", "a");
    form.append("eventId", "");
    form.append("other", "nope");
    expect(parseSyncEventIds(form)).toEqual(["a", "b"]);
  });

  it("returns an empty list when nothing is selected", () => {
    expect(parseSyncEventIds(new FormData())).toEqual([]);
  });
});
