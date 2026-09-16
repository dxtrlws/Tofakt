import { PosterCarousel } from "@/components/home/carousel";
import { artworkSrc } from "@/lib/media/artwork-src";
import type { MonthReview } from "@/lib/stats/month";

export function MonthPosters({
  name,
  posters,
}: {
  name: string;
  posters: MonthReview["posters"];
}) {
  if (posters.length === 0) {
    return null;
  }
  return (
    <section className="flex flex-col gap-4 px-4 md:px-8 pt-10">
      <h2 className="font-headline text-title-sm font-semibold leading-title-sm text-fg">
        Watched in {name}
      </h2>
      <PosterCarousel>
        {posters.map((poster) => (
          <div
            className="flex w-[168px] shrink-0 flex-col gap-2.5"
            key={poster.id}
          >
            <div className="relative flex h-[252px] w-[168px] flex-col justify-end overflow-hidden rounded-lg border border-border bg-accent-dim p-3">
              {poster.artworkUrl ? (
                // biome-ignore lint/performance/noImgElement: local artwork proxy
                <img
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  src={artworkSrc(poster.artworkUrl, 336, 504)}
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-bg-base/90 via-bg-base/20 to-transparent" />
              <p className="relative text-meta font-semibold leading-meta text-accent">
                {poster.overlay}
              </p>
            </div>
            <p className="truncate text-ui font-medium leading-[18px] text-fg">
              {poster.title}
            </p>
          </div>
        ))}
      </PosterCarousel>
    </section>
  );
}
