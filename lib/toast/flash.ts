export type ToastLevel = "ok" | "warn" | "error" | "busy";

export type ActionFlash = {
  error?: string;
  info?: string;
  level?: "ok" | "warn";
};

export type ToastInput = {
  level: Exclude<ToastLevel, "busy">;
  message: string;
};

const DEVICE_FLOW_PENDING = new Set([
  "Waiting for approval…",
  "Approve Watchlog in tofa, then wait here.",
  "Enter this code on Trakt, then wait here.",
]);

export function flashToToast(
  flash: ActionFlash & { flow?: unknown },
): ToastInput | null {
  const error = flash.error?.trim();
  if (error) {
    return { level: "error", message: error };
  }
  if (flash.flow) {
    return null;
  }
  const message = flash.info?.trim();
  if (!message || DEVICE_FLOW_PENDING.has(message)) {
    return null;
  }
  if (flash.level === "warn") {
    return { level: "warn", message };
  }
  return { level: "ok", message };
}
