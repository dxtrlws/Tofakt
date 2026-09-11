import { type ActionFlash, flashToToast, type ToastLevel } from "./flash";

export const BUSY_DELAY_MS = 300;
export const MAX_TOASTS = 3;

export type ToastRecord = {
  id: string;
  level: ToastLevel;
  message: string;
};

export type BusyClock = {
  clearTimeout: (id: unknown) => void;
  setTimeout: (fn: () => void, ms: number) => unknown;
};

export type BusyRegistry = {
  nextId: number;
  timers: Map<string, unknown>;
  toasts: ToastRecord[];
};

export function beginBusy(
  registry: BusyRegistry,
  message: string,
  clock: BusyClock,
  delayMs = BUSY_DELAY_MS,
): string {
  registry.nextId += 1;
  const id = String(registry.nextId);
  const timer = clock.setTimeout(() => {
    registry.timers.delete(id);
    if (registry.toasts.some((toast) => toast.id === id)) {
      return;
    }
    const toast: ToastRecord = { id, level: "busy", message };
    registry.toasts = [...registry.toasts, toast].slice(-MAX_TOASTS);
  }, delayMs);
  registry.timers.set(id, timer);
  return id;
}

export function endBusy(
  registry: BusyRegistry,
  id: string,
  flash: ActionFlash & { flow?: unknown },
  clock: BusyClock,
  options?: { errors?: "toast" | "inline" },
): void {
  const timer = registry.timers.get(id);
  if (timer !== undefined) {
    clock.clearTimeout(timer);
    registry.timers.delete(id);
  }
  const mapped =
    options?.errors === "inline" && flash.error ? null : flashToToast(flash);
  const next = mapped ? { id, ...mapped } : null;
  const exists = registry.toasts.some((toast) => toast.id === id);
  if (exists) {
    registry.toasts = next
      ? registry.toasts.map((toast) => (toast.id === id ? next : toast))
      : registry.toasts.filter((toast) => toast.id !== id);
    return;
  }
  if (next) {
    registry.toasts = [...registry.toasts, next].slice(-MAX_TOASTS);
  }
}

export function absorbMapped(
  registry: BusyRegistry,
  mapped: { level: Exclude<ToastLevel, "busy">; message: string },
  clock: BusyClock,
): void {
  for (const timer of registry.timers.values()) {
    clock.clearTimeout(timer);
  }
  registry.timers.clear();
  if (
    registry.toasts.some(
      (toast) =>
        toast.level !== "busy" &&
        toast.level === mapped.level &&
        toast.message === mapped.message,
    )
  ) {
    registry.toasts = registry.toasts.filter((toast) => toast.level !== "busy");
    return;
  }
  const busy = registry.toasts.find((toast) => toast.level === "busy");
  if (busy) {
    registry.toasts = registry.toasts.map((toast) =>
      toast.id === busy.id ? { id: busy.id, ...mapped } : toast,
    );
    return;
  }
  registry.nextId += 1;
  registry.toasts = [
    ...registry.toasts,
    { id: String(registry.nextId), ...mapped },
  ].slice(-MAX_TOASTS);
}
