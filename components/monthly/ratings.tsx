import type { MonthReview } from "@/lib/stats/month";

export function MonthRatings({ review }: { review: MonthReview }) {
  if (review.ratingsCount === 0 || !review.ratingsAvg) {
    return null;
  }
  const max = Math.max(...review.ratingsBuckets, 1);
  return (
    <section className="flex flex-col items-stretch gap-6 px-4 pt-10 md:flex-row md:items-end md:gap-8 md:px-8">
      <div className="flex flex-col gap-1">
        <p className="text-label font-semibold uppercase leading-label tracking-label text-fg-muted">
          Ratings · {review.ratingsSource}
        </p>
        <p className="font-headline text-display font-bold leading-display tracking-display text-fg">
          {review.ratingsAvg}
          <span className="pl-2 text-title-sm font-semibold text-fg-muted">
            avg
          </span>
        </p>
      </div>
      <div className="flex h-24 min-w-0 grow items-end gap-1">
        {review.ratingsBuckets.map((count, index) => (
          <div
            className="flex min-w-0 grow basis-0 flex-col items-center justify-end gap-1"
            key={`r-${index + 1}`}
          >
            <div
              className="w-full rounded-sm bg-chart-1"
              style={{
                height: `${Math.max(count === 0 ? 0 : 8, (count / max) * 100)}%`,
              }}
            />
            <span className="text-label text-fg-muted">{index + 1}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
