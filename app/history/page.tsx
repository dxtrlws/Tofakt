import { HistoryDayHeader } from "@/components/history/columns";
import { HistoryFilters } from "@/components/history/filters";
import { HistoryRowView } from "@/components/history/row";
import { RunIngestButton } from "@/components/history/run-ingest-button";
import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/require";
import {
  groupByDay,
  historyCount,
  listHistory,
  parseHistoryQuery,
} from "@/lib/history/query";
import { lastIngestStats, timezone } from "@/lib/ingest/run";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  searchParams,
}: PageProps<"/history">) {
  const user = await requireUser();
  const params = await searchParams;
  const query = parseHistoryQuery({
    get: (name) => {
      const value = params[name];
      return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
    },
  });
  const total = historyCount();
  const groups = groupByDay(listHistory(query));
  const stats = lastIngestStats();
  const tz = timezone();

  return (
    <AppShell current="history" username={user.username}>
      <main className="flex flex-1 flex-col" id="main-content" tabIndex={-1}>
        <div className="flex w-full items-end justify-between px-4 pt-6 md:px-8">
          <div className="flex flex-col gap-2">
            <p className="text-label font-semibold uppercase leading-label tracking-label text-accent">
              Ledger
            </p>
            <h1 className="font-headline text-title font-bold leading-title tracking-title">
              History
            </h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className="text-ui leading-[18px] text-fg-muted">
              {total} {total === 1 ? "play" : "plays"}
            </p>
            <RunIngestButton />
            {stats?.error ? (
              <p className="text-meta text-sync-failed">{stats.error}</p>
            ) : null}
          </div>
        </div>
        <HistoryFilters kind={query.kind} q={query.q} state={query.state} />
        {groups.length === 0 ? (
          <div className="px-4 py-16 md:px-8">
            <p className="text-ui text-fg-muted">
              {total === 0
                ? "No watched plays yet. Run ingest to pull history from tofa."
                : "No plays match these filters."}
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <section
              className="flex flex-col gap-1 px-4 pt-7 pb-2 last:pb-8 md:px-8"
              key={group.key}
            >
              <HistoryDayHeader label={group.label} />
              {group.rows.map((row) => (
                <HistoryRowView key={row.eventId} row={row} timeZone={tz} />
              ))}
            </section>
          ))
        )}
      </main>
    </AppShell>
  );
}
