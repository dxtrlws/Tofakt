import { MonthMomentCard } from "@/components/monthly/first-play";
import { MonthPosters } from "@/components/monthly/posters";
import { MonthTopFive } from "@/components/monthly/ranked";
import { loadMonthArt } from "@/lib/stats/month";

/**
 * Sections that wait on TMDB. They all read the same cached artwork pass, so
 * the page makes one round of lookups no matter how many of these render.
 */
type Props = { monthKey: string; nowMs: number };

export async function MonthOpeningMoment({ monthKey, nowMs }: Props) {
  const review = await loadMonthArt(monthKey, nowMs);
  if (!review.first) {
    return null;
  }
  return (
    <MonthMomentCard
      accent
      label="How the month opened"
      moment={review.first}
    />
  );
}

export async function MonthClosingMoment({ monthKey, nowMs }: Props) {
  const review = await loadMonthArt(monthKey, nowMs);
  if (!review.last) {
    return null;
  }
  return <MonthMomentCard label="Last play" moment={review.last} />;
}

export async function MonthPosterRail({ monthKey, nowMs }: Props) {
  const review = await loadMonthArt(monthKey, nowMs);
  return <MonthPosters name={review.name} posters={review.posters} />;
}

export async function MonthTopShows({ monthKey, nowMs }: Props) {
  const review = await loadMonthArt(monthKey, nowMs);
  return <MonthTopFive items={review.topShows} label="Most watched TV show" />;
}

export async function MonthTopMovies({ monthKey, nowMs }: Props) {
  const review = await loadMonthArt(monthKey, nowMs);
  return <MonthTopFive items={review.topMovies} label="Most watched movie" />;
}
