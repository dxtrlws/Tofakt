import Link from "next/link";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { ToastSeedHost } from "@/components/toast/seed-host";
import { jobStatusText } from "@/lib/about/about";
import { formatStamp } from "@/lib/about/about-format";
import {
  formatAuditDetail,
  formatAuditLabel,
  listAudit,
} from "@/lib/audit/audit";
import { requireUser } from "@/lib/auth/require";
import { timezone } from "@/lib/ingest/run";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  await requireUser();
  const tz = timezone();
  const rows = listAudit(100);
  const status = jobStatusText();

  return (
    <>
      <ToastSeedHost />
      <SettingsTabs current="logs" />
      <div className="flex flex-col gap-4 px-4 pb-12 pt-5 md:px-8">
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-bg-raised p-5">
          <p className="text-label font-semibold uppercase leading-label tracking-label text-fg-muted">
            Jobs
          </p>
          <pre className="overflow-x-auto whitespace-pre text-meta leading-meta text-fg-muted">
            {status}
          </pre>
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
