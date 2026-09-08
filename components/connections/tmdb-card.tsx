"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { saveTmdb, testTmdbConnection } from "@/lib/connections/actions";
import type { PublicConnection } from "@/lib/connections/types";
import { statusClass, statusDotClass } from "./status";

const fieldClass =
  "w-full rounded-md border border-border bg-bg-overlay px-3.5 py-2 text-ui text-fg outline-none";

export function TmdbCard({ connection }: { connection: PublicConnection }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveTmdb, undefined);
  const statusText =
    connection.status === "ok"
      ? "Connected"
      : connection.hasSecret
        ? "Key saved"
        : "Key missing";

  return (
    <section className="flex w-full flex-col gap-3 rounded-lg border border-border bg-bg-raised p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className={`size-2 shrink-0 rounded-full ${statusDotClass(connection.status)}`}
          />
          <h2 className="text-body font-semibold leading-[18px]">TMDB</h2>
        </div>
        <p
          className={`text-meta leading-meta ${statusClass(connection.status)}`}
        >
          {statusText}
        </p>
      </div>
      <p className="text-ui leading-[18px] text-fg-muted">
        {connection.status === "ok"
          ? `Key saved. Provider snapshots will use region ${connection.region ?? "US"}.`
          : "Without a key, provider snapshots and some artwork enrichment are skipped. Region defaults to locale."}
      </p>
      {connection.lastError && connection.status !== "ok" ? (
        <p className="text-ui text-sync-failed" role="alert">
          {connection.lastError}
        </p>
      ) : null}
      <form
        action={action}
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <input
          aria-label="TMDB API key"
          autoComplete="off"
          className={fieldClass}
          name="apiKey"
          placeholder={connection.hasSecret ? "••••••••" : "API key"}
          type="password"
        />
        <input
          aria-label="TMDB region"
          className="w-24 rounded-md border border-border bg-bg-overlay px-3.5 py-2 text-ui text-fg outline-none"
          defaultValue={connection.region ?? "US"}
          maxLength={2}
          name="region"
          placeholder="US"
        />
        <button
          className="rounded-md bg-accent px-3.5 py-2 text-ui font-medium leading-[18px] text-fg-on-accent"
          disabled={pending}
          type="submit"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          className="rounded-md border border-border bg-bg-overlay px-3.5 py-2 text-ui font-medium leading-[18px] text-fg"
          disabled={pending}
          onClick={() => {
            void testTmdbConnection().then(() => router.refresh());
          }}
          type="button"
        >
          Test
        </button>
      </form>
      {state?.error ? (
        <p className="text-ui text-sync-failed">{state.error}</p>
      ) : null}
      {state?.info ? <p className="text-ui text-accent">{state.info}</p> : null}
    </section>
  );
}
