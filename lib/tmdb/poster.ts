import { tmdbDetails } from "./client";

const TTL_MS = 24 * 60 * 60 * 1000;

export type TmdbTitleMeta = {
  poster: string | null;
  backdrop: string | null;
  networks: string[];
  companies: string[];
};

type CachedArt = TmdbTitleMeta & { at: number };

const cache = new Map<string, CachedArt>();

export function tmdbImageUrl(
  path: string | null | undefined,
  size = "w342",
): string | null {
  if (!path) {
    return null;
  }
  const file = path.startsWith("/") ? path : `/${path}`;
  return `https://image.tmdb.org/t/p/${size}${file}`;
}

export async function tmdbPosterUrl(
  key: string,
  kind: "movie" | "tv",
  tmdbId: number,
): Promise<string | null> {
  return (await tmdbArt(key, kind, tmdbId)).poster;
}

export async function tmdbBackdropUrl(
  key: string,
  kind: "movie" | "tv",
  tmdbId: number,
): Promise<string | null> {
  return (await tmdbArt(key, kind, tmdbId)).backdrop;
}

export async function tmdbTitleMeta(
  key: string,
  kind: "movie" | "tv",
  tmdbId: number,
): Promise<TmdbTitleMeta> {
  const { at: _at, ...meta } = await tmdbArt(key, kind, tmdbId);
  return meta;
}

function namedList(rows: Array<{ name: string }> | undefined): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const row of rows ?? []) {
    const name = row.name.trim();
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    names.push(name);
  }
  return names;
}

async function tmdbArt(
  key: string,
  kind: "movie" | "tv",
  tmdbId: number,
): Promise<CachedArt> {
  const cacheKey = `${kind}:${tmdbId}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return {
      poster: hit.poster,
      backdrop: hit.backdrop,
      networks: hit.networks ?? [],
      companies: hit.companies ?? [],
      at: hit.at,
    };
  }
  try {
    const details = await tmdbDetails(key, kind, tmdbId);
    const entry = {
      poster: tmdbImageUrl(details.poster_path),
      backdrop: tmdbImageUrl(details.backdrop_path, "w1280"),
      networks: namedList(details.networks),
      companies: namedList(details.production_companies),
      at: Date.now(),
    };
    cache.set(cacheKey, entry);
    return entry;
  } catch {
    const entry = {
      poster: null,
      backdrop: null,
      networks: [],
      companies: [],
      at: Date.now(),
    };
    cache.set(cacheKey, entry);
    return entry;
  }
}
