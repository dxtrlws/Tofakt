import type { YearReview } from "@/lib/stats/year";

export function YearStats({ review }: { review: YearReview }) {
  return (
    <section className="grid w-full grid-cols-2 gap-2 px-4 pt-4 md:flex md:gap-4 md:px-8 md:pt-7">
      <Stat
        hint={review.vsLastYear}
        hintAccent
        label="Plays"
        value={String(review.plays)}
      />
      <Stat
        hint={review.fullDaysLabel}
        label="Hours"
        value={review.hoursLabel}
      />
      <Stat
        hint={review.busiestMonth?.line ?? "No plays yet"}
        label="Busiest month"
        value={review.busiestMonth?.name ?? "—"}
      />
      <Stat
        hint={review.rewatchShare}
        label="New / rewatch"
        value={review.newShare ?? "—"}
      />
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  hintAccent,
}: {
  label: string;
  value: string;
  hint: string | null;
  hintAccent?: boolean;
}) {
  return (
    <div className="flex min-w-0 grow basis-0 flex-col gap-0.5 rounded-md border border-border bg-bg-raised p-3 md:gap-1.5 md:rounded-lg md:p-5">
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
