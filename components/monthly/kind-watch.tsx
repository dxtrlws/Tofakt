import type { KindChartBar, KindWatchStats } from "@/lib/stats/kind";

export function KindWatchPanel({ stats }: { stats: KindWatchStats }) {
  if (stats.plays === 0) {
    return null;
  }
  const headline = `${stats.hoursLabel} hours of ${stats.headlineCount} ${stats.noun}`;
  const peak = stats.bars.reduce(
    (best, bar) => (bar.plays > best.plays ? bar : best),
    stats.bars[0] ?? { key: "", label: "", plays: 0, seconds: 0 },
  );
  const kindLabel = stats.kind === "movie" ? "movie" : "TV";
  return (
    <section
      aria-label={`${stats.noun} watch statistics for ${stats.periodName}`}
      className="flex flex-col gap-2 px-4 pt-10 md:px-8"
    >
      <div className="relative overflow-hidden rounded-xl bg-bg-raised px-5 py-8 md:px-8">
        <p
          aria-hidden
          className="pointer-events-none absolute bottom-4 left-5 max-w-[90%] overflow-hidden font-headline text-[56px] font-semibold leading-none tracking-title text-fg/[0.045] select-none md:left-8 md:text-[80px]"
        >
          {headline}
        </p>
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
          <div className="flex min-w-0 max-w-xl flex-col gap-6">
            <div className="flex flex-col gap-2">
              <p className="text-label font-semibold uppercase leading-label tracking-label text-fg-muted">
                {`In ${stats.periodName}, you watched`}
              </p>
              <h2 className="font-headline text-title font-semibold leading-[1.05] tracking-title text-fg md:text-stat md:leading-stat">
                {headline}
              </h2>
            </div>
            <Insights stats={stats} />
          </div>
          <ActivityBars
            bars={stats.bars}
            granularity={stats.barGranularity}
            kindLabel={kindLabel}
            peakKey={peak.plays > 0 ? peak.key : null}
          />
        </div>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        <RateCard
          icon="hours"
          perDay={stats.hoursPerDay}
          perWeek={stats.hoursPerWeek}
          series={stats.hoursSeries}
          title={`${stats.hoursLabel} Hours`}
          watermark={`${stats.hoursLabel} Hours`}
        />
        <RateCard
          icon="plays"
          perDay={stats.playsPerDay}
          perWeek={stats.playsPerWeek}
          series={stats.playsSeries}
          title={`${stats.plays} Plays`}
          watermark={`${stats.plays} Plays`}
        />
      </div>
    </section>
  );
}

function Insights({ stats }: { stats: KindWatchStats }) {
  if (!stats.mostActiveDay && !stats.peakTime) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1 text-meta leading-meta text-fg-muted md:text-ui md:leading-ui">
      {stats.mostActiveDay ? (
        <p>
          Your most active day was{" "}
          <span className="font-semibold text-accent">
            {stats.mostActiveDay.label}
          </span>{" "}
          with{" "}
          <span className="font-semibold text-accent">
            {stats.mostActiveDay.plays}{" "}
            {stats.mostActiveDay.plays === 1 ? "play" : "plays"}
          </span>
          .
        </p>
      ) : null}
      {stats.peakTime ? (
        <p>
          The most popular time you watched was{" "}
          <span className="font-semibold text-accent">{stats.peakTime}</span>.
        </p>
      ) : null}
    </div>
  );
}

