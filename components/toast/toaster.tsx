"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { statusDotClass } from "@/components/connections/status";
import type { ToastLevel } from "@/lib/toast/flash";
import {
  absorbToastSeed,
  dismissToast,
  type Toast,
  toastDuration,
  useToasts,
} from "./store";

function uniqueToasts(toasts: Toast[]): Toast[] {
  const seen = new Set<string>();
  const unique: Toast[] = [];
  for (const toast of toasts) {
    const key = `${toast.level}:${toast.message}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(toast);
  }
  return unique;
}

function statusForLevel(
  level: Exclude<ToastLevel, "busy">,
): "ok" | "warn" | "down" {
  if (level === "ok") {
    return "ok";
  }
  if (level === "warn") {
    return "warn";
  }
  return "down";
}

function labelForLevel(level: ToastLevel): string {
  if (level === "busy") {
    return "In progress";
  }
  if (level === "ok") {
    return "Success";
  }
  if (level === "warn") {
    return "Warning";
  }
  return "Failed";
}

export function Toaster({
  seed,
}: {
  seed?: {
    level: Exclude<ToastLevel, "busy">;
    message: string;
    nonce?: number;
  } | null;
}) {
  const live = useToasts();
  const [hydrated, setHydrated] = useState(false);
  useLayoutEffect(() => {
    if (seed) {
      absorbToastSeed(seed);
    }
    setHydrated(true);
  }, [seed]);
  const seeded: Toast[] = seed
    ? [
        {
          id: `seed-${seed.nonce ?? seed.message}`,
          level: seed.level,
          message: seed.message,
        },
      ]
    : [];
  const toasts = uniqueToasts(hydrated ? live : [...seeded, ...live]);
  if (toasts.length === 0) {
    return null;
  }
  return (
    <section
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 flex flex-col items-stretch gap-2 px-4 md:inset-x-auto md:right-6 md:top-6 md:w-[min(24rem,calc(100%-3rem))]"
      data-hydrated={hydrated ? "true" : undefined}
    >
      {toasts.map((toast) => (
        <ToastCard key={`${toast.id}-${toast.level}`} toast={toast} />
      ))}
    </section>
  );
}

function ToastCard({ toast }: { toast: Toast }) {
  const startedAt = useRef(0);
  const timer = useRef(0);
  const remainingMs = useRef(0);
  const busy = toast.level === "busy";

  useEffect(() => {
    const level = toast.level;
    if (level === "busy") {
      return;
    }
    remainingMs.current = toastDuration[level];
    const arm = () => {
      startedAt.current = Date.now();
      timer.current = window.setTimeout(() => {
        dismissToast(toast.id);
      }, remainingMs.current);
    };
    arm();
    return () => {
      window.clearTimeout(timer.current);
    };
  }, [toast.id, toast.level]);

  const pause = () => {
    if (busy) {
      return;
    }
    window.clearTimeout(timer.current);
    remainingMs.current = Math.max(
      0,
      remainingMs.current - (Date.now() - startedAt.current),
    );
  };

  const resume = () => {
    if (busy) {
      return;
    }
    startedAt.current = Date.now();
    timer.current = window.setTimeout(() => {
      dismissToast(toast.id);
    }, remainingMs.current);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover/focus pause the auto-dismiss timer
    <div
      aria-busy={busy || undefined}
      aria-live={toast.level === "error" ? "assertive" : "polite"}
      className="toast-enter pointer-events-auto flex items-start gap-2.5 rounded-md border border-border bg-bg-overlay px-3 py-2.5"
      onBlur={resume}
      onFocus={pause}
      onMouseEnter={pause}
      onMouseLeave={resume}
      role={toast.level === "error" ? "alert" : "status"}
    >
      <span
        className={`mt-1.5 size-2 shrink-0 rounded-full ${
          toast.level === "busy"
            ? "toast-busy-dot bg-accent"
            : statusDotClass(statusForLevel(toast.level))
        }`}
      />
      <p className="min-w-0 grow text-ui leading-ui text-fg">
        <span className="sr-only">{labelForLevel(toast.level)}. </span>
        {toast.message}
      </p>
      {busy ? null : (
        <button
          aria-label="Dismiss notification"
          className="shrink-0 rounded-sm px-1 text-ui leading-ui text-fg-muted hover:text-fg"
          onClick={() => dismissToast(toast.id)}
          type="button"
        >
          ×
        </button>
      )}
    </div>
  );
}
