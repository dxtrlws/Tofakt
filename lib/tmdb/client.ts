import { z } from "zod";
import { fetchJson, UpstreamError } from "../net/fetch-json";
import { tmdbApiOrigin } from "../net/upstream";
import { shouldRetryStatus } from "../sync/backoff";

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

/** Backoff between TMDB retries; one entry per retry after the first try. */
const RETRY_DELAYS_MS = [400, 1200, 3000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function retryAfterMs(headers: Record<string, string>): number | null {
  const raw = headers["retry-after"];
  if (!raw) {
    return null;
  }
  const seconds = Number.parseFloat(raw);
  if (!Number.isFinite(seconds) || seconds < 0) {
    return null;
  }
  return Math.min(seconds * 1000, 10_000);
}

/**
 * GETs a TMDB endpoint, retrying 429s, 5xx and transport failures.
 *
 * Review pages ask for every title at once, so a burst that briefly exceeds
 * TMDB's rate limit is normal. Without a retry those titles lose their art for
 * the whole render.
 */
async function tmdbGet(
  href: string,
  headers: HeadersInit,
  label: string,
): Promise<Awaited<ReturnType<typeof fetchJson>>> {
  for (let attempt = 0; ; attempt += 1) {
    const lastTry = attempt >= RETRY_DELAYS_MS.length;
    let res: Awaited<ReturnType<typeof fetchJson>>;
    try {
      res = await fetchJson(href, { headers });
    } catch (err) {
      if (lastTry) {
        throw err;
      }
      await sleep(RETRY_DELAYS_MS[attempt]);
      continue;
    }
    if (res.status < 400) {
      return res;
    }
    if (lastTry || !shouldRetryStatus(res.status)) {
      throw new UpstreamError(`${label} failed.`, res.status);
    }
    await sleep(retryAfterMs(res.headers) ?? RETRY_DELAYS_MS[attempt]);
  }
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
  const res = await tmdbGet(href, headers, "TMDB details");
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
  const res = await tmdbGet(href, headers, "TMDB watch providers");
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
