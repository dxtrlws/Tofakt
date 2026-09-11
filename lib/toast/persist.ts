import { cache } from "react";
import {
  deleteSetting,
  getSettingJson,
  setSettingJson,
} from "../data/settings";
import { type ActionFlash, flashToToast, type ToastInput } from "./flash";

const KEY = "ui.toast";

export type ToastSeedPayload = ToastInput & { nonce?: number };

export function persistToast(flash: ActionFlash & { flow?: unknown }): void {
  const mapped = flashToToast(flash);
  if (!mapped) {
    return;
  }
  setSettingJson(KEY, { ...mapped, nonce: Date.now() });
}

export function takeToastSeed(): ToastSeedPayload | null {
  const parsed = getSettingJson<ToastSeedPayload>(KEY);
  if (
    !parsed?.message ||
    (parsed.level !== "ok" &&
      parsed.level !== "warn" &&
      parsed.level !== "error")
  ) {
    return null;
  }
  deleteSetting(KEY);
  if (parsed.nonce && Date.now() - parsed.nonce > 10_000) {
    return null;
  }
  return parsed;
}

export const takeToastCookie = cache(takeToastSeed);

/** Persist first, then optional revalidation so the next RSC read can seed the toast. */
export function reply<T extends ActionFlash>(flash: T, after?: () => void): T {
  persistToast(flash);
  after?.();
  return flash;
}
