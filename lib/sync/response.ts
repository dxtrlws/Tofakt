import type { TraktPostResponse } from "../trakt/history";
import { candidateKey, type SyncCandidate } from "./payload";

export type BatchOutcome = {
  synced: string[];
  unmatched: string[];
  pending: string[];
};

type NotFoundItem = {
  ids?: { tmdb?: number; imdb?: string; tvdb?: number };
  watched_at?: string;
  seasons?: Array<{
    number?: number;
    episodes?: Array<{ number?: number; watched_at?: string }>;
  }>;
};

function notFoundKeys(response: TraktPostResponse | null): Set<string> {
  const keys = new Set<string>();
  if (!response?.not_found) {
    return keys;
  }
  for (const item of (response.not_found.movies ?? []) as NotFoundItem[]) {
    if (item.watched_at) {
      keys.add(
        `movie:${item.ids?.tmdb ?? item.ids?.imdb ?? item.ids?.tvdb}:${item.watched_at}`,
      );
    }
  }
  for (const item of (response.not_found.episodes ?? []) as NotFoundItem[]) {
    if (item.watched_at) {
      keys.add(
        `episode:${item.ids?.tmdb ?? item.ids?.imdb ?? item.ids?.tvdb}:${item.watched_at}`,
      );
    }
  }
  for (const show of (response.not_found.shows ?? []) as NotFoundItem[]) {
    for (const season of show.seasons ?? []) {
      for (const episode of season.episodes ?? []) {
        if (episode.watched_at) {
          keys.add(
            `show:${show.ids?.tmdb}:${season.number}:${episode.number}:${episode.watched_at}`,
          );
        }
      }
    }
  }
  return keys;
}

export function applyPostResponse(
  items: SyncCandidate[],
  response: TraktPostResponse | null,
): BatchOutcome {
  const missing = notFoundKeys(response);
  const unmatched: string[] = [];
  const rest: string[] = [];
  for (const item of items) {
    const key = candidateKey(item);
    if (missing.has(key)) {
      unmatched.push(item.eventId);
    } else {
      rest.push(item.eventId);
    }
  }
  const added =
    (response?.added?.movies ?? 0) + (response?.added?.episodes ?? 0);
  if (rest.length === added) {
    return { synced: rest, unmatched, pending: [] };
  }
  return { synced: [], unmatched, pending: rest };
}
