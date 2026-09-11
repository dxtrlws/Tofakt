import Link from "next/link";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { ToastSeedHost } from "@/components/toast/seed-host";
import { aboutFacts } from "@/lib/about/about";
import { requireUser } from "@/lib/auth/require";

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  await requireUser();
  const facts = aboutFacts();
  const rows = [
    { label: "Version", value: facts.version },
    { label: "Build", value: facts.build },
    { label: "Uptime", value: facts.uptime },
    { label: "Database", value: facts.database },
    { label: "Events", value: facts.events },
  ];

  return (
    <>
      <ToastSeedHost />
      <SettingsTabs current="about" />
      <div className="flex flex-col gap-4 px-4 pb-12 pt-5 md:px-8">
        <section className="rounded-lg border border-border bg-bg-raised px-5 py-2">
          {rows.map((row, index) => (
            <div
              className={`flex items-center py-[14px] ${index < rows.length - 1 ? "border-b border-border" : ""}`}
              key={row.label}
            >
              <span className="grow basis-0 text-body leading-[18px] text-fg">
                {row.label}
              </span>
              <span className="w-[200px] shrink-0 text-right text-ui leading-[18px] text-fg-muted">
                {row.value}
              </span>
            </div>
          ))}
        </section>
        <p className="text-ui leading-[18px] text-fg-muted">
          Job history and the audit trail are on{" "}
          <Link
            className="text-accent underline underline-offset-2"
            href="/settings/logs"
          >
            Logs
          </Link>
          . Design tokens and UI primitives live on the{" "}
          <Link
            className="text-accent underline underline-offset-2"
            href="/styleguide"
          >
            Styleguide
          </Link>
          .
        </p>
        <p className="text-meta leading-meta text-fg-muted">
          This product uses the TMDB API but is not endorsed or certified by
          TMDB. Trakt data via the user’s own OAuth application.
        </p>
      </div>
    </>
  );
}
