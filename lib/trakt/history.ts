import { z } from "zod";
import { fetchJson } from "../net/fetch-json";
import { traktApiBase } from "../net/upstream";
import { traktLimiter } from "./rate-limit";

const idsSchema = z
  .object({
    trakt: z.number().nullish(),
    tmdb: z.number().nullish(),
    imdb: z.string().nullish(),
    tvdb: z.number().nullish(),
    slug: z.string().nullish(),
  })
  .passthrough();

const historyItemSchema = z
  .object({
    id: z.number().nullish(),
    watched_at: z.string(),
    action: z.string().nullish(),
    type: z.string().nullish(),
    movie: z
      .object({
        title: z.string().nullish(),
        year: z.number().nullish(),
        runtime: z.number().nullish(),
        genres: z.array(z.string()).nullish(),
        ids: idsSchema,
      })
      .passthrough()
      .nullish(),
    episode: z
      .object({
        title: z.string().nullish(),
        season: z.number().nullish(),
        number: z.number().nullish(),
        runtime: z.number().nullish(),
        episode_type: z.string().nullish(),
        ids: idsSchema.nullish(),
      })
      .passthrough()
      .nullish(),
    show: z
      .object({
        title: z.string().nullish(),
        year: z.number().nullish(),
        genres: z.array(z.string()).nullish(),
        ids: idsSchema.nullish(),
      })
      .passthrough()
      .nullish(),
  })
  .passthrough();

export function parseTraktHistoryItems(json: unknown): TraktHistoryItem[] {
  return z.array(historyItemSchema).parse(json);
}

const postResponseSchema = z
  .object({
    added: z
      .object({
        movies: z.number().optional(),
        episodes: z.number().optional(),
      })
      .optional(),
    updated: z
      .object({
        movies: z.number().optional(),
        episodes: z.number().optional(),
      })
      .optional(),
    not_found: z
      .object({
        movies: z.array(z.unknown()).optional(),
        shows: z.array(z.unknown()).optional(),
        seasons: z.array(z.unknown()).optional(),
        episodes: z.array(z.unknown()).optional(),
      })
      .optional(),
  })
  .passthrough();

const removeResponseSchema = z
  .object({
    deleted: z
      .object({
        movies: z.number().optional(),
        episodes: z.number().optional(),
      })
      .optional(),
    not_found: z
      .object({
        movies: z.array(z.unknown()).optional(),
        shows: z.array(z.unknown()).optional(),
        seasons: z.array(z.unknown()).optional(),
        episodes: z.array(z.unknown()).optional(),
        ids: z.array(z.number()).optional(),
      })
      .optional(),
  })
  .passthrough();

export type TraktHistoryItem = z.infer<typeof historyItemSchema>;
export type TraktPostResponse = z.infer<typeof postResponseSchema>;
export type TraktRemoveResponse = z.infer<typeof removeResponseSchema>;
export type TraktIds = { tmdb?: number; imdb?: string; tvdb?: number };

export type TraktHistoryBody = {
  movies?: Array<{ ids: TraktIds; watched_at: string }>;
  episodes?: Array<{ ids: TraktIds; watched_at: string }>;
  shows?: Array<{
    ids: TraktIds;
    seasons: Array<{
      number: number;
      episodes: Array<{ number: number; watched_at: string }>;
    }>;
  }>;
};

function headers(clientId: string, accessToken: string): HeadersInit {
  return {
    "content-type": "application/json",
    "trakt-api-version": "2",
    "trakt-api-key": clientId,
    authorization: `Bearer ${accessToken}`,
  };
}

