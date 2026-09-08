import { DataSettingsForm } from "@/components/settings/data-form";
import { SettingsTabs } from "@/components/settings-tabs";
import { requireUser } from "@/lib/auth/require";
import { getConnection } from "@/lib/connections/store";
import type { Provider } from "@/lib/connections/types";
import { importPreviewCount } from "@/lib/data/history-file";
import { getDataPrefs, listTimeZones } from "@/lib/data/prefs";
import { timezone } from "@/lib/ingest/run";

export const dynamic = "force-dynamic";

const PROVIDERS: Provider[] = ["tofa", "trakt", "tmdb"];

export default async function DataSettingsPage() {
  await requireUser();
  const zone = timezone();
  const prefs = getDataPrefs();
  const connections = PROVIDERS.map((provider) => {
    const row = getConnection(provider);
    return {
      provider,
      label: row?.accountLabel ? `${provider} · ${row.accountLabel}` : provider,
      connected: Boolean(row),
    };
  });

  return (
    <>
      <SettingsTabs current="data" />
      <div className="px-4 pb-12 pt-5 md:px-8">
        <DataSettingsForm
          connections={connections}
          countPartials={prefs.countPartials}
          importPreviewCount={importPreviewCount()}
          timezone={zone}
          timeZones={listTimeZones(zone)}
          weekStarts={prefs.weekStarts}
        />
      </div>
    </>
  );
}
