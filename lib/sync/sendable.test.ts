import { describe, expect, it } from "vitest";
import { shouldPostRecord } from "./sendable";

describe("shouldPostRecord", () => {
  it("never posts a synced play", () => {
    expect(
      shouldPostRecord({ status: "synced", skipReason: "already_on_trakt" }),
    ).toBe(false);
    expect(shouldPostRecord({ status: "synced", skipReason: null })).toBe(
      false,
    );
  });

  it("never posts while a batch is in flight", () => {
    expect(shouldPostRecord({ status: "syncing", skipReason: null })).toBe(
      false,
    );
  });

  it("never posts an ignored play", () => {
    expect(
      shouldPostRecord({ status: "skipped", skipReason: "user_ignored" }),
    ).toBe(false);
  });

  it("posts pending and retryable failed plays", () => {
    expect(shouldPostRecord({ status: "pending", skipReason: null })).toBe(
      true,
    );
    expect(shouldPostRecord({ status: "failed", skipReason: null })).toBe(true);
  });
});
