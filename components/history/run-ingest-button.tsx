"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { runIngestNow } from "@/lib/ingest/actions";

export function RunIngestButton() {
  const [state, action] = useActionState(runIngestNow, undefined);
  return (
    <form action={action} className="flex items-center gap-3">
      {state?.error ? (
        <p className="text-meta text-sync-failed" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.info ? (
        <p className="text-meta text-fg-muted">{state.info}</p>
      ) : null}
      <IngestHint />
      <Submit />
    </form>
  );
}

const INGEST_HINT =
  "Pulls new plays from tofa into this ledger. Already stored plays are skipped. Does not send anything to Trakt.";

function IngestHint() {
  return (
    <span className="group relative flex">
      <button
        aria-describedby="run-ingest-hint"
        aria-label="What does Run ingest do?"
        className="flex size-9 cursor-help items-center justify-center rounded-md text-fg-muted hover:bg-bg-overlay hover:text-fg"
        type="button"
      >
        <span aria-hidden="true" className="size-4">
          {/* biome-ignore lint/a11y/noSvgWithoutTitle: button has an accessible name */}
          <svg fill="none" viewBox="0 0 16 16">
            <circle
              cx="8"
              cy="8"
              r="6.25"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M8 7.25V11"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.5"
            />
            <circle cx="8" cy="5.15" fill="currentColor" r="0.85" />
          </svg>
        </span>
      </button>
      <span
        className="pointer-events-none invisible absolute top-full right-0 z-20 mt-1.5 w-64 rounded-md border border-border bg-bg-overlay px-3 py-2 text-left text-meta leading-meta text-fg opacity-0 transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
        id="run-ingest-hint"
        role="tooltip"
      >
        {INGEST_HINT}
      </span>
    </span>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      aria-describedby="run-ingest-hint"
      className="rounded-md border border-border bg-bg-overlay px-3.5 py-2 text-ui font-medium leading-[18px] text-fg"
      disabled={pending}
      type="submit"
    >
      {pending ? "Ingesting…" : "Run ingest"}
    </button>
  );
}
