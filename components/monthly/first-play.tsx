import type { MonthMoment } from "@/lib/stats/month";

export function MonthMomentCard({
  moment,
  label,
  accent,
  size = "feature",
  unmatched,
  heading: Heading = "h2",
  className,
}: {
  moment: MonthMoment;
  label: string;
  accent?: boolean;
  size?: "feature" | "ranked";
  unmatched?: boolean;
  heading?: "h2" | "h3";
  className?: string;
}) {
  const featured = size === "feature";
  return (
    <section
      className={
        className ??
        "relative mx-4 mt-5 flex items-end gap-3 overflow-hidden md:mx-8 md:mt-10 md:rounded-xl md:border md:border-border"
      }
    >
      {moment.backdropUrl ? (
        // biome-ignore lint/performance/noImgElement: TMDB CDN or local artwork proxy
        <img
          alt=""
          className="absolute inset-0 hidden size-full object-cover md:block"
          src={mediaSrc(moment.backdropUrl, 1280, 720)}
        />
      ) : (
        <div className="absolute inset-0 hidden bg-bg-raised md:block" />
      )}
      <div className="absolute inset-0 hidden bg-gradient-to-r from-bg-base via-bg-base/78 to-bg-base/25 md:block" />
      <div
        className={`relative flex min-h-0 w-full items-end gap-3 md:items-end md:p-6 ${
          featured ? "md:min-h-[280px] md:gap-8" : "md:min-h-[200px] md:gap-6"
        }`}
      >
        <div
          className={`relative shrink-0 overflow-hidden rounded-md bg-accent-dim md:rounded-lg md:border md:border-border ${
            featured
              ? "h-[108px] w-[72px] md:h-[222px] md:w-[148px]"
              : "h-[108px] w-[72px] md:h-[168px] md:w-[112px]"
          }`}
        >
          {moment.artworkUrl ? (
            // biome-ignore lint/performance/noImgElement: local artwork proxy or TMDB CDN
            <img
              alt=""
              className="h-full w-full object-cover"
              src={mediaSrc(
                moment.artworkUrl,
                featured ? 296 : 224,
                featured ? 444 : 336,
              )}
            />
          ) : null}
        </div>
        <div className="flex min-w-0 grow basis-0 flex-col gap-1 pb-1 md:gap-2">
          <p
            className={`text-label font-semibold uppercase leading-label tracking-label ${
              accent ? "text-accent" : "text-fg-muted"
            }`}
          >
            {label}
          </p>
          <Heading
            className={`font-headline font-semibold text-fg ${
              featured
                ? "text-title-sm leading-title-sm md:text-display md:font-bold md:leading-display md:tracking-display"
                : "text-title-sm leading-title-sm md:text-title md:leading-title md:tracking-title"
            }`}
          >
            {moment.title}
          </Heading>
          <p
            className={`text-meta leading-meta md:hidden ${
              unmatched ? "text-sync-unmatched" : "text-fg-muted"
            }`}
          >
            {moment.line}
          </p>
          <p
            className={`hidden text-body font-medium leading-body md:block ${
              unmatched ? "text-sync-unmatched" : "text-fg"
            }`}
          >
            {moment.line}
          </p>
          <p className="hidden text-ui leading-ui text-fg-muted md:block">
            {moment.when}
          </p>
        </div>
      </div>
    </section>
  );
}

function mediaSrc(url: string, w: number, h: number): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${url}${url.includes("?") ? "&" : "?"}w=${String(w)}&h=${String(h)}`;
}
