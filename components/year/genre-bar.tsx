import type { YearGenreBar } from "@/lib/stats/year";

const COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-chart-6",
  "bg-chart-7",
];

export function YearGenreChart({
  title,
  caption,
  items,
}: {
  title: string;
  caption: string;
  items: YearGenreBar[];
}) {
  if (items.length === 0) {
    return null;
  }
  const total = Math.max(
    1,
    items.reduce((sum, item) => sum + item.plays, 0),
  );
  return (
    <section className="flex w-full flex-col gap-4 overflow-visible px-4 md:px-8 pt-10">
      <h2 className="text-label font-semibold uppercase leading-label tracking-label text-fg-muted">
        {title}
      </h2>
      <p className="max-w-[720px] text-meta leading-meta text-fg-muted">
        {caption}
      </p>
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
                {above ? <GenreLabel color={color} item={item} /> : null}
              </div>
              <div
                className={`h-4 w-full ${color} ${
                  index === 0 ? "rounded-l-full" : ""
                } ${index === items.length - 1 ? "rounded-r-full" : ""}`}
              />
              <div className="flex h-14 items-start overflow-visible">
                {above ? null : <GenreLabel color={color} item={item} />}
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

function GenreLabel({ item, color }: { item: YearGenreBar; color: string }) {
  return (
    <div className="flex w-[140px] shrink-0 items-start gap-2 overflow-visible">
      <div className={`mt-0.5 h-6 w-0.5 shrink-0 ${color}`} />
      <div className="flex min-w-0 flex-col">
        <p className="truncate text-meta font-medium leading-meta text-fg">
          {item.name}
        </p>
        <p className="text-meta leading-meta text-fg-muted">{item.caption}</p>
      </div>
    </div>
  );
}
