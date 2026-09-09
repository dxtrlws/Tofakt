import { AppShell } from "@/components/app-shell";
import { MonthActivity } from "@/components/monthly/activity";
import { MonthBreakdowns } from "@/components/monthly/breakdowns";
import { MonthChrome } from "@/components/monthly/chrome";
import { MonthEmpty } from "@/components/monthly/empty";
import { MonthMomentCard } from "@/components/monthly/first-play";
import { MonthGenreWatch } from "@/components/monthly/genres";
import { MonthPosters } from "@/components/monthly/posters";
import { MonthTopFive } from "@/components/monthly/ranked";
import { MonthRatings } from "@/components/monthly/ratings";
import { MonthStats } from "@/components/monthly/stats";
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
            <MonthTopFive
              items={review.topShows}
              title={"Most Watched\nTV Shows"}
            />
            <MonthGenreWatch
              items={review.tvGenres}
              title={"Most Watched\nShow Genres"}
              unit="show"
              watch={review.tvGenreWatch}
              watermark="show genres"
            />
            <MonthTopFive
              items={review.topMovies}
              title={"Most Watched\nMovies"}
            />
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
              <MonthMomentCard label="Last play" moment={review.last} />
            ) : null}
          </>
        )}
      </main>
    </AppShell>
  );
}
