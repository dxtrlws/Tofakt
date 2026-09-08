import type { TraktHistoryBody, TraktIds } from "../trakt/history";

export type SyncCandidate = {
  eventId: string;
  kind: "movie" | "episode";
  tmdbId: number | null;
  imdbId: string | null;
  tvdbId: number | null;
  showTmdbId: number | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  watchedAt: Date;
};

export function formatWatchedAt(date: Date): string {
  return date.toISOString();
}

export function idsForCandidate(item: SyncCandidate): TraktIds {
  const ids: TraktIds = {};
  if (item.kind === "movie") {
    if (item.tmdbId) {
      ids.tmdb = item.tmdbId;
    }
    if (item.imdbId) {
      ids.imdb = item.imdbId;
    }
    if (item.tvdbId) {
      ids.tvdb = item.tvdbId;
    }
    return ids;
  }
  if (item.tmdbId) {
    ids.tmdb = item.tmdbId;
  } else if (item.imdbId) {
    ids.imdb = item.imdbId;
  } else if (item.tvdbId) {
    ids.tvdb = item.tvdbId;
  }
  return ids;
}

export function buildHistoryBody(items: SyncCandidate[]): TraktHistoryBody {
  const movies: NonNullable<TraktHistoryBody["movies"]> = [];
  const episodes: NonNullable<TraktHistoryBody["episodes"]> = [];
  const shows: NonNullable<TraktHistoryBody["shows"]> = [];
  for (const item of items) {
    const watched_at = formatWatchedAt(item.watchedAt);
    if (item.kind === "movie") {
      movies.push({ ids: idsForCandidate(item), watched_at });
      continue;
    }
    if (item.tmdbId || item.imdbId || item.tvdbId) {
      episodes.push({ ids: idsForCandidate(item), watched_at });
      continue;
    }
    if (
      item.showTmdbId &&
      item.seasonNumber != null &&
      item.episodeNumber != null
    ) {
      shows.push({
        ids: { tmdb: item.showTmdbId },
        seasons: [
          {
            number: item.seasonNumber,
            episodes: [{ number: item.episodeNumber, watched_at }],
          },
        ],
      });
    }
  }
  const body: TraktHistoryBody = {};
  if (movies.length) {
    body.movies = movies;
  }
  if (episodes.length) {
    body.episodes = episodes;
  }
  if (shows.length) {
    body.shows = shows;
  }
  return body;
}

export function candidateKey(item: SyncCandidate): string {
  const watched = formatWatchedAt(item.watchedAt);
  if (item.kind === "movie") {
    return `movie:${item.tmdbId ?? item.imdbId ?? item.tvdbId}:${watched}`;
  }
  if (item.tmdbId || item.imdbId || item.tvdbId) {
    return `episode:${item.tmdbId ?? item.imdbId ?? item.tvdbId}:${watched}`;
  }
  return `show:${item.showTmdbId}:${item.seasonNumber}:${item.episodeNumber}:${watched}`;
}
