import { z } from "zod";
import { traktApiBase } from "../net/upstream";
import { traktFetchGet } from "./fetch";

const idsSchema = z
  .object({
    trakt: z.number().nullish(),
    tmdb: z.number().nullish(),
    imdb: z.string().nullish(),
    tvdb: z.number().nullish(),
    slug: z.string().nullish(),
  })
  .passthrough();

const calendarItemSchema = z
  .object({
    first_aired: z.string(),
    episode: z
      .object({
        title: z.string().nullish(),
        season: z.number().nullish(),
        number: z.number().nullish(),
        episode_type: z.string().nullish(),
        runtime: z.number().nullish(),
        ids: idsSchema.nullish(),
      })
      .passthrough(),
    show: z
      .object({
        title: z.string().nullish(),
        year: z.number().nullish(),
        ids: idsSchema.nullish(),
      })
      .passthrough(),
  })
  .passthrough();

export type TraktCalendarItem = z.infer<typeof calendarItemSchema>;

export function parseTraktCalendarItems(json: unknown): TraktCalendarItem[] {
  return z.array(calendarItemSchema).parse(json);
}

function headers(clientId: string, accessToken: string): HeadersInit {
  return {
    "content-type": "application/json",
    "trakt-api-version": "2",
    "trakt-api-key": clientId,
    authorization: `Bearer ${accessToken}`,
  };
}

export async function traktGetShowCalendar(
  clientId: string,
  accessToken: string,
  startDate: string,
  days = 21,
): Promise<{ items: TraktCalendarItem[]; status: number }> {
  const res = await traktFetchGet(
    `${traktApiBase()}/calendars/my/shows/${startDate}/${days}?extended=full`,
    headers(clientId, accessToken),
    20_000,
  );
  return {
    items: res.status === 200 ? parseTraktCalendarItems(res.json) : [],
    status: res.status,
  };
}
