import { tmdbDetails } from "./client";

const TTL_MS = 24 * 60 * 60 * 1000;

export type TmdbNamedOrg = {
  name: string;
  logoPath: string | null;
};

export type TmdbTitleMeta = {
  poster: string | null;
  backdrop: string | null;
  networks: string[];
  companies: string[];
  networkOrgs: TmdbNamedOrg[];
  companyOrgs: TmdbNamedOrg[];
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

function namedOrgs(
  rows: Array<{ name: string; logo_path?: string | null }> | undefined,
): TmdbNamedOrg[] {
  const out: TmdbNamedOrg[] = [];
  const seen = new Set<string>();
  for (const row of rows ?? []) {
    const name = row.name.trim();
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    out.push({ name, logoPath: row.logo_path ?? null });
  }
  return out;
}

function emptyMeta(at = Date.now()): CachedArt {
  return {
    poster: null,
    backdrop: null,
    networks: [],
    companies: [],
    networkOrgs: [],
    companyOrgs: [],
    at,
  };
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
      networkOrgs: hit.networkOrgs ?? [],
      companyOrgs: hit.companyOrgs ?? [],
      at: hit.at,
    };
  }
  try {
    const details = await tmdbDetails(key, kind, tmdbId);
    const networkOrgs = namedOrgs(details.networks);
    const companyOrgs = namedOrgs(details.production_companies);
    const entry = {
      poster: tmdbImageUrl(details.poster_path),
      backdrop: tmdbImageUrl(details.backdrop_path, "w1280"),
      networks: networkOrgs.map((org) => org.name),
      companies: companyOrgs.map((org) => org.name),
      networkOrgs,
      companyOrgs,
      at: Date.now(),
    };
    cache.set(cacheKey, entry);
    return entry;
  } catch {
    const entry = emptyMeta();
    cache.set(cacheKey, entry);
    return entry;
  }
}
