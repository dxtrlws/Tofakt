import { afterEach, describe, expect, it } from "vitest";
import { isAllowedOrigin, originCandidates } from "./origin";
import { resetBucketsForTests, takeToken } from "./rate-limit";

afterEach(() => {
  resetBucketsForTests();
});

describe("takeToken", () => {
  it("allows up to the limit inside the window", () => {
    const now = 1_000;
    expect(takeToken("login:1", 2, 60_000, now)).toEqual({ ok: true });
    expect(takeToken("login:1", 2, 60_000, now + 10)).toEqual({ ok: true });
    expect(takeToken("login:1", 2, 60_000, now + 20)).toEqual({
      ok: false,
      retryAfterMs: 59_980,
    });
  });

  it("resets after the window", () => {
    const now = 1_000;
    takeToken("login:2", 1, 1_000, now);
    expect(takeToken("login:2", 1, 1_000, now + 1_000)).toEqual({ ok: true });
  });
});

describe("origin", () => {
  it("accepts BASE_URL and forwarded host", () => {
    const candidates = originCandidates({
      baseUrl: "https://watchlog.example.com",
      host: "watchlog:9477",
      forwardedHost: "watchlog.example.com",
      forwardedProto: "https",
    });
    expect(isAllowedOrigin("https://watchlog.example.com", candidates)).toBe(
      true,
    );
    expect(isAllowedOrigin("http://evil.example", candidates)).toBe(false);
  });
});
