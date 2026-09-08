import { describe, expect, it } from "vitest";
import type { ConnectionRow } from "./store";
import { needsProactiveRefresh } from "./store";

function row(patch: Partial<ConnectionRow>): ConnectionRow {
  return {
    id: "trakt",
    provider: "trakt",
    status: "ok",
    baseUrl: null,
    serverId: null,
    authMethod: "device",
    accessTokenEnc: "enc",
    refreshTokenEnc: "enc-refresh",
    extraEnc: null,
    extraJson: null,
    expiresAt: null,
    accountLabel: null,
    capabilitiesJson: null,
    lastVerifiedAt: null,
    lastError: null,
    ...patch,
  };
}

describe("needsProactiveRefresh", () => {
  it("refreshes at 75% of lifetime, not at issuance", () => {
    const issuedAt = 1_000_000;
    const lifetime = 100_000;
    const at75 = issuedAt + lifetime * 0.75;
    const before = row({
      expiresAt: new Date(issuedAt + lifetime),
      extraJson: JSON.stringify({ tokenIssuedAt: issuedAt }),
    });
    const spyNow = Date.now;
    try {
      Date.now = () => issuedAt + 1_000;
      expect(needsProactiveRefresh(before)).toBe(false);
      Date.now = () => at75;
      expect(needsProactiveRefresh(before)).toBe(true);
    } finally {
      Date.now = spyNow;
    }
  });
});
