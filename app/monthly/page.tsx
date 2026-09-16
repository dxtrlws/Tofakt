import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import {
  MomentPending,
  PosterRailPending,
  RankedListPending,
} from "@/components/layout/pending";
import { MonthActivity } from "@/components/monthly/activity";
import { MonthBreakdowns } from "@/components/monthly/breakdowns";
import { MonthChrome } from "@/components/monthly/chrome";
import { MonthEmpty } from "@/components/monthly/empty";
import { MonthGenreWatch } from "@/components/monthly/genres";
import { MonthRatings } from "@/components/monthly/ratings";
import { MonthStats } from "@/components/monthly/stats";
import {
  MonthClosingMoment,
  MonthOpeningMoment,
  MonthPosterRail,
  MonthTopMovies,
  MonthTopShows,
} from "@/components/monthly/streamed";
import { ToastSeedHost } from "@/components/toast/seed-host";
import { requireUser } from "@/lib/auth/require";
import { timezone } from "@/lib/ingest/run";
import { loadMonthShell } from "@/lib/stats/month";
import { monthKey, parseMonthParam } from "@/lib/stats/period";

export const dynamic = "force-dynamic";

export default async function MonthlyPage({
  searchParams,
}: PageProps<"/monthly">) {
  const user = await requireUser();
  const params = await searchParams;
  const now = new Date();
  const month = parseMonthParam(params.month, now, timezone());
  // The shell reads only local SQLite, so the page paints before any TMDB
  // lookup starts. Artwork streams into the boundaries below.
  const review = await loadMonthShell(month, now);
  const art = { monthKey: monthKey(month), nowMs: now.getTime() };

  return (
    <AppShell current="monthly" username={user.username}>
      <ToastSeedHost />
      <main
        className="flex flex-1 flex-col pb-16"
        id="main-content"
        tabIndex={-1}
      >
        <MonthChrome review={review} />
        {review.empty ? (
          <MonthEmpty connected={review.traktConnected} name={review.name} />
        ) : (
          <>
            <div className="flex flex-col">
              <div className="order-2 md:order-none">
                <MonthStats review={review} />
              </div>
              {review.first ? (
                <div className="order-1 md:order-none">
                  <Suspense
                    fallback={<MomentPending label="How the month opened" />}
                  >
                    <MonthOpeningMoment {...art} />
                  </Suspense>
                </div>
              ) : null}
            </div>
            {review.posters.length > 0 ? (
              <Suspense
                fallback={
                  <PosterRailPending heading={`Watched in ${review.name}`} />
                }
              >
                <MonthPosterRail {...art} />
              </Suspense>
            ) : null}
            <MonthBreakdowns services={review.services} />
            {review.topShows.length > 0 ? (
              <Suspense
                fallback={<RankedListPending label="Most watched TV show" />}
              >
                <MonthTopShows {...art} />
              </Suspense>
            ) : null}
            <MonthGenreWatch
              items={review.tvGenres}
              title={"Most Watched\nShow Genres"}
              unit="show"
              watch={review.tvGenreWatch}
              watermark="show genres"
            />
            {review.topMovies.length > 0 ? (
              <Suspense
                fallback={<RankedListPending label="Most watched movie" />}
              >
                <MonthTopMovies {...art} />
              </Suspense>
            ) : null}
            <MonthGenreWatch
              items={review.movieGenres}
              title={"Most Watched\nMovie Genres"}
              unit="movie"
              watch={review.movieGenreWatch}
              watermark="movie genres"
            />
            <MonthActivity review={review} />
            <MonthRatings review={review} />
            {review.last ? (
              <Suspense fallback={<MomentPending label="Last play" />}>
                <MonthClosingMoment {...art} />
              </Suspense>
            ) : null}
          </>
        )}
      </main>
    </AppShell>
  );
}
