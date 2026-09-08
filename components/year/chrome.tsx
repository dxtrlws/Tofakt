import Link from "next/link";
import type { YearReview } from "@/lib/stats/year";

export function YearChrome({ review }: { review: YearReview }) {
  return (
    <section className="flex flex-col gap-2 px-4 pt-6 md:px-8 md:pt-10">
      <div className="flex items-center gap-4">
        <Link
          aria-label="Previous year"
          className="text-title-sm leading-title-sm text-fg-muted"
          href={`/year?year=${review.prevYear}`}
        >
          ‹
        </Link>
        <p className="text-label font-semibold uppercase leading-label tracking-label text-accent">
          {review.year} · Year in review
        </p>
        <Link
          aria-label="Next year"
          className="text-title-sm leading-title-sm text-fg-muted"
          href={`/year?year=${review.nextYear}`}
        >
          ›
        </Link>
        <span className="hidden h-px grow basis-0 md:block" />
        <p className="hidden py-1.5 pl-4 text-meta font-medium leading-meta text-fg-muted md:block">
          <Link
            className="hover:text-fg"
            href={`/year/export?year=${review.year}&format=json`}
          >
            Export JSON
          </Link>
          {" · "}
          <Link
            className="hover:text-fg"
            href={`/year/export?year=${review.year}&format=png`}
          >
            Share image
          </Link>
        </p>
      </div>
      <h1 className="font-headline text-stat font-bold leading-stat tracking-display text-fg md:text-display md:leading-display">
        {review.year}
      </h1>
      <p className="text-body leading-[18px] text-fg-muted">{review.summary}</p>
    </section>
  );
}