export async function traktGetHistoryPage(
  clientId: string,
  accessToken: string,
  type: "movies" | "episodes",
  page: number,
  limit = 100,
  range?: { startAt?: Date; endAt?: Date; extended?: boolean },
): Promise<{
  items: TraktHistoryItem[];
  pageCount: number;
  status: number;
  headers: Record<string, string>;
}> {
  await traktLimiter.waitGet();
  const url = new URL(`${traktApiBase()}/sync/history/${type}`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(limit));
  if (range?.extended) {
    url.searchParams.set("extended", "full");
  }
  if (range?.startAt) {
    url.searchParams.set("start_at", range.startAt.toISOString());
  }
  if (range?.endAt) {
    url.searchParams.set("end_at", range.endAt.toISOString());
  }
  const res = await fetchJson(
    url.toString(),
    { cache: "no-store", headers: headers(clientId, accessToken) },
    20_000,
  );
  return {
    items: res.status === 200 ? parseTraktHistoryItems(res.json) : [],
    pageCount:
      Number.parseInt(res.headers["x-pagination-page-count"] ?? "1", 10) || 1,
    status: res.status,
    headers: res.headers,
  };
}

export async function traktHistoryInRange(
  clientId: string,
  accessToken: string,
  start: Date,
  end: Date,
  maxPages = 10,
): Promise<{ items: TraktHistoryItem[]; status: number }> {
  const items: TraktHistoryItem[] = [];
  let status = 200;
  for (const type of ["movies", "episodes"] as const) {
    let page = 1;
    let pages = 1;
    while (page <= pages && page <= maxPages) {
      const res = await traktGetHistoryPage(
        clientId,
        accessToken,
        type,
        page,
        100,
        {
          startAt: start,
          endAt: end,
          extended: true,
        },
      );
      status = res.status;
      if (res.status !== 200) {
        return { items, status };
      }
      items.push(...res.items);
      pages = res.pageCount;
      page += 1;
    }
  }
  return { items, status };
}

export async function traktGetRecentHistory(
  clientId: string,
  accessToken: string,
  limit = 12,
): Promise<{ items: TraktHistoryItem[]; status: number }> {
  await traktLimiter.waitGet();
  const url = new URL(`${traktApiBase()}/users/me/history`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("extended", "full");
  const res = await fetchJson(
    url.toString(),
    { cache: "no-store", headers: headers(clientId, accessToken) },
    20_000,
  );
  return {
    items: res.status === 200 ? parseTraktHistoryItems(res.json) : [],
    status: res.status,
  };
}

export async function traktPostHistory(
  clientId: string,
  accessToken: string,
  body: TraktHistoryBody,
): Promise<{
  status: number;
  json: TraktPostResponse | null;
  headers: Record<string, string>;
  text: string;
}> {
  await traktLimiter.waitWrite();
  const res = await fetchJson(
    `${traktApiBase()}/sync/history`,
    {
      method: "POST",
      headers: headers(clientId, accessToken),
      body: JSON.stringify(body),
    },
    30_000,
  );
  const parsed = postResponseSchema.safeParse(res.json);
  return {
    status: res.status,
    json: parsed.success ? parsed.data : null,
    headers: res.headers,
    text: res.text,
  };
}

export async function traktRemoveHistory(
  clientId: string,
  accessToken: string,
  body: { ids: number[] },
): Promise<{
  status: number;
  json: TraktRemoveResponse | null;
  headers: Record<string, string>;
  text: string;
}> {
  await traktLimiter.waitWrite();
  const res = await fetchJson(
    `${traktApiBase()}/sync/history/remove`,
    {
      method: "POST",
      headers: headers(clientId, accessToken),
      body: JSON.stringify(body),
    },
    30_000,
  );
  const parsed = removeResponseSchema.safeParse(res.json);
  return {
    status: res.status,
    json: parsed.success ? parsed.data : null,
    headers: res.headers,
    text: res.text,
  };
}

export function retryAfterMs(headers: Record<string, string>): number | null {
  const raw = headers["retry-after"];
  if (!raw) {
    return null;
  }
  const seconds = Number.parseInt(raw, 10);
  if (Number.isFinite(seconds)) {
    return seconds * 1000;
  }
  const date = Date.parse(raw);
  if (Number.isFinite(date)) {
    return Math.max(0, date - Date.now());
  }
  return null;
}
