"use client";

import {
  HISTORY_BADGE_COL,
  HISTORY_CHECK_COL,
  HISTORY_DURATION_COL,
  HISTORY_TIME_COL,
} from "@/components/history/columns";
import { RowMenu } from "@/components/history/row-menu";
import { SyncBadge } from "@/components/history/sync-badge";
import {
  displayTitle,
  formatDuration,
  formatTime,
  type HistoryRow,
  rowSubtitle,
} from "@/lib/history/display";

export function HistoryRowView({
  onToggle,
  row,
  selectable,
  selected,
  timeZone,
}: {
  onToggle: (eventId: string) => void;
  row: HistoryRow;
  selectable: boolean;
  selected: boolean;
  timeZone: string;
}) {
  const subtitle = rowSubtitle(row);
  const poster = row.artworkUrl ? `${row.artworkUrl}?w=80&h=112` : null;
  const title = displayTitle(row);
  const watchedAt =
    row.watchedAt instanceof Date ? row.watchedAt : new Date(row.watchedAt);
  return (
    <article
      className={`flex w-full items-center gap-4 rounded-md border px-3 py-2.5 ${
        selected
          ? "border-border-strong bg-bg-overlay"
          : "border-border bg-bg-raised"
      }`}
    >
      <div className={HISTORY_CHECK_COL}>
        <label className="flex size-9 cursor-pointer items-center justify-center">
          <input
            aria-label={`Select ${title}`}
            checked={selected}
            className="size-4 accent-accent disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!selectable}
            onChange={() => onToggle(row.eventId)}
            type="checkbox"
          />
        </label>
      </div>
      {poster ? (
        // biome-ignore lint/performance/noImgElement: local artwork proxy, not a remote CMS image
        <img
          alt=""
          className="h-14 w-10 shrink-0 rounded-sm object-cover bg-accent-dim"
          height={56}
          src={poster}
          width={40}
        />
      ) : (
        <div className="h-14 w-10 shrink-0 rounded-sm bg-accent-dim" />
      )}
      <div className="flex min-w-0 grow basis-0 flex-col gap-0.5">
        <h3 className="truncate text-body font-semibold leading-[18px] text-fg">
          {title}
        </h3>
        <p
          className={`truncate text-meta leading-meta ${
            subtitle.tone === "failed"
              ? "text-sync-failed"
              : subtitle.tone === "unmatched"
                ? "text-sync-unmatched"
                : "text-fg-muted"
          }`}
        >
          {subtitle.text}
        </p>
      </div>
      <p
        className={`${HISTORY_TIME_COL} text-ui tabular-nums leading-[18px] text-fg-muted`}
        title="Time the play finished"
      >
        {formatTime(watchedAt, timeZone)}
      </p>
      <p
        className={`${HISTORY_DURATION_COL} text-ui tabular-nums leading-[18px] text-fg-muted`}
        title="How long this play ran"
      >
        {formatDuration(row.durationWatchedSeconds)}
      </p>
      <div className={`flex ${HISTORY_BADGE_COL} items-center`}>
        <SyncBadge skipReason={row.skipReason} status={row.syncStatus} />
      </div>
      <RowMenu
        eventId={row.eventId}
        ignored={row.skipReason === "user_ignored"}
        status={row.syncStatus}
      />
    </article>
  );
}
