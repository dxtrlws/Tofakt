import { describe, expect, it } from "vitest";
import {
  isBlockedMetadataHost,
  isLoopbackHost,
  parseTofaBaseUrl,
} from "./ssrf";

describe("parseTofaBaseUrl", () => {
  it("accepts a LAN http URL and strips /api/v1", () => {
    const parsed = parseTofaBaseUrl("http://192.168.1.50:33333/api/v1/");
    expect(parsed).toEqual({
      ok: true,
      href: "http://192.168.1.50:33333",
      loopback: false,
      hostname: "192.168.1.50",
    });
  });

  it("rejects non-http schemes and metadata hosts", () => {
    expect(parseTofaBaseUrl("file:///etc/passwd").ok).toBe(false);
    expect(parseTofaBaseUrl("http://169.254.169.254/latest").ok).toBe(false);
    expect(parseTofaBaseUrl("http://metadata.google.internal/").ok).toBe(false);
  });

  it("flags loopback without rejecting it", () => {
    const parsed = parseTofaBaseUrl("http://localhost:33333");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.loopback).toBe(true);
    }
  });
});

describe("host checks", () => {
  it("treats localhost aliases as loopback", () => {
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
    expect(isLoopbackHost("192.168.1.50")).toBe(false);
  });

  it("blocks link-local metadata", () => {
    expect(isBlockedMetadataHost("169.254.169.254")).toBe(true);
    expect(isBlockedMetadataHost("192.168.1.50")).toBe(false);
  });
});
