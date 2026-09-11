"use client";

import { useActionState, useRef } from "react";
import type { ActionFlash } from "@/lib/toast/flash";
import { toastFromAction } from "./store";

type ActionFn<S extends ActionFlash> = (
  prev: S | undefined,
  form: FormData,
) => Promise<S>;

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
  options?: { errors?: "toast" | "inline" },
) {
  const actionRef = useRef(action);
  actionRef.current = action;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const wrapped = useRef(async (prev: S | undefined, form: FormData) => {
    const result = await actionRef.current(prev, form);
    maybeToast(result, optionsRef.current?.errors);
    return result;
  }).current;
  return useActionState(wrapped, undefined);
}

export function withToastForm<S extends ActionFlash>(
  action: (form: FormData) => Promise<S>,
) {
  return async (form: FormData) => {
    const result = await action(form);
    toastFromAction(result);
  };
}
