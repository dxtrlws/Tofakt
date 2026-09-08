import Link from "next/link";
import type { MonthReview } from "@/lib/stats/month";

export function MonthChrome({ review }: { review: MonthReview }) {
  return (
    <section className="flex flex-col gap-1.5 px-4 pt-4 md:gap-2 md:px-8 md:pt-10">
      <div className="flex items-center gap-3 md:gap-4">
        <Link
          aria-label="Previous month"
          className="text-title-sm leading-title-sm text-fg-muted"
          href={`/monthly?month=${review.prevKey}`}
        >
          ‹
        </Link>
        <p className="text-label font-semibold uppercase leading-label tracking-label text-accent">
          <span className="md:hidden">
            {review.name} {review.year}
          </span>
          <span className="hidden md:inline">
            {review.name} {review.year} · Month in review
          </span>
        </p>
        <Link
          aria-label="Next month"
          className="text-title-sm leading-title-sm text-fg-muted"
          href={`/monthly?month=${review.nextKey}`}
        >
          ›
        </Link>
      </div>
      <div className="hidden items-center gap-2 md:flex">
        {review.years.map((year) => {
          const active = year === review.year;
          const href = `/monthly?month=${year}-${String(review.id.month).padStart(2, "0")}`;
          return (
            <Link
              className={`px-2.5 py-1.5 text-ui leading-[18px] ${
                active
                  ? "rounded-full bg-bg-overlay-strong font-semibold text-fg"
                  : "font-medium text-fg-muted"
              }`}
              href={href}
              key={year}
            >
              {year}
            </Link>
          );
        })}
        <span className="h-px grow basis-0" />
        <p className="py-1.5 pl-4 text-meta font-medium leading-meta text-fg-muted">
          <Link
            className="hover:text-fg"
            href={`/monthly/export?month=${review.monthKey}&format=json`}
          >
            Export JSON
          </Link>
          {" · "}
          <Link
            className="hover:text-fg"
            href={`/monthly/export?month=${review.monthKey}&format=csv`}
          >
            CSV
          </Link>
        </p>
      </div>
      <h1 className="font-headline text-stat font-bold leading-stat tracking-display text-fg md:text-display md:leading-display">
        {review.name}
      </h1>
      <p className="text-ui leading-[18px] text-fg-muted md:text-body">
        {review.empty
          ? review.traktConnected
            ? "No Trakt plays in this month"
            : "Connect Trakt to load this month"
          : summaryLine(review)}
      </p>
    </section>
  );
}

function summaryLine(review: MonthReview): string {
  const parts = [
    `${review.plays} ${review.plays === 1 ? "play" : "plays"}`,
    `${review.hoursLabel} hours`,
  ];
  if (review.ratingsCount > 0) {
    parts.push(
      `${review.ratingsCount} ratings from ${review.ratingsSource ?? "Trakt"}`,
    );
  }
  return parts.join(" · ");
}
