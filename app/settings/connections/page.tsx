import { TmdbCard } from "@/components/connections/tmdb-card";
import { TofaCard } from "@/components/connections/tofa-card";
import { TraktCard } from "@/components/connections/trakt-card";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { getPublicConnections } from "@/lib/connections/actions";
import { pendingFlowView } from "@/lib/connections/device-flow";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const connections = await getPublicConnections();
  return (
    <>
      <SettingsTabs current="connections" />
      <div className="flex flex-col gap-4 px-4 pb-12 pt-5 md:px-8">
        <TofaCard connection={connections.tofa} />
        <TraktCard
          connection={connections.trakt}
          pending={pendingFlowView("trakt")}
        />
        <TmdbCard connection={connections.tmdb} />
      </div>
    </>
  );
}
