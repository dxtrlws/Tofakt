"use client";

import Link from "next/link";
import { useState } from "react";
import { formatHours } from "@/lib/stats/period";
import type { YearMonthBar, YearReview } from "@/lib/stats/year";

const BAR_MAX = 140;

export function YearMonths({ review }: { review: YearReview }) {
  const maxHours = Math.max(...review.months.map((month) => month.hours), 1);
  const [hover, setHover] = useState<YearMonthBar | null>(null);
  const peak = review.months.find((month) => month.tone === "peak") ?? null;
  const shown = hover ?? peak;
  return (
    <section className="flex flex-col gap-4 px-4 md:px-8 pt-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-baseline md:justify-between md:gap-4">
        <h2 className="font-headline text-title-sm font-semibold leading-title-sm text-fg">
          Hours by month
        </h2>
        {shown ? (
          <p className="rounded-md border border-border-strong bg-bg-overlay-strong px-3 py-1.5 text-meta leading-meta text-fg">
            <span className="font-semibold">{shown.label}</span>
            <span className="text-accent">
              {" "}
              · {shown.plays} {shown.plays === 1 ? "play" : "plays"} ·{" "}
              {formatHours(shown.seconds)} hours
            </span>
          </p>
        ) : null}
      </div>
      <div className="flex items-end gap-2">
        {review.months.map((month) => (
          <MonthBar
            bar={month}
            key={month.key}
            maxHours={maxHours}
            onHover={setHover}
          />
        ))}
      </div>
    </section>
  );
}

function MonthBar({
  bar,
  maxHours,
  onHover,
}: {
  bar: YearMonthBar;
  maxHours: number;
  onHover: (bar: YearMonthBar | null) => void;
}) {
  const height =
    bar.plays === 0
      ? 8
      : Math.max(16, Math.round((bar.hours / maxHours) * BAR_MAX));
  const toneClass =
    bar.tone === "peak"
      ? "bg-accent"
      : bar.tone === "current"
        ? "bg-accent-dim"
        : bar.tone === "past"
          ? "bg-chart-1"
          : "bg-bg-overlay";
  return (
    <Link
      className="flex min-w-0 grow basis-0 flex-col items-center gap-2"
      href={`/monthly?month=${bar.key}`}
      onBlur={() => onHover(null)}
      onFocus={() => onHover(bar)}
      onMouseEnter={() => onHover(bar)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="flex h-[140px] w-full items-end">
        <span className={`w-full rounded-sm ${toneClass}`} style={{ height }} />
      </div>
      <span
        className={`text-label font-semibold uppercase leading-label tracking-label ${
          bar.tone === "peak" ? "text-accent" : "text-fg-muted"
        }`}
      >
        {bar.short}
      </span>
    </Link>
  );
}
