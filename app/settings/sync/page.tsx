import { SettingsTabs } from "@/components/settings/settings-tabs";
import { SyncSettingsForm } from "@/components/settings/sync-form";
import { ToastSeedHost } from "@/components/toast/seed-host";
import { requireUser } from "@/lib/auth/require";
import { getConnection } from "@/lib/connections/store";
import { getIngestSettings } from "@/lib/ingest/run";
import { lastJobTimes, listTofaLibraries } from "@/lib/sync/actions";
import { pendingCount } from "@/lib/sync/preview";
import { getSyncSettings } from "@/lib/sync/settings";

export const dynamic = "force-dynamic";

export default async function SyncSettingsPage() {
  const user = await requireUser();
  const tofa = getConnection("tofa");
  const trakt = getConnection("trakt");
  const ingest = getIngestSettings();
  const sync = getSyncSettings();
  const libraries = await listTofaLibraries();
  const jobs = await lastJobTimes();
  const pending = pendingCount();
  const ingestAgo = relative(jobs.ingestFinishedAt);
  const reconcileAgo = relative(jobs.reconcileFinishedAt);
  const syncAgo = relative(jobs.syncFinishedAt);
  return (
    <>
      <ToastSeedHost />
      <SettingsTabs current="sync" />
      <div className="px-4 pb-12 pt-5 md:px-8">
        <SyncSettingsForm
          episodeThreshold={ingest.episodeThreshold}
          ingestEnabled={ingest.ingestEnabled}
          intervalMinutes={ingest.intervalMinutes}
          jobLabel={`Last ingest ${ingestAgo} · last reconcile ${reconcileAgo} · last Trakt sync ${syncAgo} · ${pending} pending`}
          libraries={libraries}
          movieThreshold={ingest.movieThreshold}
          pending={pending}
          reconcileEnabled={sync.reconcileEnabled}
          reconcileEveryMinutes={sync.reconcileEveryMinutes}
          sync={sync}
          traktUsername={trakt?.accountLabel ?? null}
          username={tofa?.accountLabel ?? user.username}
        />
      </div>
    </>
  );
}

function relative(value: Date | string | null | undefined): string {
  if (!value) {
    return "never";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "never";
  }
  const delta = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.round(delta / 60_000));
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}
