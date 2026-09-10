import { getSettingJson, setSettingJson } from "../data/settings";
import {
  clampMinutes,
  RECONCILE_INTERVAL_MAX,
  RECONCILE_INTERVAL_MIN,
} from "./schedule";

export type SyncMode = "manual" | "forward" | "backfill";
export type TimestampConvention = "completion" | "start";

export type SyncSettings = {
  mode: SyncMode;
  cutoffIso: string | null;
  backfillConfirmedAt: string | null;
  windowMinutes: number;
  timestampConvention: TimestampConvention;
  excludedLibraryIds: string[];
  reconcileEnabled: boolean;
  reconcileEveryMinutes: number;
};

const DEFAULTS: SyncSettings = {
  mode: "manual",
  cutoffIso: null,
  backfillConfirmedAt: null,
  windowMinutes: 30,
  timestampConvention: "completion",
  excludedLibraryIds: [],
  reconcileEnabled: false,
  reconcileEveryMinutes: 60,
};

export function getSyncSettings(): SyncSettings {
  const stored = getSettingJson<Partial<SyncSettings>>("sync.settings") ?? {};
  const windowMinutes = clampMinutes(
    stored.windowMinutes ?? DEFAULTS.windowMinutes,
    1,
    180,
  );
  const reconcileEveryMinutes = clampMinutes(
    stored.reconcileEveryMinutes ?? DEFAULTS.reconcileEveryMinutes,
    RECONCILE_INTERVAL_MIN,
    RECONCILE_INTERVAL_MAX,
  );
  const mode =
    stored.mode === "forward" ||
    stored.mode === "backfill" ||
    stored.mode === "manual"
      ? stored.mode
      : DEFAULTS.mode;
  const timestampConvention =
    stored.timestampConvention === "start" ? "start" : "completion";
  return {
    mode,
    cutoffIso: stored.cutoffIso ?? null,
    backfillConfirmedAt: stored.backfillConfirmedAt ?? null,
    windowMinutes,
    timestampConvention,
    excludedLibraryIds: Array.isArray(stored.excludedLibraryIds)
      ? stored.excludedLibraryIds.filter((id) => typeof id === "string")
      : [],
    reconcileEnabled: stored.reconcileEnabled === true,
    reconcileEveryMinutes,
  };
}

export function saveSyncSettings(patch: Partial<SyncSettings>): SyncSettings {
  const next = { ...getSyncSettings(), ...patch };
  setSettingJson("sync.settings", next);
  return next;
}

export type CircuitState = {
  failures: number;
  pausedUntil: number | null;
};

export function getCircuit(): CircuitState {
  return (
    getSettingJson<CircuitState>("sync.circuit") ?? {
      failures: 0,
      pausedUntil: null,
    }
  );
}

export function saveCircuit(state: CircuitState): void {
  setSettingJson("sync.circuit", state);
}
