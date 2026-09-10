import { describe, expect, it } from "vitest";
import { formatBytes, formatStamp, formatUptime } from "./about-format";

describe("about formatting", () => {
  it("renders uptime like the Paper About row", () => {
    expect(formatUptime(0)).toBe("just now");
    expect(formatUptime(12 * 60_000)).toBe("12m");
    expect(formatUptime((2 * 24 + 4) * 60 * 60_000)).toBe("2d 4h");
  });

  it("renders database size in megabytes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(4.2 * 1024 * 1024)).toBe("4.2 MB");
  });

  it("stamps job times in the configured timezone", () => {
    expect(
      formatStamp(new Date("2026-09-07T20:54:00.000Z"), "America/New_York"),
    ).toBe("2026-09-07 16:54");
  });
});
