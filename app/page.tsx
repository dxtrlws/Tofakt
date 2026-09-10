import { AttentionCard } from "@/components/home/attention";
import { PosterCarousel } from "@/components/home/carousel";
import { MonthCard } from "@/components/home/month-card";
import { HomePoller } from "@/components/home/poller";
import { PosterCard } from "@/components/home/poster-card";
import { StatusStrip } from "@/components/home/status-strip";
import { UpcomingFilters } from "@/components/home/upcoming-filters";
import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/require";
import { loadHomeDashboard } from "@/lib/home/query";
import { parseUpcomingFilter } from "@/lib/home/upcoming";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  const params = await searchParams;
  const upcomingFilter = parseUpcomingFilter(params.upcoming);
  const dash = await loadHomeDashboard(upcomingFilter);

  return (
    <AppShell current="home" username={user.username}>
      <HomePoller />
      <main className="flex flex-1 flex-col" id="main-content" tabIndex={-1}>
        <StatusStrip
          attentionCount={dash.attentionCount}
          connections={dash.connections}
          pending={dash.pending}
        />
        <p className="hidden px-6 pt-2 text-meta leading-meta text-fg-muted md:block">
          {dash.lastSyncLabel}
        </p>
        {dash.pendingPlays.length > 0 ? (
          <section className="hidden flex-col gap-4 px-6 pt-7 md:flex">
            <div className="flex items-baseline justify-between gap-4">
              <h1 className="font-headline text-title-sm font-semibold leading-title-sm tracking-title-sm text-fg">
                Pending to sync
              </h1>
              <p className="text-meta font-medium leading-meta text-fg-muted">
                {dash.pendingPlays.length} waiting to send to Trakt
              </p>
            </div>
            <PosterCarousel>
              {dash.pendingPlays.map((poster) => (
                <PosterCard key={poster.id} poster={poster} />
              ))}
            </PosterCarousel>
          </section>
        ) : null}
        <section className="flex flex-col gap-4 px-4 pt-7 md:px-6">
          <h1 className="font-headline text-title-sm font-semibold leading-title-sm tracking-title-sm text-fg max-md:font-sans max-md:text-label max-md:uppercase max-md:tracking-label max-md:text-fg-muted">
            Recently watched
          </h1>
          {dash.recent.length === 0 ? (
            <p className="text-ui text-fg-muted">
              {dash.traktOk
                ? "No plays on Trakt yet."
                : "Connect Trakt to show recently watched."}
            </p>
          ) : (
            <PosterCarousel>
              {dash.recent.map((poster) => (
                <PosterCard key={poster.id} poster={poster} />
              ))}
            </PosterCarousel>
          )}
        </section>
        <section className="hidden flex-col gap-4 px-6 pt-7 md:flex">
          <UpcomingFilters filter={dash.upcomingFilter} />
          {dash.upcoming.length === 0 ? (
            <p className="text-ui text-fg-muted">
              {dash.traktOk
                ? emptyUpcoming(dash.upcomingFilter)
                : "Connect Trakt to show upcoming episodes."}
            </p>
          ) : (
            <PosterCarousel>
              {dash.upcoming.map((poster) => (
                <PosterCard key={poster.id} poster={poster} />
              ))}
            </PosterCarousel>
          )}
        </section>
        <div className="flex flex-col gap-5 px-4 pb-8 pt-4 md:px-6 md:pt-9 lg:flex-row">
          <MonthCard month={dash.month} />
          <div className="hidden md:contents">
            <AttentionCard items={dash.attention} />
          </div>
        </div>
      </main>
    </AppShell>
  );
}

function emptyUpcoming(filter: ReturnType<typeof parseUpcomingFilter>): string {
  if (filter === "premieres") {
    return "No season premieres in the next 21 days.";
  }
  if (filter === "finales") {
    return "No season finales in the next 21 days.";
  }
  return "No upcoming episodes in the next 21 days.";
}
