"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { primaryBtn } from "@/components/connections/setup";
import { HistoryDayHeader } from "@/components/history/columns";
import { HistoryRowView } from "@/components/history/row";
import { BusyLabel } from "@/components/toast/busy-label";
import { withToastForm } from "@/components/toast/use-toast-action";
import type { DayGroup } from "@/lib/history/display";
import { syncWatchEvent } from "@/lib/sync/actions";
import { shouldPostRecord } from "@/lib/sync/sendable";

const syncSelected = withToastForm(syncWatchEvent, {
  busy: "Syncing selected plays…",
});

export function HistoryLedger({
  groups,
  timeZone,
}: {
  groups: DayGroup[];
  timeZone: string;
}) {
  const selectableIds = useMemo(
    () =>
      groups.flatMap((group) =>
        group.rows
          .filter((row) =>
            shouldPostRecord({
              status: row.syncStatus,
              skipReason: row.skipReason,
            }),
          )
          .map((row) => row.eventId),
      ),
    [groups],
  );
  const selectableKey = selectableIds.join("\0");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const allowed = new Set(selectableKey ? selectableKey.split("\0") : []);
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => allowed.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [selectableKey]);

  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const someSelected = selectableIds.some((id) => selected.has(id));

  function toggle(eventId: string) {
    if (!selectableIds.includes(eventId)) {
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectableIds));
  }

  return (
    <div>
      {selectableIds.length > 0 ? (
        <BulkBar
          allSelected={allSelected}
          count={selected.size}
          eventIds={[...selected]}
          onToggleAll={toggleAll}
          someSelected={someSelected}
          total={selectableIds.length}
        />
      ) : null}
      {groups.map((group) => (
        <section
          className="flex flex-col gap-1 px-4 pt-7 pb-2 last:pb-8 md:px-8"
          key={group.key}
        >
          <HistoryDayHeader label={group.label} />
          {group.rows.map((row) => {
            const selectable = shouldPostRecord({
              status: row.syncStatus,
              skipReason: row.skipReason,
            });
            return (
              <HistoryRowView
                key={row.eventId}
                onToggle={toggle}
                row={row}
                selectable={selectable}
                selected={selected.has(row.eventId)}
                timeZone={timeZone}
              />
            );
          })}
        </section>
      ))}
    </div>
  );
}

function BulkBar({
  allSelected,
  count,
  eventIds,
  onToggleAll,
  someSelected,
  total,
}: {
  allSelected: boolean;
  count: number;
  eventIds: string[];
  onToggleAll: () => void;
  someSelected: boolean;
  total: number;
}) {
  const selectAllId = useId();

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-bg-base/95 px-4 py-2.5 md:px-8">
      <label
        className="flex cursor-pointer items-center gap-2 text-ui font-medium text-fg"
        htmlFor={selectAllId}
      >
        <input
          checked={allSelected}
          className="size-4 accent-accent"
          id={selectAllId}
          onChange={onToggleAll}
          ref={(node) => {
            if (node) {
              node.indeterminate = someSelected && !allSelected;
            }
          }}
          type="checkbox"
        />
        Select all
      </label>
      <p aria-live="polite" className="text-meta leading-meta text-fg-muted">
        {count === 0
          ? `${total} ${total === 1 ? "play" : "plays"} can be synced`
          : `${count} selected`}
      </p>
      {count > 0 ? (
        <form action={syncSelected} className="ml-auto">
          {eventIds.map((id) => (
            <input key={id} name="eventId" type="hidden" value={id} />
          ))}
          <BulkSubmit count={count} />
        </form>
      ) : null}
    </div>
  );
}

function BulkSubmit({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      aria-busy={pending || undefined}
      className={primaryBtn}
      disabled={pending}
      type="submit"
    >
      <BusyLabel
        busy={count === 1 ? "Syncing 1 play…" : `Syncing ${count} plays…`}
        idle="Sync to Trakt"
        pending={pending}
      />
    </button>
  );
}
