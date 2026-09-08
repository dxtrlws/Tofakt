import { describe, expect, it } from "vitest";
import { nextAttemptAt, shouldRetryStatus } from "./backoff";

describe("backoff", () => {
  it("retries 429 and 5xx only", () => {
    expect(shouldRetryStatus(429)).toBe(true);
    expect(shouldRetryStatus(503)).toBe(true);
    expect(shouldRetryStatus(400)).toBe(false);
    expect(shouldRetryStatus(404)).toBe(false);
  });

  it("stays within the first backoff cap", () => {
    const at = nextAttemptAt(1, 0, () => 1);
    expect(at.getTime()).toBe(30_000);
  });
});
