"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ignoreWatchEvent, unignoreWatchEvent } from "@/lib/ingest/actions";
import {
  removeWatchEvent,
  retryWatchEvent,
  syncWatchEvent,
} from "@/lib/sync/actions";

const itemClass =
  "w-full rounded-sm px-3 py-2 text-left text-ui text-fg hover:bg-bg-overlay-strong";

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
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removeState, removeAction] = useActionState(
    removeWatchEvent,
    undefined,
  );
  const canSync = status !== "synced" && !ignored;
  const canRemove = status === "synced";

  useEffect(() => {
    if (!removeState?.info || removeState.error) {
      return;
    }
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
    setConfirmingRemove(false);
  }, [removeState]);

  function closeMenu() {
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
    setConfirmingRemove(false);
  }

  return (
    <details
      className="relative w-5 shrink-0"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          closeMenu();
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
      onToggle={(event) => {
        if (!event.currentTarget.open) {
          setConfirmingRemove(false);
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
      <div className="absolute right-0 z-10 mt-1 w-64 rounded-md border border-border bg-bg-overlay p-1">
        {confirmingRemove && canRemove ? (
          <form action={removeAction}>
            <input name="eventId" type="hidden" value={eventId} />
            <p className="px-3 py-2 text-meta leading-meta text-fg-muted">
              Remove this one play from Trakt? Other watches of the same title
              stay.
            </p>
            {removeState?.error ? (
              <p className="px-3 pb-1 text-meta text-sync-failed" role="alert">
                {removeState.error}
              </p>
            ) : null}
            <RemoveSubmit />
            <RemoveCancel onCancel={() => setConfirmingRemove(false)} />
          </form>
        ) : (
          <>
            {canSync ? (
              <form
                action={status === "failed" ? retryWatchEvent : syncWatchEvent}
              >
                <input name="eventId" type="hidden" value={eventId} />
                <button className={itemClass} type="submit">
                  {status === "failed" ? "Retry" : "Sync now"}
                </button>
              </form>
            ) : null}
            {canRemove ? (
              <button
                className={`${itemClass} text-sync-failed`}
                onClick={() => setConfirmingRemove(true)}
                type="button"
              >
                Remove from Trakt
              </button>
            ) : null}
            <form action={ignored ? unignoreWatchEvent : ignoreWatchEvent}>
              <input name="eventId" type="hidden" value={eventId} />
              <button className={itemClass} type="submit">
                {ignored ? "Unignore" : "Ignore"}
              </button>
            </form>
          </>
        )}
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

function RemoveCancel({ onCancel }: { onCancel: () => void }) {
  const { pending } = useFormStatus();
  return (
    <button
      className={`${itemClass} disabled:opacity-60`}
      disabled={pending}
      onClick={onCancel}
      type="button"
    >
      Cancel
    </button>
  );
}
