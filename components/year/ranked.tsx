import type { MonthRanked as RankedTitle } from "@/lib/stats/month";

const TINTS = ["bg-bg-overlay", "bg-bg-overlay-strong", "bg-[#12282E]"];

export function YearTop10({
  title,
  items,
}: {
  title: string;
  items: RankedTitle[];
}) {
  if (items.length === 0) {
    return null;
  }
  const left = items.slice(0, 5);
  const right = items.slice(5, 10);
  return (
    <section className="flex w-full flex-col gap-5 px-4 md:px-8 pt-10">
      <h2 className="whitespace-pre-line font-headline text-title font-semibold leading-[1.05] tracking-title text-fg md:text-stat md:leading-stat">
        {title}
      </h2>
      <div className="flex w-full flex-col gap-5 lg:flex-row">
        <RankedColumn items={left} start={0} />
        {right.length > 0 ? <RankedColumn items={right} start={5} /> : null}
      </div>
    </section>
  );
}

function RankedColumn({
  items,
  start,
}: {
  items: RankedTitle[];
  start: number;
}) {
  return (
    <div className="flex min-w-0 grow basis-0 flex-col gap-3">
      {items.map((item, index) => (
        <RankedRow index={start + index} item={item} key={item.title} />
      ))}
    </div>
  );
}

function RankedRow({ item, index }: { item: RankedTitle; index: number }) {
  return (
    <div className="relative flex w-full items-center gap-3 overflow-clip rounded-md bg-accent-dim px-3 py-[10px]">
      {item.backdropUrl ? (
        // biome-ignore lint/performance/noImgElement: TMDB CDN or local artwork proxy
        <img
          alt=""
          className="absolute top-0 left-[38%] h-full w-[62%] object-cover"
          src={mediaSrc(item.backdropUrl, 640, 160)}
        />
      ) : (
        <div
          className={`absolute top-0 left-[38%] h-full w-[62%] ${TINTS[index % TINTS.length]}`}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-accent-dim from-[38%] via-accent-dim/75 to-accent-dim/50" />
      <span className="relative w-5 shrink-0 text-ui font-semibold text-fg-muted">
        {index + 1}
      </span>
      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-sm bg-bg-overlay">
        {item.artworkUrl ? (
          // biome-ignore lint/performance/noImgElement: local artwork proxy
          <img
            alt=""
            className="h-full w-full object-cover"
            src={mediaSrc(item.artworkUrl, 80, 112)}
          />
        ) : null}
      </div>
      <div className="relative min-w-0 grow">
        <p className="truncate text-body font-semibold leading-[18px] text-fg">
          {item.title}
        </p>
        <p
          className={`text-meta ${item.unmatched ? "text-sync-unmatched" : "text-fg-muted"}`}
        >
          <span className="md:hidden">
            {`${item.plays} ${item.plays === 1 ? "play" : "plays"} · ${item.hoursLabel}h`}
            {item.note ? ` · ${item.note}` : ""}
          </span>
          <span className="hidden md:inline">{item.note}</span>
        </p>
      </div>
      <p className="relative hidden w-[120px] shrink-0 text-right text-meta text-fg-muted md:block">
        {`${item.plays} ${item.plays === 1 ? "play" : "plays"} · ${item.hoursLabel}h`}
      </p>
    </div>
  );
}

function mediaSrc(url: string, w: number, h: number): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${url}${url.includes("?") ? "&" : "?"}w=${String(w)}&h=${String(h)}`;
}
