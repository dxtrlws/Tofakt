import { writeAudit } from "../audit/audit";
import { getSettingJson, setSettingJson } from "./settings";

export type WeekStart = "sunday" | "monday";

export type DataPrefs = {
  weekStarts: WeekStart;
  countPartials: boolean;
};

export function isValidTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value.trim().length > 0;
  } catch {
    return false;
  }
}

export function listTimeZones(current?: string): string[] {
  const zones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : ["UTC", "America/New_York", "Europe/London", "Asia/Kolkata"];
  if (current && !zones.includes(current)) {
    return [current, ...zones];
  }
  return zones;
}

export function getDataPrefs(): DataPrefs {
  const stored = getSettingJson<Partial<DataPrefs>>("data.prefs") ?? {};
  return {
    weekStarts: stored.weekStarts === "monday" ? "monday" : "sunday",
    countPartials: stored.countPartials === true,
  };
}

export function saveDataPrefs(patch: {
  timezone?: string;
  weekStarts?: WeekStart;
  countPartials?: boolean;
}): DataPrefs {
  const current = getDataPrefs();
  const next: DataPrefs = {
    weekStarts: patch.weekStarts ?? current.weekStarts,
    countPartials: patch.countPartials ?? current.countPartials,
  };
  setSettingJson("data.prefs", next);
  if (patch.timezone != null && isValidTimeZone(patch.timezone)) {
    setSettingJson("timezone", patch.timezone);
  }
  writeAudit({
    action: "data.save_prefs",
    subjectType: "settings",
    detail: {
      timezone: patch.timezone,
      weekStarts: next.weekStarts,
      countPartials: next.countPartials,
    },
  });
  return next;
}
