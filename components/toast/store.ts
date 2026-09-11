"use client";

import { useSyncExternalStore } from "react";
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

export const toastDuration: Record<ToastLevel, number> = {
  ok: 4000,
  warn: 6000,
  error: 8000,
};

const MAX_TOASTS = 3;

type ToastStore = {
  toasts: Toast[];
  listeners: Set<() => void>;
  nextId: number;
};

const EMPTY: Toast[] = [];
const serverStore: ToastStore = {
  toasts: EMPTY,
  listeners: new Set(),
  nextId: 0,
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
    };
  }
  return globalStore.__watchlogToasts;
}

function emit() {
  for (const listener of store().listeners) {
    listener();
  }
}

export function showToast(input: {
  level: ToastLevel;
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

export function toastFromAction(flash: ActionFlash & { flow?: unknown }) {
  const mapped = flashToToast(flash);
  if (mapped) {
    showToast(mapped);
  }
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
