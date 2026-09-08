import { YearTop10 } from "@/components/year/ranked";
import type { MonthReview } from "@/lib/stats/month";

export function MonthRanked({ review }: { review: MonthReview }) {
  if (review.topShows.length === 0 && review.topMovies.length === 0) {
    return null;
  }
  return (
    <>
      <YearTop10 items={review.topShows} title="Top 10 watched shows" />
      <YearTop10 items={review.topMovies} title="Top 10 watched movies" />
    </>
  );
}
