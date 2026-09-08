import Link from "next/link";
import type { HomeMonth } from "@/lib/home/query";

export function MonthCard({ month }: { month: HomeMonth }) {
  return (
    <section className="relative flex min-w-0 grow basis-0 flex-col gap-2 md:gap-4 md:rounded-xl md:border md:border-border md:bg-bg-raised md:p-5">
      <Link
        aria-label="Open monthly review"
        className="absolute inset-0 md:hidden"
        href="/monthly"
      />
      <p className="text-label font-semibold uppercase leading-label tracking-label text-fg-muted md:text-accent">
        <span className="md:hidden">This month so far</span>
        <span className="hidden md:inline">This month on Trakt</span>
      </p>
      <h2 className="font-headline text-title font-bold leading-10 tracking-title text-fg">
        {month.name}
      </h2>
      <p className="text-body leading-[18px] text-fg-muted md:hidden">
        {month.plays} {month.plays === 1 ? "play" : "plays"} ·{" "}
        {month.hoursLabel} hours · {month.daysActive}{" "}
        {month.daysActive === 1 ? "day" : "days"}
      </p>
      <div className="hidden gap-6 pt-2 md:flex">
        <Stat value={String(month.plays)} label="plays" />
        <Stat value={month.hoursLabel} label="hours" />
        <Stat value={String(month.daysActive)} label="days active" />
      </div>
      {month.firstPlay ? (
        <p className="hidden pt-2 text-ui leading-[18px] text-fg-muted md:block">
          {month.firstPlay}
        </p>
      ) : (
        <p className="hidden pt-2 text-ui leading-[18px] text-fg-muted md:block">
          No Trakt plays this month yet.
        </p>
      )}
      <Link
        className="hidden pt-1 text-meta font-medium leading-meta text-accent md:inline"
        href="/monthly"
      >
        Open monthly review
      </Link>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-stat font-semibold leading-8 tracking-display text-fg">
        {value}
      </p>
      <p className="text-meta leading-meta text-fg-muted">{label}</p>
    </div>
  );
}
