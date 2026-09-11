"use client";

import { useEffect, useId, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  useToastAction,
  withToastForm,
} from "@/components/toast/use-toast-action";
import { ignoreWatchEvent, unignoreWatchEvent } from "@/lib/ingest/actions";
import {
  removeWatchEvent,
  retryWatchEvent,
  syncWatchEvent,
} from "@/lib/sync/actions";

const itemClass =
  "w-full rounded-sm px-3 py-2 text-left text-ui text-fg hover:bg-bg-overlay-strong";

const syncNow = withToastForm(syncWatchEvent);
const retryNow = withToastForm(retryWatchEvent);
const ignoreNow = withToastForm(ignoreWatchEvent);
const unignoreNow = withToastForm(unignoreWatchEvent);

export function RowMenu({
  eventId,
  ignored,
  status,
}: {
  eventId: string;
  ignored: boolean;
  status: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const confirmId = useId();
  const [removeState, removeAction] = useToastAction(removeWatchEvent);
  const canSync = status !== "synced" && !ignored;
  const canRemove = status === "synced";

  useEffect(() => {
    if (!removeState?.info || removeState.error) {
      return;
    }
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  }, [removeState]);

  return (
    <details
      className="relative w-5 shrink-0"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
      onToggle={(event) => {
        if (event.currentTarget.open) {
          return;
        }
        const box = event.currentTarget.querySelector('input[type="checkbox"]');
        if (box instanceof HTMLInputElement) {
          box.checked = false;
        }
      }}
      ref={detailsRef}
    >
      <summary
        aria-label="Play actions"
        className="cursor-pointer list-none text-center font-headline text-title-sm leading-ui text-fg-muted [&::-webkit-details-marker]:hidden"
      >
        ···
      </summary>
      <div className="absolute right-0 z-50 mt-1 w-64 rounded-md border border-border bg-bg-overlay p-1">
        {canRemove ? (
          <input className="peer sr-only" id={confirmId} type="checkbox" />
        ) : null}
        <div className={canRemove ? "peer-checked:hidden" : undefined}>
          {canSync ? (
            <form action={status === "failed" ? retryNow : syncNow}>
              <input name="eventId" type="hidden" value={eventId} />
              <button className={itemClass} type="submit">
                {status === "failed" ? "Retry" : "Sync now"}
              </button>
            </form>
          ) : null}
          {canRemove ? (
            <label
              className={`${itemClass} block cursor-pointer text-sync-failed`}
              htmlFor={confirmId}
            >
              Remove from Trakt
            </label>
          ) : null}
          <form action={ignored ? unignoreNow : ignoreNow}>
            <input name="eventId" type="hidden" value={eventId} />
            <button className={itemClass} type="submit">
              {ignored ? "Unignore" : "Ignore"}
            </button>
          </form>
        </div>
        {canRemove ? (
          <form action={removeAction} className="hidden peer-checked:block">
            <input name="eventId" type="hidden" value={eventId} />
            <p className="px-3 py-2 text-meta leading-meta text-fg-muted">
              Remove this one play from Trakt? Other watches of the same title
              stay.
            </p>
            <RemoveSubmit />
            <label
              className={`${itemClass} block cursor-pointer`}
              htmlFor={confirmId}
            >
              Cancel
            </label>
          </form>
        ) : null}
      </div>
    </details>
  );
}

function RemoveSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      className={`${itemClass} text-sync-failed disabled:opacity-60`}
      disabled={pending}
      type="submit"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
