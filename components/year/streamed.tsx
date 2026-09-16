import { MonthMomentCard } from "@/components/monthly/first-play";
import { YearNamedBars } from "@/components/year/named-bars";
import { YearTop10 } from "@/components/year/ranked";
import { loadYearArt, loadYearOrgs } from "@/lib/stats/year";

type Props = { year: number; nowMs: number };

/* Artwork: about thirty TMDB lookups, so these land first. */

export async function YearFirstMoment({ year, nowMs }: Props) {
  const review = await loadYearArt(year, nowMs);
  if (!review.first) {
    return null;
  }
  return <MonthMomentCard accent label="First play" moment={review.first} />;
}

export async function YearBingeMoment({ year, nowMs }: Props) {
  const review = await loadYearArt(year, nowMs);
  if (!review.binge) {
    return null;
  }
  return <MonthMomentCard accent label="Longest binge" moment={review.binge} />;
}

export async function YearLastMoment({ year, nowMs }: Props) {
  const review = await loadYearArt(year, nowMs);
  if (!review.last) {
    return null;
  }
  return <MonthMomentCard label="Last play" moment={review.last} />;
}

export async function YearTopShowsSection({ year, nowMs }: Props) {
  const review = await loadYearArt(year, nowMs);
  return <YearTop10 items={review.topShows} title={"Top 10 Watched\nShows"} />;
}

export async function YearTopMoviesSection({ year, nowMs }: Props) {
  const review = await loadYearArt(year, nowMs);
  return (
    <YearTop10 items={review.topMovies} title={"Top 10 Watched\nMovies"} />
  );
}

/* Networks and studios: one TMDB lookup per distinct title, so these land last. */

export async function YearNetworks({ year, nowMs }: Props) {
  const review = await loadYearOrgs(year, nowMs);
  return (
    <YearNamedBars
      caption="Original networks from TMDB. A show counts once, even if it moved networks mid-run."
      countLabel="networks"
      items={review.tvNetworks}
      title={"TV\nNetworks"}
      unit="show"
    />
  );
}

export async function YearStudios({ year, nowMs }: Props) {
  const review = await loadYearOrgs(year, nowMs);
  return (
    <YearNamedBars
      caption="Production studios from TMDB. A film can count under more than one studio."
      countLabel="studios"
      items={review.movieStudios}
      title={"Movie\nStudios"}
      unit="film"
    />
  );
}
