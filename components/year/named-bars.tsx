import type { MonthBar } from "@/lib/stats/month";
import { formatHours } from "@/lib/stats/period";

const COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-chart-6",
  "bg-chart-7",
  "bg-chart-8",
];

export function YearNamedBars({
  title,
  caption,
  items,
  unit,
}: {
  title: string;
  caption: string;
  items: MonthBar[];
  unit: "shows" | "films" | "titles";
}) {
  if (items.length === 0) {
    return null;
  }
  const max = Math.max(...items.map((item) => item.plays), 1);
  const singular =
    unit === "shows" ? "show" : unit === "films" ? "film" : "title";
  return (
    <section className="flex w-full flex-col gap-4 px-4 md:px-8 pt-10">
      <h2 className="text-label font-semibold uppercase leading-label tracking-label text-fg-muted">
        {title}
      </h2>
      <p className="max-w-[720px] text-meta leading-meta text-fg-muted">
        {caption}
      </p>
      <div className="flex flex-col gap-2.5">
        {items.map((item, index) => (
          <div
            className="flex flex-col gap-1 md:flex-row md:items-center md:gap-3"
            key={item.name}
          >
            <p className="truncate text-ui text-fg md:w-40 md:shrink-0">
              {item.name}
            </p>
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-2.5 min-w-0 grow rounded-full bg-bg-overlay">
                <div
                  className={`h-2.5 rounded-full ${COLORS[index % COLORS.length]}`}
                  style={{
                    width: `${Math.max(4, (item.plays / max) * 100)}%`,
                  }}
                />
              </div>
              <p className="w-[7.5rem] shrink-0 text-right text-meta text-fg-muted md:w-[140px]">
                {`${item.plays} ${item.plays === 1 ? singular : unit} · ${formatHours(item.seconds)}h`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
