import { describe, expect, it } from "vitest";
import { formatBuildId, resolveBuildId } from "./build";

describe("formatBuildId", () => {
  it("shortens a full Git SHA to seven characters", () => {
    expect(formatBuildId("BEEFCAFE1234567890abcdef1234567890abcdef")).toBe(
      "beefcaf",
    );
  });

  it("keeps a non-SHA label as written", () => {
    expect(formatBuildId("dev")).toBe("dev");
    expect(formatBuildId("  local-build  ")).toBe("local-build");
  });

  it("treats blank values as missing", () => {
    expect(formatBuildId("")).toBeUndefined();
    expect(formatBuildId("   ")).toBeUndefined();
    expect(formatBuildId(undefined)).toBeUndefined();
  });
});

describe("resolveBuildId", () => {
  it("prefers the environment value over git", () => {
    expect(
      resolveBuildId("abc1234def", "ffffffffffffffffffffffffffffffffffffffff"),
    ).toBe("abc1234");
  });

  it("falls back to git, then dev", () => {
    expect(
      resolveBuildId(undefined, "c0ffee1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
    ).toBe("c0ffee1");
    expect(resolveBuildId(undefined, undefined)).toBe("dev");
  });
});
