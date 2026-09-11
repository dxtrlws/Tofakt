"use client";

import { useEffect, useRef } from "react";
import { statusDotClass } from "@/components/connections/status";
import type { ToastLevel } from "@/lib/toast/flash";
import { dismissToast, type Toast, toastDuration, useToasts } from "./store";

function statusForLevel(level: ToastLevel): "ok" | "warn" | "down" {
  if (level === "ok") {
    return "ok";
  }
  if (level === "warn") {
    return "warn";
  }
  return "down";
}

function labelForLevel(level: ToastLevel): string {
  if (level === "ok") {
    return "Success";
  }
  if (level === "warn") {
    return "Warning";
  }
  return "Failed";
}

export function Toaster() {
  const toasts = useToasts();
  if (toasts.length === 0) {
    return null;
  }
  return (
    <section
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 flex flex-col items-stretch gap-2 px-4 md:inset-x-auto md:right-6 md:top-6 md:w-[min(24rem,calc(100%-3rem))]"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </section>
  );
}

function ToastCard({ toast }: { toast: Toast }) {
  const remainingMs = useRef(toastDuration[toast.level]);
  const startedAt = useRef(0);
  const timer = useRef(0);

  useEffect(() => {
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
  }, [toast.id]);

  const pause = () => {
    window.clearTimeout(timer.current);
    remainingMs.current = Math.max(
      0,
      remainingMs.current - (Date.now() - startedAt.current),
    );
  };

  const resume = () => {
    startedAt.current = Date.now();
    timer.current = window.setTimeout(() => {
      dismissToast(toast.id);
    }, remainingMs.current);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover/focus pause the auto-dismiss timer
    <div
      aria-live={toast.level === "error" ? "assertive" : "polite"}
      className="toast-enter pointer-events-auto flex items-start gap-2.5 rounded-md border border-border bg-bg-overlay px-3 py-2.5"
      onBlur={resume}
      onFocus={pause}
      onMouseEnter={pause}
      onMouseLeave={resume}
      role={toast.level === "error" ? "alert" : "status"}
    >
      <span
        className={`mt-1.5 size-2 shrink-0 rounded-full ${statusDotClass(statusForLevel(toast.level))}`}
      />
      <p className="min-w-0 grow text-ui leading-ui text-fg">
        <span className="sr-only">{labelForLevel(toast.level)}. </span>
        {toast.message}
      </p>
      <button
        aria-label="Dismiss notification"
        className="shrink-0 rounded-sm px-1 text-ui leading-ui text-fg-muted hover:text-fg"
        onClick={() => dismissToast(toast.id)}
        type="button"
      >
        ×
      </button>
    </div>
  );
}
