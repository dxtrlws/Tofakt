import { fetchJson } from "../net/fetch-json";
import { traktLimiter } from "./rate-limit";

const GET_RETRIES = 3;

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

export type TraktGetResult = {
  status: number;
  json: unknown;
  text: string;
  headers: Record<string, string>;
};

export async function traktFetchGet(
  url: string,
  headers: HeadersInit,
  timeoutMs = 20_000,
): Promise<TraktGetResult> {
  let last: TraktGetResult | null = null;
  for (let attempt = 0; attempt <= GET_RETRIES; attempt += 1) {
    await traktLimiter.waitGet();
    const res = await fetchJson(url, { cache: "no-store", headers }, timeoutMs);
    traktLimiter.noteGetHeaders(res.headers);
    last = res;
    if (res.status !== 429) {
      return res;
    }
    if (attempt === GET_RETRIES) {
      break;
    }
    const wait =
      retryAfterMs(res.headers) ??
      traktLimiter.retryDelayMs() ??
      1000 * 2 ** attempt;
    await traktLimiter.sleep(wait);
  }
  return last ?? { status: 429, json: null, text: "", headers: {} };
}
