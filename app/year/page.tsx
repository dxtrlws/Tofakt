import { AppShell } from "@/components/app-shell";
import { MonthMomentCard } from "@/components/monthly/first-play";
import { YearChrome } from "@/components/year/chrome";
import { YearEmpty } from "@/components/year/empty";
import { YearGenreChart } from "@/components/year/genre-bar";
import { YearKindStats } from "@/components/year/kind-stats";
import { YearMonths } from "@/components/year/months";
import { YearNamedBars } from "@/components/year/named-bars";
import { YearTop10 } from "@/components/year/ranked";
import { YearStats } from "@/components/year/stats";
import { requireUser } from "@/lib/auth/require";
import { timezone } from "@/lib/ingest/run";
import { parseYearParam } from "@/lib/stats/period";
import { loadYearReview } from "@/lib/stats/year";

export const dynamic = "force-dynamic";

export default async function YearPage({ searchParams }: PageProps<"/year">) {
  const user = await requireUser();
  const params = await searchParams;
  const year = parseYearParam(params.year, new Date(), timezone());
  const review = await loadYearReview(year);

  return (
    <AppShell current="year" username={user.username}>
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
              <MonthMomentCard
                accent
                label="First play"
                moment={review.first}
              />
            ) : null}
            {review.binge ? (
              <MonthMomentCard
                accent
                label="Longest binge"
                moment={review.binge}
              />
            ) : null}
            <YearKindStats stats={review.tv} />
            <YearTop10 items={review.topShows} title="Top 10 watched shows" />
            <YearGenreChart
              caption="Unique shows by TMDB genre. A show counts in every genre it has, so shares can exceed 100%."
              items={review.tvGenres}
              title="TV genres"
            />
            <YearNamedBars
              caption="Original networks from TMDB. A show counts once, even if it moved networks mid-run."
              items={review.tvNetworks}
              title="TV networks"
              unit="shows"
            />
            <YearNamedBars
              caption="TMDB providers at ingest, US region. Not where these were watched. Flatrate first; shows with no provider sit in Not currently streaming."
              items={review.tvServices}
              title="Where these shows are available (estimated)"
              unit="shows"
            />
            <YearKindStats stats={review.movies} />
            <YearTop10 items={review.topMovies} title="Top 10 watched movies" />
            <YearGenreChart
              caption="Unique films by TMDB genre. A film counts in every genre it has, so shares can exceed 100%."
              items={review.movieGenres}
              title="Movie genres"
            />
            <YearNamedBars
              caption="Production studios from TMDB. A film can count under more than one studio."
              items={review.movieStudios}
              title="Movie studios"
              unit="films"
            />
            <YearNamedBars
              caption="TMDB providers at ingest, US region. Not where these were watched. Flatrate first; films with no provider sit in Not currently streaming."
              items={review.movieServices}
              title="Where these movies are available (estimated)"
              unit="films"
            />
            {review.last ? (
              <MonthMomentCard label="Last play" moment={review.last} />
            ) : null}
          </>
        )}
      </main>
    </AppShell>
  );
}
