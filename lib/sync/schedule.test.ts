import { describe, expect, it } from "vitest";
import {
  formatScheduleLabel,
  isScheduleDue,
  parseScheduleValue,
  scheduleOptions,
  scheduleSelectValue,
} from "./schedule";

describe("isScheduleDue", () => {
  const now = Date.parse("2026-09-08T12:00:00.000Z");

  it("is not due when disabled", () => {
    expect(
      isScheduleDue({
        enabled: false,
        everyMinutes: 5,
        lastFinishedAt: null,
        now,
      }),
    ).toBe(false);
  });

  it("is due when enabled and never finished", () => {
    expect(
      isScheduleDue({
        enabled: true,
        everyMinutes: 5,
        lastFinishedAt: null,
        now,
      }),
    ).toBe(true);
  });

  it("is due once the interval has elapsed", () => {
    expect(
      isScheduleDue({
        enabled: true,
        everyMinutes: 5,
        lastFinishedAt: new Date(now - 5 * 60_000),
        now,
      }),
    ).toBe(true);
  });

  it("is not due before the interval elapses", () => {
    expect(
      isScheduleDue({
        enabled: true,
        everyMinutes: 5,
        lastFinishedAt: new Date(now - 4 * 60_000),
        now,
      }),
    ).toBe(false);
  });
});

describe("parseScheduleValue", () => {
  it("turns Off into disabled without dropping the last interval", () => {
    expect(
      parseScheduleValue("off", { enabled: true, minutes: 5 }, 1, 60),
    ).toEqual({
      enabled: false,
      minutes: 5,
    });
  });

  it("parses a selected interval", () => {
    expect(
      parseScheduleValue("15", { enabled: false, minutes: 60 }, 15, 1440),
    ).toEqual({ enabled: true, minutes: 15 });
  });

  it("falls back when the field is missing", () => {
    expect(
      parseScheduleValue(null, { enabled: true, minutes: 5 }, 1, 60),
    ).toEqual({ enabled: true, minutes: 5 });
  });
});

describe("schedule labels", () => {
  it("formats hour and day intervals", () => {
    expect(formatScheduleLabel(1)).toBe("Every 1 minute");
    expect(formatScheduleLabel(15)).toBe("Every 15 minutes");
    expect(formatScheduleLabel(60)).toBe("Every hour");
    expect(formatScheduleLabel(180)).toBe("Every 3 hours");
    expect(formatScheduleLabel(1440)).toBe("Every day");
  });

  it("keeps a custom interval in the option list", () => {
    expect(scheduleOptions([1, 5, 10], 7)).toEqual([1, 5, 7, 10]);
  });

  it("serializes Off vs minutes for the select", () => {
    expect(scheduleSelectValue(false, 5)).toBe("off");
    expect(scheduleSelectValue(true, 5)).toBe("5");
  });
});
