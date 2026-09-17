import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import {
  MomentPending,
  NamedBarsPending,
  Top10Pending,
} from "@/components/layout/pending";
import { MonthGenreWatch } from "@/components/monthly/genres";
import { KindWatchPanel } from "@/components/monthly/kind-watch";
import { ToastSeedHost } from "@/components/toast/seed-host";
import { YearChrome } from "@/components/year/chrome";
import { YearEmpty } from "@/components/year/empty";
import { YearMonths } from "@/components/year/months";
import { YearNamedBars } from "@/components/year/named-bars";
import { YearStats } from "@/components/year/stats";
import {
  YearBingeMoment,
  YearFirstMoment,
  YearLastMoment,
  YearNetworks,
  YearStudios,
  YearTopMoviesSection,
  YearTopShowsSection,
} from "@/components/year/streamed";
import { requireUser } from "@/lib/auth/require";
import { timezone } from "@/lib/ingest/run";
import { parseYearParam } from "@/lib/stats/period";
import { loadYearShell } from "@/lib/stats/year";

export const dynamic = "force-dynamic";

export default async function YearPage({ searchParams }: PageProps<"/year">) {
  const user = await requireUser();
  const params = await searchParams;
  const now = new Date();
  const year = parseYearParam(params.year, now, timezone());
  // Stats, months, genres and services all come from local SQLite, so the page
  // paints immediately. Artwork and the TMDB org bars stream in behind it.
  const review = await loadYearShell(year, now);
  const art = { year, nowMs: now.getTime() };

  return (
    <AppShell current="year" username={user.username}>
      <ToastSeedHost />
      <main
        className="flex flex-1 flex-col pb-16"
        id="main-content"
        tabIndex={-1}
      >
        <YearChrome review={review} />
        {review.empty ? (
          <YearEmpty connected={review.traktConnected} year={review.year} />
        ) : (
          <>
            <YearStats review={review} />
            <YearMonths review={review} />
            {review.first ? (
              <Suspense fallback={<MomentPending label="First play" />}>
                <YearFirstMoment {...art} />
              </Suspense>
            ) : null}
            {review.binge ? (
              <Suspense fallback={<MomentPending label="Longest binge" />}>
                <YearBingeMoment {...art} />
              </Suspense>
            ) : null}
            {review.topShows.length > 0 ? (
              <Suspense
                fallback={<Top10Pending title={"Top 10 Watched\nShows"} />}
              >
                <YearTopShowsSection {...art} />
              </Suspense>
            ) : null}
            <MonthGenreWatch
              items={review.tvGenres}
              title={"Most Watched\nShow Genres"}
              unit="show"
              watch={review.tvGenreWatch}
              watermark="show genres"
            />
            {review.tvPlays > 0 ? (
              <Suspense
                fallback={
                  <NamedBarsPending
                    countLabel="networks"
                    title={"TV\nNetworks"}
                  />
                }
              >
                <YearNetworks {...art} />
              </Suspense>
            ) : null}
            <YearNamedBars
              caption="TMDB providers at ingest, US region. Not where these were watched. Flatrate first; shows with no provider sit in Not currently streaming."
              countLabel="services"
              eyebrow="Availability on"
              items={review.tvServices}
              title={"Streaming\nServices"}
              unit="show"
            />
            <KindWatchPanel stats={review.tv} />
            {review.topMovies.length > 0 ? (
              <Suspense
                fallback={<Top10Pending title={"Top 10 Watched\nMovies"} />}
              >
                <YearTopMoviesSection {...art} />
              </Suspense>
            ) : null}
            <MonthGenreWatch
              items={review.movieGenres}
              title={"Most Watched\nMovie Genres"}
              unit="movie"
              watch={review.movieGenreWatch}
              watermark="movie genres"
            />
            {review.moviePlays > 0 ? (
              <Suspense
                fallback={
                  <NamedBarsPending
                    countLabel="studios"
                    title={"Movie\nStudios"}
                  />
                }
              >
                <YearStudios {...art} />
              </Suspense>
            ) : null}
            <YearNamedBars
              caption="TMDB providers at ingest, US region. Not where these were watched. Flatrate first; films with no provider sit in Not currently streaming."
              countLabel="services"
              eyebrow="Availability on"
              items={review.movieServices}
              title={"Streaming\nServices"}
              unit="movie"
            />
            <KindWatchPanel stats={review.movies} />
            {review.last ? (
              <Suspense fallback={<MomentPending label="Last play" />}>
                <YearLastMoment {...art} />
              </Suspense>
            ) : null}
          </>
        )}
      </main>
    </AppShell>
  );
}
