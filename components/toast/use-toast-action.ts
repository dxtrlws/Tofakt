"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionFlash } from "@/lib/toast/flash";
import { beginBusyToast, endBusyToast, toastFromAction } from "./store";

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

function maybeToast(
  flash: ActionFlash,
  errors: "toast" | "inline" | undefined,
) {
  if (errors === "inline" && flash.error) {
    return;
  }
  toastFromAction(flash);
}

export function useToastAction<S extends ActionFlash>(
  action: ActionFn<S>,
  options?: { busy?: string; errors?: "toast" | "inline" },
) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [state, dispatch, pending] = useActionState(action, undefined);
  const seen = useRef<S | undefined>(undefined);
  const busyId = useRef<string | null>(null);

  useEffect(() => {
    if (!pending) {
      return;
    }
    if (!busyId.current) {
      busyId.current = beginBusyToast(optionsRef.current?.busy ?? "Working…");
    }
  }, [pending]);

  useEffect(() => {
    if (!state || state === seen.current) {
      return;
    }
    seen.current = state;
    const errors = optionsRef.current?.errors;
    if (busyId.current) {
      endBusyToast(busyId.current, state, { errors });
      busyId.current = null;
      return;
    }
    maybeToast(state, errors);
  }, [state]);

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
