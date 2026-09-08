"use client";

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
  const canSync = status !== "synced" && !ignored;
  const canRemove = status === "synced";
  return (
    <details
      className="relative w-5 shrink-0"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary
        aria-label="Play actions"
        className="cursor-pointer list-none text-center font-headline text-title-sm leading-ui text-fg-muted [&::-webkit-details-marker]:hidden"
      >
        ···
      </summary>
      <div className="absolute right-0 z-10 mt-1 w-52 rounded-md border border-border bg-bg-overlay p-1">
        {canSync ? (
          <form action={status === "failed" ? retryWatchEvent : syncWatchEvent}>
            <input name="eventId" type="hidden" value={eventId} />
            <button className={itemClass} type="submit">
              {status === "failed" ? "Retry" : "Sync now"}
            </button>
          </form>
        ) : null}
        {canRemove ? (
          <form
            action={removeWatchEvent}
            onSubmit={(event) => {
              if (
                !window.confirm(
                  "Remove this one play from Trakt? Other watches of the same title stay.",
                )
              ) {
                event.preventDefault();
              }
            }}
          >
            <input name="eventId" type="hidden" value={eventId} />
            <button className={`${itemClass} text-sync-failed`} type="submit">
              Remove from Trakt
            </button>
          </form>
        ) : null}
        <form action={ignored ? unignoreWatchEvent : ignoreWatchEvent}>
          <input name="eventId" type="hidden" value={eventId} />
          <button className={itemClass} type="submit">
            {ignored ? "Unignore" : "Ignore"}
          </button>
        </form>
      </div>
    </details>
  );
}
