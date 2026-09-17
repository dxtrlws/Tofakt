import Link from "next/link";
import { statusClass, statusDotClass } from "@/components/connections/status";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { ToastSeedHost } from "@/components/toast/seed-host";
import { jobStatus, type JobRowStatus } from "@/lib/about/about";
import { formatStamp } from "@/lib/about/about-format";
import {
  formatAuditDetail,
  formatAuditLabel,
  listAudit,
} from "@/lib/audit/audit";
import { requireUser } from "@/lib/auth/require";
import { timezone } from "@/lib/ingest/run";

export const dynamic = "force-dynamic";

const JOB_LABELS: Record<string, string> = {
  ingest: "Ingest",
  recon: "Reconcile",
  sync: "Trakt sync",
};

function connectionStatus(status: JobRowStatus): string {
  if (status === "ok") {
    return "ok";
  }
  if (status === "error") {
    return "down";
  }
  if (status === "running") {
    return "warn";
  }
  return "unknown";
}

export default async function LogsPage() {
  await requireUser();
  const tz = timezone();
  const rows = listAudit(100);
  const status = jobStatus();

  return (
    <>
      <ToastSeedHost />
      <SettingsTabs current="logs" />
      <div className="flex flex-col gap-4 px-4 pb-12 pt-5 md:px-8">
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-bg-raised p-5">
          <p className="text-label font-semibold uppercase leading-label tracking-label text-fg-muted">
            Jobs
          </p>
          <div className="hidden gap-4 text-label font-semibold uppercase leading-label tracking-label text-fg-muted md:flex">
            <p className="w-24 shrink-0">Job</p>
            <p className="w-[148px] shrink-0">Last run</p>
            <p className="w-16 shrink-0">Duration</p>
            <p className="w-20 shrink-0">Status</p>
            <p className="min-w-0 grow basis-0">Summary</p>
          </div>
          <div className="flex flex-col">
            {status.rows.map((row) => (
              <div
                className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border py-[10px] first:border-t-0 md:flex-nowrap"
                key={row.type}
              >
                <p className="w-24 shrink-0 text-ui font-medium leading-[18px] text-fg">
                  {JOB_LABELS[row.type] ?? row.type}
                </p>
                <p className="w-[148px] shrink-0 text-meta leading-meta text-fg-muted">
                  {row.stamp}
                </p>
                <p className="w-16 shrink-0 text-meta leading-meta text-fg-muted">
                  {row.duration}
                </p>
                <p className="flex w-20 shrink-0 items-center gap-1.5">
                  <span
                    className={`size-2 shrink-0 rounded-full ${statusDotClass(connectionStatus(row.status))}`}
                  />
                  <span
                    className={`text-meta leading-meta ${statusClass(connectionStatus(row.status))}`}
                  >
                    {row.status}
                  </span>
                </p>
                <p className="min-w-0 grow basis-0 text-meta leading-meta text-fg-muted">
                  {row.summary}
                </p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1 border-t border-border pt-3 text-meta leading-meta text-fg-muted">
            <p>{status.rate}</p>
            <p>{status.tofa}</p>
            {status.pause ? (
              <p className={statusClass("warn")}>{status.pause}</p>
            ) : null}
          </div>
          {status.errors.length > 0 ? (
            <div className="flex flex-col gap-1 border-t border-border pt-3">
              {status.errors.map((err, i) => (
                <p
                  className={`text-meta leading-meta ${statusClass("down")}`}
                  key={`${err.type}-${err.stamp}-${i}`}
                >
                  {err.type} · {err.stamp} · {err.message}
                </p>
              ))}
            </div>
          ) : null}
        </section>
        <section className="flex flex-col gap-1 rounded-lg border border-border bg-bg-raised px-5 py-2">
          <div className="flex items-center justify-between">
            <p className="py-[14px] text-label font-semibold uppercase leading-label tracking-label text-fg-muted">
              Audit
            </p>
            <Link
              className="rounded-md border border-border bg-bg-overlay px-3 py-1.5 text-ui font-medium leading-[18px] text-fg"
              href="/settings/logs/export"
            >
              Export CSV
            </Link>
          </div>
          {rows.length === 0 ? (
            <p className="pb-4 text-ui leading-[18px] text-fg-muted">
              Nothing recorded yet. Saving preferences, ingest, and sync will
              show up here.
            </p>
          ) : (
            rows.map((row) => {
              const detail = formatAuditDetail(row.detailJson);
              return (
                <div
                  className="flex items-start gap-4 border-t border-border py-[14px]"
                  key={`${row.at.toISOString()}-${row.action}-${row.subjectId ?? ""}`}
                >
                  <p className="w-[148px] shrink-0 text-meta leading-meta text-fg-muted">
                    {formatStamp(row.at, tz)}
                  </p>
                  <div className="min-w-0 grow basis-0">
                    <p className="text-body leading-[18px] text-fg">
                      {formatAuditLabel(row.action)}
                    </p>
                    {detail ? (
                      <p className="mt-0.5 text-meta leading-meta text-fg-muted">
                        {detail}
                      </p>
                    ) : null}
                  </div>
                  <p className="w-[72px] shrink-0 text-right text-meta leading-meta text-fg-muted">
                    {row.actor}
                  </p>
                </div>
              );
            })
          )}
        </section>
      </div>
    </>
  );
}
