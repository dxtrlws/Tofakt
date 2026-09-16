import Link from "next/link";
import type { HomePoster } from "@/lib/home/types";
import { artworkSrc } from "@/lib/media/artwork-src";

export function PosterCard({ poster }: { poster: HomePoster }) {
  const inner = (
    <>
      <div className="relative flex h-[252px] w-[168px] flex-col justify-end overflow-hidden rounded-lg border border-border bg-accent-dim p-3">
        {poster.artworkUrl ? (
          // biome-ignore lint/performance/noImgElement: local artwork proxy or TMDB CDN
          <img
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            src={artworkSrc(poster.artworkUrl, 336, 504)}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-base/90 via-bg-base/20 to-transparent" />
        {poster.badge ? (
          <span
            className={`relative mb-auto self-start rounded-full px-2 py-1 text-label font-semibold leading-label ${badgeClass(poster.badgeTone)}`}
          >
            {poster.badge}
          </span>
        ) : (
          <span className="relative mb-auto" />
        )}
        {poster.overlayMuted ? (
          <div className="relative flex items-end justify-between gap-2">
            <p className="truncate text-meta font-semibold leading-meta text-accent">
              {poster.overlay}
            </p>
            <p className="shrink-0 text-meta leading-meta text-fg-muted">
              {poster.overlayMuted}
            </p>
          </div>
        ) : poster.overlay ? (
          <p className="relative text-meta font-semibold leading-meta text-accent">
            {poster.overlay}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="truncate text-ui font-medium leading-[18px] text-fg">
          {poster.title}
        </p>
        <p className="truncate text-meta leading-meta text-fg-muted">
          {poster.subtitle}
        </p>
      </div>
    </>
  );
  if (poster.href) {
    return (
      <Link
        className="flex w-[168px] shrink-0 flex-col gap-2.5"
        href={poster.href}
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className="flex w-[168px] shrink-0 flex-col gap-2.5">{inner}</div>
  );
}

function badgeClass(tone: HomePoster["badgeTone"]): string {
  switch (tone) {
    case "premiere":
      return "bg-accent/16 text-accent";
    case "finale":
      return "bg-sync-failed/16 text-sync-failed";
    default:
      return "bg-bg-overlay-strong text-fg";
  }
}
