import type { MonthBar } from "@/lib/stats/month";

const BAR_COLORS = [
  "bg-accent",
  "bg-chart-2",
  "bg-chart-7",
  "bg-chart-5",
  "bg-chart-4",
  "bg-chart-6",
];

export function MonthBreakdowns({ services }: { services: MonthBar[] }) {
  if (services.length === 0) {
    return null;
  }
  const rows = [...services].sort((a, b) => {
    if (a.name === "Not currently streaming") {
      return 1;
    }
    if (b.name === "Not currently streaming") {
      return -1;
    }
    return (
      (b.shows ?? 0) + (b.movies ?? 0) - ((a.shows ?? 0) + (a.movies ?? 0)) ||
      a.name.localeCompare(b.name)
    );
  });
  const serviceCount = rows.filter(
    (item) => item.name !== "Not currently streaming",
  ).length;
  const max = Math.max(
    ...rows.map((item) => (item.shows ?? 0) + (item.movies ?? 0)),
    1,
  );
  return (
    <section className="flex flex-col gap-8 px-4 md:px-8 pt-10">
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-label font-semibold uppercase leading-label tracking-label text-fg-muted">
            Availability on
          </p>
          <h2 className="font-headline text-title font-semibold leading-[1.05] tracking-title text-fg md:text-stat md:leading-stat">
            Streaming Services
          </h2>
        </div>
        <div className="flex flex-col items-end gap-1 pb-1">
          <p className="font-headline text-stat font-semibold leading-stat tracking-display text-accent">
            {String(serviceCount).padStart(2, "0")}
          </p>
          <p className="text-meta leading-meta text-fg-muted">services</p>
        </div>
      </div>
      <div className="flex flex-col">
        {rows.map((item, index) => (
          <ServiceRail
            color={BAR_COLORS[index % BAR_COLORS.length] ?? "bg-accent"}
            item={item}
            key={item.name}
            max={max}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <LegendSwatch className="bg-accent" label="Shows" />
        <LegendSwatch className="bg-chart-3" label="Movies" />
        <p className="text-meta leading-meta text-fg-subtle">
          Bar length is unique titles on that service
        </p>
      </div>
    </section>
  );
}

function ServiceRail({
  item,
  max,
  color,
}: {
  item: MonthBar;
  max: number;
  color: string;
}) {
  const shows = item.shows ?? 0;
  const movies = item.movies ?? 0;
  const unmatched = item.name === "Not currently streaming";
  const showWidth = `${Math.max(shows > 0 ? 6 : 0, (shows / max) * 100)}%`;
  const movieWidth = `${Math.max(movies > 0 ? 6 : 0, (movies / max) * 100)}%`;
  return (
    <div className="flex items-center gap-3 border-b border-border py-3.5 md:gap-4">
      <ServiceMark item={item} />
      <p
        className={`w-28 shrink-0 truncate text-ui md:w-56 ${
          unmatched ? "text-fg-muted" : "text-fg"
        }`}
      >
        {item.name}
      </p>
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {shows > 0 ? (
          <div
            className={`h-2.5 rounded-full ${unmatched ? "bg-accent" : color}`}
            style={{ width: showWidth }}
          />
        ) : null}
        {movies > 0 ? (
          <div
            className="h-2.5 rounded-full bg-chart-3"
            style={{ width: movieWidth }}
          />
        ) : null}
      </div>
      <div className="flex w-[11.75rem] shrink-0 items-center justify-end gap-2">
        {shows > 0 ? <CountPill count={shows} unit="show" /> : null}
        {movies > 0 ? <CountPill count={movies} unit="movie" /> : null}
      </div>
    </div>
  );
}

function ServiceMark({ item }: { item: MonthBar }) {
  if (item.logoUrl) {
    return (
      <span className="size-8 shrink-0 overflow-hidden rounded-full bg-bg-overlay">
        {/* biome-ignore lint/performance/noImgElement: TMDB provider logo */}
        <img alt="" className="size-full object-cover" src={item.logoUrl} />
      </span>
    );
  }
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-bg-overlay-strong text-ui text-fg-muted">
      —
    </span>
  );
}

function CountPill({ count, unit }: { count: number; unit: string }) {
  const label = count === 1 ? unit : `${unit}s`;
  return (
    <span className="rounded-full bg-bg-overlay px-2.5 py-1 text-label font-semibold uppercase tracking-label text-fg">
      {`${count} ${label}`}
    </span>
  );
}

function LegendSwatch({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <span className={`h-2 w-[18px] rounded-full ${className}`} />
      <span className="text-meta leading-meta text-fg-muted">{label}</span>
    </span>
  );
}
