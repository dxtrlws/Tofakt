"use client";

import { useActionState } from "react";

type AuthState = { error?: string } | undefined;

type Props = {
  mode: "setup" | "login";
  action: (state: AuthState, formData: FormData) => Promise<{ error?: string }>;
};

export function AuthForm({ mode, action }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const isSetup = mode === "setup";

  return (
    <form action={formAction} className="flex w-full flex-col gap-5">
      {state?.error ? (
        <p className="text-ui leading-ui text-sync-failed" role="alert">
          {state.error}
        </p>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-meta leading-meta text-fg-muted">Username</span>
        <input
          autoComplete="username"
          className="rounded-md border border-border bg-bg-overlay px-3.5 py-2.5 text-ui text-fg outline-none"
          name="username"
          required
          type="text"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-meta leading-meta text-fg-muted">Password</span>
        <input
          autoComplete={isSetup ? "new-password" : "current-password"}
          className="rounded-md border border-border bg-bg-overlay px-3.5 py-2.5 text-ui text-fg outline-none"
          minLength={8}
          name="password"
          required
          type="password"
        />
      </label>

      {isSetup ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-meta leading-meta text-fg-muted">
            Confirm password
          </span>
          <input
            autoComplete="new-password"
            className="rounded-md border border-border bg-bg-overlay px-3.5 py-2.5 text-ui text-fg outline-none"
            minLength={8}
            name="confirmPassword"
            required
            type="password"
          />
        </label>
      ) : null}

      <button
        className="rounded-md bg-accent px-4 py-3 text-ui font-semibold text-fg-on-accent disabled:cursor-not-allowed disabled:opacity-40"
        disabled={pending}
        type="submit"
      >
        {pending ? "Working…" : isSetup ? "Create admin" : "Sign in"}
      </button>
    </form>
  );
}
