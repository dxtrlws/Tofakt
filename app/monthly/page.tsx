import { AppShell } from "@/components/app-shell";
import { MonthActivity } from "@/components/monthly/activity";
import { MonthBreakdowns } from "@/components/monthly/breakdowns";
import { MonthChrome } from "@/components/monthly/chrome";
import { MonthEmpty } from "@/components/monthly/empty";
import { MonthMomentCard } from "@/components/monthly/first-play";
import { MonthPosters } from "@/components/monthly/posters";
import { MonthRanked } from "@/components/monthly/ranked";
import { MonthRatings } from "@/components/monthly/ratings";
import { MonthStats } from "@/components/monthly/stats";
import { YearGenreChart } from "@/components/year/genre-bar";
import { requireUser } from "@/lib/auth/require";
import { timezone } from "@/lib/ingest/run";
import { loadMonthReview } from "@/lib/stats/month";
import { parseMonthParam } from "@/lib/stats/period";

export const dynamic = "force-dynamic";

export default async function MonthlyPage({
  searchParams,
}: PageProps<"/monthly">) {
  const user = await requireUser();
  const params = await searchParams;
  const month = parseMonthParam(params.month, new Date(), timezone());
  const review = await loadMonthReview(month);

  return (
    <AppShell current="monthly" username={user.username}>
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
                  <MonthMomentCard
                    accent
                    label="How the month opened"
                    moment={review.first}
                  />
                </div>
              ) : null}
            </div>
            <MonthPosters name={review.name} posters={review.posters} />
            <MonthBreakdowns services={review.services} />
            <YearGenreChart
              caption="Unique shows by TMDB genre. A show counts in every genre it has, so shares can exceed 100%."
              items={review.tvGenres}
              title="TV genres"
            />
            <YearGenreChart
              caption="Unique films by TMDB genre. A film counts in every genre it has, so shares can exceed 100%."
              items={review.movieGenres}
              title="Movie genres"
            />
            <MonthActivity review={review} />
            <MonthRanked review={review} />
            <MonthRatings review={review} />
            {review.last ? (
              <MonthMomentCard label="Last play" moment={review.last} />
            ) : null}
          </>
        )}
      </main>
    </AppShell>
  );
}
