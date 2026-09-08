import {
  HISTORY_BADGE_COL,
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
} from "@/lib/history/query";

export function HistoryRowView({
  row,
  timeZone,
}: {
  row: HistoryRow;
  timeZone: string;
}) {
  const subtitle = rowSubtitle(row);
  const poster = row.artworkUrl ? `${row.artworkUrl}?w=80&h=112` : null;
  return (
    <article className="flex w-full items-center gap-4 rounded-md border border-border bg-bg-raised px-3 py-2.5">
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
          {displayTitle(row)}
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
        {formatTime(row.watchedAt, timeZone)}
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
