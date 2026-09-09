import type { MonthBar } from "@/lib/stats/month";

const BAR_COLORS = [
  "bg-accent",
  "bg-chart-2",
  "bg-chart-7",
  "bg-chart-5",
  "bg-chart-4",
  "bg-chart-6",
];

export function YearNamedBars({
  eyebrow,
  title,
  caption,
  items,
  unit,
  countLabel,
}: {
  eyebrow?: string;
  title: string;
  caption?: string;
  items: MonthBar[];
  unit: "show" | "movie" | "film";
  countLabel: string;
}) {
  if (items.length === 0) {
    return null;
  }
  const rows = [...items].sort((a, b) => {
    if (a.name === "Not currently streaming") {
      return 1;
    }
    if (b.name === "Not currently streaming") {
      return -1;
    }
    return b.plays - a.plays || a.name.localeCompare(b.name);
  });
  const namedCount = rows.filter(
    (item) => item.name !== "Not currently streaming",
  ).length;
  const max = Math.max(...rows.map((item) => item.plays), 1);
  return (
    <section className="flex flex-col gap-8 px-4 md:px-8 pt-10">
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          {eyebrow ? (
            <p className="text-label font-semibold uppercase leading-label tracking-label text-fg-muted">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="whitespace-pre-line font-headline text-title font-semibold leading-[1.05] tracking-title text-fg md:text-stat md:leading-stat">
            {title}
          </h2>
        </div>
        <div className="flex flex-col items-end gap-1 pb-1">
          <p className="font-headline text-stat font-semibold leading-stat tracking-display text-accent">
            {String(namedCount).padStart(2, "0")}
          </p>
          <p className="text-meta leading-meta text-fg-muted">{countLabel}</p>
        </div>
      </div>
      <div className="flex flex-col">
        {rows.map((item, index) => (
          <NamedRail
            color={BAR_COLORS[index % BAR_COLORS.length] ?? "bg-accent"}
            item={item}
            key={item.name}
            max={max}
            unit={unit}
          />
        ))}
      </div>
      {caption ? (
        <p className="max-w-[720px] text-meta leading-meta text-fg-subtle">
          {caption}
        </p>
      ) : null}
    </section>
  );
}

function NamedRail({
  item,
  max,
  color,
  unit,
}: {
  item: MonthBar;
  max: number;
  color: string;
  unit: "show" | "movie" | "film";
}) {
  const unmatched = item.name === "Not currently streaming";
  const count = item.plays;
  const width = `${Math.max(count > 0 ? 6 : 0, (count / max) * 100)}%`;
  return (
    <div className="flex items-center gap-3 border-b border-border py-3.5 md:gap-4">
      <OrgMark item={item} />
      <p
        className={`w-28 shrink-0 truncate text-ui md:w-56 ${
          unmatched ? "text-fg-muted" : "text-fg"
        }`}
      >
        {item.name}
      </p>
      <div className="flex min-w-0 flex-1 items-center">
        {count > 0 ? (
          <div
            className={`h-2.5 rounded-full ${unmatched ? "bg-chart-8" : color}`}
            style={{ width }}
          />
        ) : null}
      </div>
      <div className="flex w-[11.75rem] shrink-0 items-center justify-end gap-2">
        {count > 0 ? <CountPill count={count} unit={unit} /> : null}
      </div>
    </div>
  );
}

function OrgMark({ item }: { item: MonthBar }) {
  if (item.logoUrl) {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-inverse p-1.5">
        {/* biome-ignore lint/performance/noImgElement: TMDB network/studio/provider logo */}
        <img
          alt=""
          className="max-h-full max-w-full object-contain"
          src={item.logoUrl}
        />
      </span>
    );
  }
  if (item.name === "Not currently streaming") {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-bg-overlay-strong text-ui text-fg-muted">
        —
      </span>
    );
  }
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-bg-overlay text-meta font-semibold uppercase text-fg">
      {item.name.slice(0, 1)}
    </span>
  );
}

function CountPill({
  count,
  unit,
}: {
  count: number;
  unit: "show" | "movie" | "film";
}) {
  const singular = unit;
  const plural =
    unit === "show" ? "shows" : unit === "movie" ? "movies" : "films";
  const label = count === 1 ? singular : plural;
  return (
    <span className="rounded-full bg-bg-overlay px-2.5 py-1 text-label font-semibold uppercase tracking-label text-fg">
      {`${count} ${label}`}
    </span>
  );
}
