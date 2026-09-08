"use client";

import { useState } from "react";
import { formatHours } from "@/lib/stats/period";
import type {
  YearKindStats as KindStats,
  YearChartBar,
} from "@/lib/stats/year";

export function YearKindStats({ stats }: { stats: KindStats }) {
  if (stats.plays === 0) {
    return null;
  }
  return (
    <section className="flex flex-col gap-8 px-4 md:px-8 pt-10">
      <div className="flex justify-center">
        <p className="rounded-sm border border-fg px-3 py-1.5 text-label font-semibold tracking-label text-fg">
          {stats.badge}
        </p>
      </div>
      <RateRow
        label="Hours watched"
        perDay={stats.hoursPerDay}
        perMonth={stats.hoursPerMonth}
        perWeek={stats.hoursPerWeek}
        value={stats.hoursLabel}
      />
      <RateRow
        label={stats.title === "Movies" ? "Movie plays" : "Episode plays"}
        perDay={stats.playsPerDay}
        perMonth={stats.playsPerMonth}
        perWeek={stats.playsPerWeek}
        value={String(stats.plays)}
      />
      <HoverChart
        bars={stats.weeks}
        height={96}
        label={`${stats.title === "Movies" ? "Movie" : "Episode"} plays by week`}
        marks={["1", "27", "53"]}
      />
      <div className="flex flex-col gap-8 lg:flex-row">
        <HoverChart
          bars={stats.months}
          className="min-w-0 grow basis-0"
          height={96}
          label={`${stats.title === "Movies" ? "Movie" : "Episode"} plays by month`}
        />
        <HoverChart
          bars={stats.weekdays}
          className="min-w-0 grow basis-0"
          height={96}
          label={`${stats.title === "Movies" ? "Movie" : "Episode"} plays by day`}
        />
      </div>
      <HoverChart
        bars={stats.hoursOfDay}
        height={96}
        label={`${stats.title === "Movies" ? "Movie" : "Episode"} plays by hour`}
        marks={["12 AM", "6 AM", "12 PM", "6 PM", "11 PM"]}
      />
    </section>
  );
}

function RateRow({
  value,
  label,
  perMonth,
  perWeek,
  perDay,
}: {
  value: string;
  label: string;
  perMonth: string;
  perWeek: string;
  perDay: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-10 border-b border-border pb-4">
      <div className="flex flex-col gap-1">
        <p className="text-stat font-semibold leading-8 tracking-display text-fg">
          {value}
        </p>
        <p className="text-label font-semibold uppercase leading-label tracking-label text-fg-muted">
          {label}
        </p>
      </div>
      <Rate value={perMonth} label="Per month" />
      <Rate value={perWeek} label="Per week" />
      <Rate value={perDay} label="Per day" />
    </div>
  );
}

function Rate({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-headline text-title-sm font-semibold leading-title-sm text-fg">
        {value}
      </p>
      <p className="text-label font-semibold uppercase leading-label tracking-label text-fg-muted">
        {label}
      </p>
    </div>
  );
}

function HoverChart({
  bars,
  label,
  height,
  marks,
  className,
}: {
  bars: YearChartBar[];
  label: string;
  height: number;
  marks?: string[];
  className?: string;
}) {
  const max = Math.max(...bars.map((bar) => bar.plays), 1);
  const peak = bars.reduce(
    (best, bar) => (bar.plays > best.plays ? bar : best),
    bars[0] ?? { key: "", label: "", plays: 0, seconds: 0 },
  );
  const [hover, setHover] = useState<YearChartBar | null>(null);
  const shown = hover ?? (peak.plays > 0 ? peak : null);
  return (
    <div className={`flex flex-col gap-3 ${className ?? ""}`}>
      <div className="flex items-end gap-0.5" style={{ height }}>
        {bars.map((bar) => {
          const active = shown?.key === bar.key;
          return (
            <button
              className={`min-w-0 grow basis-0 rounded-t-sm ${
                bar.plays === 0
                  ? "bg-bg-overlay"
                  : active
                    ? "bg-accent"
                    : "bg-accent-muted"
              }`}
              key={bar.key}
              onBlur={() => setHover(null)}
              onFocus={() => setHover(bar)}
              onMouseEnter={() => setHover(bar)}
              onMouseLeave={() => setHover(null)}
              style={{
                height:
                  bar.plays === 0
                    ? 8
                    : Math.max(8, Math.round((bar.plays / max) * height)),
              }}
              title={`${bar.label} · ${bar.plays} plays · ${formatHours(bar.seconds)} hours`}
              type="button"
            />
          );
        })}
      </div>
      {marks ? (
        <div className="flex justify-between text-label text-fg-muted">
          {marks.map((mark) => (
            <span key={mark}>{mark}</span>
          ))}
        </div>
      ) : null}
      <p className="text-label font-semibold uppercase leading-label tracking-label text-fg-muted">
        {label}
        {shown
          ? ` · ${shown.label} ${shown.plays} ${shown.plays === 1 ? "play" : "plays"} · ${formatHours(shown.seconds)}h`
          : ""}
      </p>
    </div>
  );
}
