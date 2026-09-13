import { describe, expect, it } from "vitest";
import { resolveVersion } from "./version";

describe("resolveVersion", () => {
  it("prefers WATCHLOG_VERSION over npm and package.json", () => {
    expect(resolveVersion("v0.3.0", "0.2.1", "0.1.0")).toBe("0.3.0");
  });

  it("ignores non-semver env values", () => {
    expect(resolveVersion("main", "0.2.1", "0.1.0")).toBe("0.2.1");
    expect(resolveVersion(undefined, undefined, undefined)).toBe("0.0.0");
  });
});
