export const INGEST_INTERVALS = [1, 5, 10, 15, 30, 60] as const;
export const RECONCILE_INTERVALS = [15, 30, 60, 180, 360, 720, 1440] as const;

export const INGEST_INTERVAL_MIN = 1;
export const INGEST_INTERVAL_MAX = 60;
export const RECONCILE_INTERVAL_MIN = 15;
export const RECONCILE_INTERVAL_MAX = 1440;

export function clampMinutes(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function isScheduleDue(opts: {
  enabled: boolean;
  everyMinutes: number;
  lastFinishedAt: Date | string | null | undefined;
  now?: number;
}): boolean {
  if (!opts.enabled || opts.everyMinutes < 1) {
    return false;
  }
  if (opts.lastFinishedAt == null) {
    return true;
  }
  const last =
    opts.lastFinishedAt instanceof Date
      ? opts.lastFinishedAt.getTime()
      : new Date(opts.lastFinishedAt).getTime();
  if (!Number.isFinite(last)) {
    return true;
  }
  return (opts.now ?? Date.now()) - last >= opts.everyMinutes * 60_000;
}

export function scheduleSelectValue(enabled: boolean, minutes: number): string {
  return enabled ? String(minutes) : "off";
}

export function parseScheduleValue(
  raw: FormDataEntryValue | null,
  fallback: { enabled: boolean; minutes: number },
  min: number,
  max: number,
): { enabled: boolean; minutes: number } {
  const value = String(raw ?? "").trim();
  const fallbackMinutes = clampMinutes(fallback.minutes, min, max);
  if (!value) {
    return { enabled: fallback.enabled, minutes: fallbackMinutes };
  }
  if (value === "off") {
    return { enabled: false, minutes: fallbackMinutes };
  }
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) {
    return { enabled: fallback.enabled, minutes: fallbackMinutes };
  }
  return { enabled: true, minutes: clampMinutes(minutes, min, max) };
}

export function scheduleOptions(
  presets: readonly number[],
  currentMinutes: number,
): number[] {
  if (presets.includes(currentMinutes)) {
    return [...presets];
  }
  return [...presets, currentMinutes].sort((a, b) => a - b);
}

export function formatScheduleLabel(minutes: number): string {
  if (minutes === 1) {
    return "Every 1 minute";
  }
  if (minutes < 60) {
    return `Every ${minutes} minutes`;
  }
  if (minutes === 60) {
    return "Every hour";
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    if (hours === 24) {
      return "Every day";
    }
    return `Every ${hours} hours`;
  }
  return `Every ${minutes} minutes`;
}
