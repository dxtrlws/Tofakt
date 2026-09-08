import Link from "next/link";
import type { HomeConnection } from "@/lib/home/query";

export function StatusStrip({
  connections,
  pending,
  attentionCount,
}: {
  connections: HomeConnection[];
  pending: number;
  attentionCount: number;
}) {
  return (
    <div className="flex w-full shrink-0 flex-wrap gap-2 px-4 pt-3 md:gap-3 md:px-6 md:pt-5">
      {connections.map((conn) => (
        <Link
          className="hidden min-w-[10rem] grow basis-0 items-center gap-2.5 rounded-lg border border-border bg-bg-raised px-4 py-[14px] md:flex"
          href="/settings/connections"
          key={conn.provider}
        >
          <span
            className={`size-2 shrink-0 rounded-full ${dotClass(conn.status)}`}
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-label font-semibold uppercase leading-label tracking-label text-fg-muted">
              {conn.label}
            </span>
            <span className="text-ui font-medium leading-[18px] text-fg">
              {conn.detail}
            </span>
          </span>
        </Link>
      ))}
      <Link
        className="flex min-w-0 grow basis-0 flex-col gap-0.5 rounded-md border border-border bg-bg-raised p-2.5 md:min-w-[10rem] md:rounded-lg md:px-4 md:py-[14px]"
        href="/history"
      >
        <span className="text-label font-semibold uppercase leading-label tracking-label text-fg-muted">
          Pending
        </span>
        <span className="font-headline text-title-sm font-semibold leading-title-sm text-fg">
          {pending}
        </span>
      </Link>
      <Link
        className={`flex min-w-0 grow basis-0 flex-col gap-0.5 rounded-md border bg-bg-raised p-2.5 md:min-w-[10rem] md:rounded-lg md:px-4 md:py-[14px] ${
          attentionCount > 0 ? "border-sync-failed/45" : "border-border"
        }`}
        href={
          attentionCount > 0
            ? "/history?state=failed"
            : "/history?state=unmatched"
        }
      >
        <span
          className={`text-label font-semibold uppercase leading-label tracking-label ${
            attentionCount > 0 ? "text-sync-failed" : "text-fg-muted"
          }`}
        >
          <span className="md:hidden">Attention</span>
          <span className="hidden md:inline">Needs attention</span>
        </span>
        <span
          className={`font-headline text-title-sm font-semibold leading-title-sm ${
            attentionCount > 0 ? "text-sync-failed md:text-fg" : "text-fg"
          }`}
        >
          {attentionCount}
        </span>
      </Link>
    </div>
  );
}

function dotClass(status: HomeConnection["status"]): string {
  switch (status) {
    case "ok":
      return "bg-status-ok";
    case "warn":
      return "bg-status-warn";
    case "down":
      return "bg-status-down";
    default:
      return "bg-status-unknown";
  }
}
