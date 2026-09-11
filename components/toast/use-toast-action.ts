"use client";

import { useActionState, useRef } from "react";
import type { ActionFlash } from "@/lib/toast/flash";
import { beginBusyToast, endBusyToast } from "./store";

type ActionFn<S extends ActionFlash> = (
  prev: S | undefined,
  form: FormData,
) => Promise<S>;

export async function runWithBusyToast<T extends ActionFlash>(
  message: string,
  work: () => Promise<T>,
  options?: { errors?: "toast" | "inline" },
): Promise<T> {
  const id = beginBusyToast(message);
  try {
    const result = await work();
    endBusyToast(id, result, options);
    return result;
  } catch (error) {
    endBusyToast(id, {
      error: error instanceof Error ? error.message : "Something went wrong.",
    });
    throw error;
  }
}

/**
 * Busy → result toasts are tied to the async action promise, not a useEffect on
 * the form component, so navigating away mid-job still completes the toast.
 */
export function useToastAction<S extends ActionFlash>(
  action: ActionFn<S>,
  options?: { busy?: string; errors?: "toast" | "inline" },
) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const actionRef = useRef(action);
  actionRef.current = action;

  const bound = useRef<ActionFn<S> | null>(null);
  if (!bound.current) {
    bound.current = (prev, form) => {
      const opts = optionsRef.current;
      return runWithBusyToast(
        opts?.busy ?? "Working…",
        () => actionRef.current(prev, form),
        { errors: opts?.errors },
      );
    };
  }

  const [state, dispatch, pending] = useActionState(bound.current, undefined);
  return [state, dispatch, pending] as const;
}

export function withToastForm<S extends ActionFlash>(
  action: (form: FormData) => Promise<S>,
  options?: { busy?: string },
) {
  return async (form: FormData) => {
    await runWithBusyToast(options?.busy ?? "Working…", () => action(form));
  };
}
