import { z } from "zod";
import { fetchJson, UpstreamError } from "../net/fetch-json";
import { tmdbApiOrigin } from "../upstream";

const authSchema = z.object({
  success: z.boolean().optional(),
  status_message: z.string().optional(),
});

const genreSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const namedSchema = z.object({
  name: z.string(),
  logo_path: z.string().nullable().optional(),
});

const detailsSchema = z.object({
  id: z.number().optional(),
  poster_path: z.string().nullable().optional(),
  backdrop_path: z.string().nullable().optional(),
  runtime: z.number().nullable().optional(),
  episode_run_time: z.array(z.number()).optional(),
  genres: z.array(genreSchema).optional(),
  networks: z.array(namedSchema).optional(),
  production_companies: z.array(namedSchema).optional(),
});

const providerEntrySchema = z.object({
  provider_id: z.number(),
  provider_name: z.string(),
  logo_path: z.string().nullable().optional(),
});

const regionProvidersSchema = z.object({
  flatrate: z.array(providerEntrySchema).optional(),
  rent: z.array(providerEntrySchema).optional(),
  buy: z.array(providerEntrySchema).optional(),
  ads: z.array(providerEntrySchema).optional(),
  free: z.array(providerEntrySchema).optional(),
});

const watchProvidersSchema = z.object({
  results: z.record(z.string(), regionProvidersSchema).optional(),
});

function authFor(key: string): { url: URL; headers: HeadersInit } {
  const trimmed = key.trim();
  const useBearer = trimmed.startsWith("eyJ");
  const url = new URL(`${tmdbApiOrigin()}/3/`);
  const headers: HeadersInit = useBearer
    ? { authorization: `Bearer ${trimmed}` }
    : {};
  if (!useBearer) {
    url.searchParams.set("api_key", trimmed);
  }
  return { url, headers };
}

function tmdbUrl(key: string, path: string, extra?: Record<string, string>) {
  const { url, headers } = authFor(key);
  url.pathname = `/3${path}`;
  if (extra) {
    for (const [name, value] of Object.entries(extra)) {
      url.searchParams.set(name, value);
    }
  }
  return { href: url.toString(), headers };
}

export async function tmdbValidateKey(key: string) {
  const trimmed = key.trim();
  const useBearer = trimmed.startsWith("eyJ");
  const origin = tmdbApiOrigin();
  const url = useBearer
    ? `${origin}/3/authentication`
    : `${origin}/3/authentication?api_key=${encodeURIComponent(trimmed)}`;
  const res = await fetchJson(url, {
    headers: useBearer ? { authorization: `Bearer ${trimmed}` } : {},
  });
  if (res.status >= 400) {
    throw new UpstreamError("TMDB rejected that key.", res.status);
  }
  const parsed = authSchema.safeParse(res.json);
  if (parsed.success && parsed.data.success === false) {
    throw new UpstreamError("TMDB rejected that key.", res.status);
  }
  return parsed.success ? parsed.data : { success: true };
}

export async function tmdbDetails(
  key: string,
  kind: "movie" | "tv",
  tmdbId: number,
) {
  const { href, headers } = tmdbUrl(key, `/${kind}/${tmdbId}`);
  const res = await fetchJson(href, { headers });
  if (res.status >= 400) {
    throw new UpstreamError("TMDB details failed.", res.status);
  }
  return detailsSchema.parse(res.json);
}

export type TmdbProvider = {
  providerId: number;
  providerName: string;
  logoPath: string | null;
  monetizationType: "flatrate" | "rent" | "buy" | "ads" | "free";
};

export async function tmdbWatchProviders(
  key: string,
  kind: "movie" | "tv",
  tmdbId: number,
  region: string,
): Promise<TmdbProvider[]> {
  const { href, headers } = tmdbUrl(key, `/${kind}/${tmdbId}/watch/providers`);
  const res = await fetchJson(href, { headers });
  if (res.status >= 400) {
    throw new UpstreamError("TMDB watch providers failed.", res.status);
  }
  const parsed = watchProvidersSchema.parse(res.json);
  const bucket = parsed.results?.[region.toUpperCase()];
  if (!bucket) {
    return [];
  }
  const out: TmdbProvider[] = [];
  const types = ["flatrate", "rent", "buy", "ads", "free"] as const;
  for (const type of types) {
    for (const entry of bucket[type] ?? []) {
      out.push({
        providerId: entry.provider_id,
        providerName: entry.provider_name,
        logoPath: entry.logo_path ?? null,
        monetizationType: type,
      });
    }
  }
  return out;
}
