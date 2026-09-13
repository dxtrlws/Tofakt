import { describe, expect, it } from "vitest";
import {
  canonicalVersion,
  compareSemver,
  compareVersionStrings,
  parseSemver,
} from "./semver";

describe("parseSemver", () => {
  it("accepts a leading v and prerelease", () => {
    expect(parseSemver("v0.2.2")).toEqual({
      major: 0,
      minor: 2,
      patch: 2,
      prerelease: null,
    });
    expect(parseSemver("0.3.0-rc.1")).toEqual({
      major: 0,
      minor: 3,
      patch: 0,
      prerelease: "rc.1",
    });
  });

  it("rejects non-semver labels", () => {
    expect(parseSemver("dev")).toBeNull();
    expect(parseSemver("main")).toBeNull();
    expect(parseSemver("")).toBeNull();
  });
});

describe("canonicalVersion", () => {
  it("strips a leading v", () => {
    expect(canonicalVersion("V0.2.2")).toBe("0.2.2");
  });
});

describe("compareVersionStrings", () => {
  it("flags a newer GitHub release", () => {
    expect(compareVersionStrings("0.2.1", "0.2.2")).toBe("available");
    expect(compareVersionStrings("v0.2.2", "0.2.2")).toBe("current");
    expect(compareVersionStrings("0.3.0", "0.2.2")).toBe("ahead");
  });

  it("treats a prerelease as older than the same release", () => {
    expect(compareVersionStrings("0.2.2-rc.1", "0.2.2")).toBe("available");
    const release = parseSemver("0.2.2");
    const rc = parseSemver("0.2.2-rc.1");
    expect(release && rc ? compareSemver(release, rc) : 0).toBeGreaterThan(0);
  });
});
