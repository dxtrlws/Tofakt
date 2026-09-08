import { z } from "zod";
import { fetchBytes, fetchJson, UpstreamError } from "../net/fetch-json";

function api(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, "")}/api/v1${path}`;
}

function authHeader(token: string): HeadersInit {
  return { authorization: `Bearer ${token}` };
}

export const playSessionSchema = z.object({
  id: z.string(),
  media_id: z.string().nullable().optional(),
  media_file_id: z.string().nullable().optional(),
  episode_id: z.string().nullable().optional(),
  title: z.string(),
  poster_path: z.string().nullable().optional(),
  media_type: z.string().nullable().optional(),
  season_number: z.number().nullable().optional(),
  episode_number: z.number().nullable().optional(),
  episode_title: z.string().nullable().optional(),
  play_method: z.string().nullable().optional(),
  duration_ms: z.number().nullable().optional(),
  position_ms: z.number().nullable().optional(),
  progress_percent: z.number().nullable().optional(),
  seconds_watched: z.number().nullable().optional(),
  started_at: z.string(),
  ended_at: z.string().nullable().optional(),
  end_reason: z.string().nullable().optional(),
  user_id: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  client_name: z.string().nullable().optional(),
  platform: z.string().nullable().optional(),
  device_model: z.string().nullable().optional(),
  device_name: z.string().nullable().optional(),
  client_version: z.string().nullable().optional(),
});

export type PlaySession = z.infer<typeof playSessionSchema>;

const historyListSchema = z.object({
  items: z.array(playSessionSchema),
  has_more: z.boolean(),
});

const episodeSchema = z.object({
  id: z.string(),
  season_id: z.string().nullish(),
  episode_number: z.number().nullish(),
  title: z.string().nullish(),
  runtime_minutes: z.number().nullish(),
  tmdb_episode_id: z.number().nullish(),
});

const seasonSchema = z.object({
  season_number: z.number().nullish(),
  episodes: z.array(episodeSchema).nullish(),
});

const providerIdSchema = z.object({
  provider: z.string(),
  provider_id: z.string(),
});

export const mediaDetailSchema = z.object({
  id: z.string(),
  library_id: z.string().nullish(),
  media_type: z.string().nullish(),
  title: z.string(),
  sort_title: z.string().nullish(),
  runtime_minutes: z.number().nullish(),
  tmdb_id: z.number().nullish(),
  imdb_id: z.string().nullish(),
  release_date: z.string().nullish(),
  year: z.union([z.string(), z.number()]).nullish(),
  genres: z.array(z.string()).nullish(),
  provider_ids: z.array(providerIdSchema).nullish(),
  seasons: z.array(seasonSchema).nullish(),
});

export type MediaDetail = z.infer<typeof mediaDetailSchema>;

const imageTokenSchema = z.object({
  token: z.string(),
  expires_in: z.number(),
});

export async function tofaWatchHistory(
  baseUrl: string,
  token: string,
  opts: { limit: number; before?: string; admin?: boolean; userId?: string },
): Promise<{ items: PlaySession[]; hasMore: boolean }> {
  const path = opts.admin ? "/system/watch-history" : "/watch/history";
  const url = new URL(api(baseUrl, path));
  url.searchParams.set("limit", String(opts.limit));
  if (opts.before) {
    url.searchParams.set("before", opts.before);
  }
  if (opts.admin && opts.userId) {
    url.searchParams.set("user_id", opts.userId);
  }
  const res = await fetchJson(
    url.toString(),
    { headers: authHeader(token) },
    30_000,
  );
  if (res.status >= 400) {
    throw new UpstreamError("Could not load tofa watch history.", res.status);
  }
  const parsed = historyListSchema.parse(res.json);
  return { items: parsed.items, hasMore: parsed.has_more };
}

export async function tofaMediaBatch(
  baseUrl: string,
  token: string,
  ids: string[],
): Promise<MediaDetail[]> {
  if (ids.length === 0) {
    return [];
  }
  const res = await fetchJson(
    api(baseUrl, "/media/batch"),
    {
      method: "POST",
      headers: {
        ...authHeader(token),
        "content-type": "application/json",
      },
      body: JSON.stringify({ ids }),
    },
    30_000,
  );
  if (res.status >= 400) {
    throw new UpstreamError("Could not batch-load tofa media.", res.status);
  }
  return z.array(mediaDetailSchema).parse(res.json);
}

export async function tofaMediaDetail(
  baseUrl: string,
  token: string,
  mediaId: string,
): Promise<MediaDetail> {
  const res = await fetchJson(api(baseUrl, `/media/${mediaId}`), {
    headers: authHeader(token),
  });
  if (res.status >= 400) {
    throw new UpstreamError("Could not load tofa media.", res.status);
  }
  return mediaDetailSchema.parse(res.json);
}

export async function tofaImageToken(baseUrl: string, token: string) {
  const res = await fetchJson(api(baseUrl, "/auth/image-token"), {
    headers: authHeader(token),
  });
  if (res.status >= 400) {
    throw new UpstreamError("Could not mint a tofa image token.", res.status);
  }
  return imageTokenSchema.parse(res.json);
}

export async function tofaArtwork(
  baseUrl: string,
  imageToken: string,
  mediaId: string,
  kind: string,
  size?: { w?: number; h?: number },
) {
  const url = new URL(api(baseUrl, `/artwork/${mediaId}/${kind}`));
  url.searchParams.set("st", imageToken);
  if (size?.w) {
    url.searchParams.set("w", String(size.w));
  }
  if (size?.h) {
    url.searchParams.set("h", String(size.h));
  }
  return fetchBytes(url.toString(), {
    headers: { accept: "image/*" },
  });
}

export function findEpisode(
  detail: MediaDetail,
  episodeId: string | null | undefined,
  seasonNumber?: number | null,
  episodeNumber?: number | null,
) {
  for (const season of detail.seasons ?? []) {
    for (const episode of season.episodes ?? []) {
      if (episodeId && episode.id === episodeId) {
        return episode;
      }
      if (
        !episodeId &&
        season.season_number === seasonNumber &&
        episode.episode_number === episodeNumber
      ) {
        return episode;
      }
    }
  }
  return undefined;
}

export function yearFromMedia(detail: MediaDetail): number | null {
  if (typeof detail.year === "number" && Number.isFinite(detail.year)) {
    return detail.year;
  }
  if (typeof detail.year === "string") {
    const n = Number.parseInt(detail.year, 10);
    return Number.isFinite(n) ? n : null;
  }
  if (detail.release_date && /^\d{4}/.test(detail.release_date)) {
    return Number.parseInt(detail.release_date.slice(0, 4), 10);
  }
  return null;
}
