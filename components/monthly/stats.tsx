import type { MonthReview } from "@/lib/stats/month";

export function MonthStats({ review }: { review: MonthReview }) {
  return (
    <section className="flex w-full gap-2 px-4 pt-4 md:gap-4 md:px-8 md:pt-7">
      <Stat
        label="Plays"
        value={String(review.plays)}
        hint={review.vsLastMonth}
        hintAccent
      />
      <Stat
        label="Hours"
        value={review.hoursLabel}
        hint={`${review.tvPlays} ${review.tvPlays === 1 ? "play" : "plays"} of TV · ${review.moviePlays} ${review.moviePlays === 1 ? "movie" : "movies"}`}
      />
      <Stat
        className="hidden md:flex"
        label="Days active"
        value={String(review.daysActive)}
        hint={review.peakHourLabel}
      />
      {review.ratingsCount > 0 ? (
        <Stat
          className="hidden md:flex"
          label="Ratings"
          value={String(review.ratingsCount)}
          hint={`Source: ${review.ratingsSource}`}
        />
      ) : null}
    </section>
  );
}

function Stat({
  className,
  label,
  value,
  hint,
  hintAccent,
}: {
  className?: string;
  label: string;
  value: string;
  hint: string | null;
  hintAccent?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 grow basis-0 flex-col gap-0.5 rounded-md border border-border bg-bg-raised p-3 md:gap-1.5 md:rounded-lg md:p-5 ${className ?? ""}`}
    >
      <p className="text-label font-semibold uppercase leading-label tracking-label text-fg-muted">
        {label}
      </p>
      <p className="font-headline text-title-sm font-semibold leading-title-sm text-fg md:font-sans md:text-stat md:leading-8 md:tracking-display">
        {value}
      </p>
      {hint ? (
        <p
          className={`hidden text-meta leading-meta md:block ${hintAccent ? "text-accent" : "text-fg-muted"}`}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
