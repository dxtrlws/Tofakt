import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { tmdbTitleCache } from "../db/schema";
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
  const cacheKey = `org-logos-v1:${kind}:${tmdbId}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return copyArt(hit);
  }
  const stored = readStoredArt(kind, tmdbId);
  if (stored && Date.now() - stored.at < TTL_MS) {
    cache.set(cacheKey, stored);
    return copyArt(stored);
  }
  try {
    const details = await tmdbDetails(key, kind, tmdbId);
    const networkOrgs = namedOrgs(details.networks);
    const companyOrgs = namedOrgs(details.production_companies);
    const entry: CachedArt = {
      poster: tmdbImageUrl(details.poster_path),
      backdrop: tmdbImageUrl(details.backdrop_path, "w1280"),
      networks: networkOrgs.map((org) => org.name),
      companies: companyOrgs.map((org) => org.name),
      networkOrgs,
      companyOrgs,
      at: Date.now(),
    };
    cache.set(cacheKey, entry);
    writeStoredArt(kind, tmdbId, entry);
    return copyArt(entry);
  } catch {
    const entry = emptyMeta();
    cache.set(cacheKey, entry);
    return entry;
  }
}

function copyArt(hit: CachedArt): CachedArt {
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

function readStoredArt(kind: "movie" | "tv", tmdbId: number): CachedArt | null {
  try {
    const row = getDb()
      .select()
      .from(tmdbTitleCache)
      .where(eq(tmdbTitleCache.id, `${kind}:${tmdbId}`))
      .get();
    if (!row) {
      return null;
    }
    const at =
      row.fetchedAt instanceof Date
        ? row.fetchedAt.getTime()
        : Number(row.fetchedAt);
    return {
      poster: row.poster,
      backdrop: row.backdrop,
      networks: parseJsonArray(row.networksJson),
      companies: parseJsonArray(row.companiesJson),
      networkOrgs: parseOrgs(row.networkOrgsJson),
      companyOrgs: parseOrgs(row.companyOrgsJson),
      at,
    };
  } catch {
    return null;
  }
}

function writeStoredArt(
  kind: "movie" | "tv",
  tmdbId: number,
  entry: CachedArt,
): void {
  const id = `${kind}:${tmdbId}`;
  const values = {
    id,
    kind,
    tmdbId,
    poster: entry.poster,
    backdrop: entry.backdrop,
    networksJson: JSON.stringify(entry.networks),
    companiesJson: JSON.stringify(entry.companies),
    networkOrgsJson: JSON.stringify(entry.networkOrgs),
    companyOrgsJson: JSON.stringify(entry.companyOrgs),
    fetchedAt: new Date(entry.at),
  };
  try {
    const existing = getDb()
      .select({ id: tmdbTitleCache.id })
      .from(tmdbTitleCache)
      .where(eq(tmdbTitleCache.id, id))
      .get();
    if (existing) {
      getDb()
        .update(tmdbTitleCache)
        .set(values)
        .where(eq(tmdbTitleCache.id, id))
        .run();
      return;
    }
    getDb().insert(tmdbTitleCache).values(values).run();
  } catch {
    // Cache writes must not break page loads.
  }
}

function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function parseOrgs(raw: string): TmdbNamedOrg[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }
      const row = item as { name?: unknown; logoPath?: unknown };
      if (typeof row.name !== "string" || !row.name.trim()) {
        return [];
      }
      return [
        {
          name: row.name,
          logoPath: typeof row.logoPath === "string" ? row.logoPath : null,
        },
      ];
    });
  } catch {
    return [];
  }
}
