import { describe, expect, it } from "vitest";
import { publicPayloadHasSecrets, toPublic } from "./public";

describe("toPublic", () => {
  it("never copies ciphertext or token fields into the client DTO", () => {
    const dto = toPublic(
      {
        id: "tofa",
        provider: "tofa",
        status: "ok",
        baseUrl: "http://192.168.1.50:33333",
        serverId: "abc",
        authMethod: "api_key",
        accessTokenEnc: `${"aa".repeat(12)}:${"bb".repeat(12)}:${"cc".repeat(16)}`,
        refreshTokenEnc: "secret-refresh",
        extraEnc: "client-secret-blob",
        extraJson: JSON.stringify({ version: "0.9.36" }),
        expiresAt: null,
        accountLabel: "dxtrlws",
        capabilitiesJson: '["auth.api_keys"]',
        lastVerifiedAt: new Date("2026-09-07T00:00:00Z"),
        lastError: null,
      },
      "tofa",
    );

    expect(dto.hasSecret).toBe(true);
    expect(dto.hasRefresh).toBe(true);
    expect(dto.accountLabel).toBe("dxtrlws");
    expect(dto.versionLabel).toBe("0.9.36");
    expect(JSON.stringify(dto)).not.toContain("secret-refresh");
    expect(JSON.stringify(dto)).not.toContain("client-secret-blob");
    expect(publicPayloadHasSecrets(dto)).toBe(false);
  });
});
