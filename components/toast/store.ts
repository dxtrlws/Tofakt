"use client";

import { useSyncExternalStore } from "react";
import {
  absorbMapped,
  BUSY_DELAY_MS,
  type BusyClock,
  beginBusy,
  endBusy,
  MAX_TOASTS,
} from "@/lib/toast/busy";
import {
  type ActionFlash,
  flashToToast,
  type ToastLevel,
} from "@/lib/toast/flash";

export type Toast = {
  id: string;
  level: ToastLevel;
  message: string;
};

export const toastDuration: Record<Exclude<ToastLevel, "busy">, number> = {
  ok: 4000,
  warn: 6000,
  error: 8000,
};

export { BUSY_DELAY_MS };

type ToastStore = {
  listeners: Set<() => void>;
  nextId: number;
  timers: Map<string, unknown>;
  toasts: Toast[];
};

const EMPTY: Toast[] = [];
const serverStore: ToastStore = {
  toasts: EMPTY,
  listeners: new Set(),
  nextId: 0,
  timers: new Map(),
};

const globalStore = globalThis as typeof globalThis & {
  __watchlogToasts?: ToastStore;
};

function store(): ToastStore {
  if (typeof window === "undefined") {
    return serverStore;
  }
  if (!globalStore.__watchlogToasts) {
    globalStore.__watchlogToasts = {
      toasts: [],
      listeners: new Set(),
      nextId: 0,
      timers: new Map(),
    };
  }
  return globalStore.__watchlogToasts;
}

function emit() {
  for (const listener of store().listeners) {
    listener();
  }
}

function clientClock(): BusyClock {
  if (typeof window === "undefined") {
    return {
      setTimeout: () => 0,
      clearTimeout: () => undefined,
    };
  }
  return {
    setTimeout: (fn, ms) =>
      window.setTimeout(() => {
        fn();
        emit();
      }, ms),
    clearTimeout: (id) => {
      window.clearTimeout(id as number);
    },
  };
}

export function showToast(input: {
  level: Exclude<ToastLevel, "busy">;
  message: string;
}): string {
  const current = store();
  current.nextId += 1;
  const toast: Toast = { id: String(current.nextId), ...input };
  current.toasts = [...current.toasts, toast].slice(-MAX_TOASTS);
  emit();
  return toast.id;
}

export function dismissToast(id: string) {
  const current = store();
  const next = current.toasts.filter((toast) => toast.id !== id);
  if (next.length === current.toasts.length) {
    return;
  }
  current.toasts = next;
  emit();
}

export function beginBusyToast(message: string): string {
  return beginBusy(store(), message, clientClock());
}

export function endBusyToast(
  id: string,
  flash: ActionFlash & { flow?: unknown },
  options?: { errors?: "toast" | "inline" },
) {
  endBusy(store(), id, flash, clientClock(), options);
  emit();
}

export function toastFromAction(flash: ActionFlash & { flow?: unknown }) {
  const mapped = flashToToast(flash);
  if (mapped) {
    showToast(mapped);
  }
}

let absorbedSeedKey: string | undefined;

export function absorbToastSeed(seed: {
  level: Exclude<ToastLevel, "busy">;
  message: string;
  nonce?: number;
}) {
  const key = `${seed.nonce ?? 0}:${seed.level}:${seed.message}`;
  if (absorbedSeedKey === key) {
    return;
  }
  absorbedSeedKey = key;
  absorbMapped(store(), seed, clientClock());
  emit();
}

function subscribe(listener: () => void) {
  store().listeners.add(listener);
  return () => {
    store().listeners.delete(listener);
  };
}

function getSnapshot() {
  return store().toasts;
}

function getServerSnapshot(): Toast[] {
  return EMPTY;
}

export function useToasts() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