function ActivityBars({
  bars,
  peakKey,
  kindLabel,
  granularity,
}: {
  bars: KindChartBar[];
  peakKey: string | null;
  kindLabel: string;
  granularity: "day" | "month";
}) {
  const max = Math.max(...bars.map((bar) => bar.plays), 1);
  const height = 128;
  const unit = granularity === "month" ? "month" : "day";
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div
        aria-label={`${kindLabel} plays by ${unit}. Peak ${max} ${max === 1 ? "play" : "plays"}.`}
        className="flex h-32 items-end gap-0.5 md:gap-1"
        role="img"
      >
        {bars.map((bar) => {
          const active = peakKey === bar.key;
          return (
            <div
              className={`min-w-0 grow basis-0 rounded-t-md ${
                bar.plays === 0
                  ? "bg-transparent"
                  : active
                    ? "bg-accent"
                    : "bg-accent-muted"
              }`}
              key={bar.key}
              style={{
                height:
                  bar.plays === 0
                    ? 0
                    : Math.max(10, Math.round((bar.plays / max) * height)),
              }}
              title={`${bar.label} · ${bar.plays} ${bar.plays === 1 ? "play" : "plays"}`}
            />
          );
        })}
      </div>
      <div className="flex text-label leading-label text-fg-subtle">
        {bars.map((bar, index) => {
          const numbered = Number(bar.label);
          const keep =
            granularity === "month" ||
            index === 0 ||
            index === bars.length - 1 ||
            (Number.isFinite(numbered) && numbered % 5 === 0);
          return (
            <span
              className={`min-w-0 grow basis-0 truncate text-center tabular-nums ${
                keep ? "" : "invisible md:visible"
              }`}
              key={bar.key}
            >
              {bar.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function RateCard({
  title,
  watermark,
  series,
  perWeek,
  perDay,
  icon,
}: {
  title: string;
  watermark: string;
  series: number[];
  perWeek: string;
  perDay: string;
  icon: "hours" | "plays";
}) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-bg-raised px-5 py-6 md:px-8">
      <p
        aria-hidden
        className="pointer-events-none absolute bottom-3 left-5 max-w-[90%] overflow-hidden font-headline text-[48px] font-semibold leading-none tracking-title text-fg/[0.045] select-none md:text-[64px]"
      >
        {watermark}
      </p>
      <div className="relative flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-headline text-title-sm font-semibold leading-title-sm tracking-title-sm text-fg md:text-title md:leading-title">
            {title}
          </h3>
          <span className="mt-1 text-fg-subtle">
            {icon === "hours" ? <ClockIcon /> : <PlayIcon />}
          </span>
        </div>
        <Sparkline values={series} />
        <div className="flex flex-col">
          <RateRow label="Per Week" value={perWeek} />
          <RateRow label="Per Day" value={perDay} />
        </div>
      </div>
    </div>
  );
}

function RateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border py-3">
      <p className="text-ui text-fg-muted">{label}</p>
      <p className="text-ui font-medium tabular-nums text-fg">{value}</p>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const width = 240;
  const height = 56;
  const path = sparkPath(values, width, height);
  return (
    <svg
      aria-hidden
      className="h-16 w-full overflow-visible"
      fill="none"
      viewBox={`0 0 ${width} ${height}`}
    >
      <title>Trend</title>
      {path ? (
        <>
          <path className="fill-accent/20" d={path.area} />
          <path
            className="stroke-accent"
            d={path.line}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </>
      ) : null}
    </svg>
  );
}

function sparkPath(
  values: number[],
  width: number,
  height: number,
): { line: string; area: string } | null {
  if (values.length === 0) {
    return null;
  }
  const max = Math.max(...values, 0);
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values.map((value, index) => ({
    x: index * step,
    y: max === 0 ? height - 2 : height - 4 - (value / max) * (height - 8),
  }));
  const line = curve(points);
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) {
    return null;
  }
  return {
    line,
    area: `${line} L ${last.x} ${height} L ${first.x} ${height} Z`,
  };
}

function curve(points: Array<{ x: number; y: number }>): string {
  const start = points[0];
  if (!start) {
    return "";
  }
  if (points.length === 1) {
    return `M ${start.x} ${start.y}`;
  }
  let path = `M ${start.x} ${start.y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] ?? p2;
    if (!p0 || !p1 || !p2 || !p3) {
      continue;
    }
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return path;
}

function ClockIcon() {
  return (
    <svg aria-hidden className="size-5" fill="none" viewBox="0 0 20 20">
      <title>Hours</title>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 6.5V10l2.5 1.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden className="size-5" fill="none" viewBox="0 0 20 20">
      <title>Plays</title>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8.5 7.5v5l4.5-2.5-4.5-2.5Z"
        fill="currentColor"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.2"
      />
    </svg>
  );
}
