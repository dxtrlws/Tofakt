import type { GenreBar, GenreWatch } from "@/lib/stats/month";

const COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-chart-6",
  "bg-chart-7",
];

export function MonthGenreWatch({
  title,
  watermark,
  items,
  watch,
  unit,
}: {
  title: string;
  watermark: string;
  items: GenreBar[];
  watch: GenreWatch;
  unit: "show" | "movie";
}) {
  if (items.length === 0) {
    return null;
  }
  const total = Math.max(
    1,
    items.reduce((sum, item) => sum + item.plays, 0),
  );
  return (
    <section className="relative mx-4 mt-10 flex flex-col gap-8 overflow-visible rounded-xl bg-bg-raised px-5 py-8 md:mx-8 md:px-8">
      <p
        aria-hidden
        className="pointer-events-none absolute top-6 left-4 max-w-full overflow-hidden font-headline text-[72px] font-semibold leading-none tracking-title text-fg/[0.045] select-none md:left-8 md:text-[96px]"
      >
        {watermark}
      </p>
      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <h2 className="max-w-[10ch] whitespace-pre-line font-headline text-title font-semibold leading-[1.05] tracking-title text-fg md:text-stat md:leading-stat">
          {title}
        </h2>
        <div className="flex min-w-[240px] flex-col gap-3 lg:w-[360px] lg:shrink-0">
          {watch.most ? (
            <WatchStat label="Most Watched" unit={unit} value={watch.most} />
          ) : null}
          {watch.least ? (
            <WatchStat label="Least Watched" unit={unit} value={watch.least} />
          ) : null}
          <div className="flex items-center justify-between gap-4">
            <p className="text-ui text-fg-muted">Genre Count</p>
            <p className="text-ui font-medium text-fg">{watch.count}</p>
          </div>
        </div>
      </div>
      <div className="flex h-32 w-full overflow-x-auto overflow-y-visible">
        {items.map((item, index) => {
          const color =
            item.name === "Other"
              ? "bg-chart-8"
              : (COLORS[index % COLORS.length] ?? "bg-chart-1");
          const above = index % 2 === 0;
          return (
            <div
              className="flex min-w-0 flex-col"
              key={item.name}
              style={{ flexGrow: item.plays, flexBasis: 0 }}
            >
              <div className="flex h-14 items-end overflow-visible">
                {above ? (
                  <GenreLabel color={color} item={item} unit={unit} />
                ) : null}
              </div>
              <div
                className={`h-4 w-full ${color} ${
                  index === 0 ? "rounded-l-full" : ""
                } ${index === items.length - 1 ? "rounded-r-full" : ""}`}
              />
              <div className="flex h-14 items-start overflow-visible">
                {above ? null : (
                  <GenreLabel color={color} item={item} unit={unit} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="sr-only">
        {`${items.length} genres. Shares based on ${total} unique-title genre hits.`}
      </p>
    </section>
  );
}

function WatchStat({
  label,
  unit,
  value,
}: {
  label: string;
  unit: "show" | "movie";
  value: { name: string; count: number };
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-ui text-fg-muted">{label}</p>
      <div className="flex items-center gap-2">
        <p className="text-ui font-medium text-chart-4">{value.name}</p>
        <CountPill count={value.count} unit={unit} />
      </div>
    </div>
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

function GenreLabel({
  item,
  color,
  unit,
}: {
  item: GenreBar;
  color: string;
  unit: "show" | "movie";
}) {
  const caption =
    item.name === "Other"
      ? item.caption
      : `${item.plays} ${item.plays === 1 ? unit : `${unit}s`}`;
  return (
    <div className="flex w-[140px] shrink-0 items-start gap-2 overflow-visible">
      <div className={`mt-0.5 h-6 w-0.5 shrink-0 ${color}`} />
      <div className="flex min-w-0 flex-col">
        <p className="truncate text-meta font-medium leading-meta text-fg">
          {item.name}
        </p>
        <p className="text-meta leading-meta text-fg-muted">{caption}</p>
      </div>
    </div>
  );
}
