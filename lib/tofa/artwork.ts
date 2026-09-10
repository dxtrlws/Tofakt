import { getSettingJson, setSettingJson } from "../data/settings";
import { tofaArtwork, tofaImageToken } from "./history";

type CachedToken = {
  token: string;
  expiresAt: number;
};

const KINDS = new Set(["poster", "backdrop", "backdrop_thumb", "logo"]);

export function isArtworkKind(kind: string): boolean {
  return KINDS.has(kind);
}

export function isMediaUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function fetchTofaArtwork(opts: {
  baseUrl: string;
  accessToken: string;
  mediaId: string;
  kind: string;
  w?: number;
  h?: number;
}) {
  const token = await imageToken(opts.baseUrl, opts.accessToken);
  let result = await tofaArtwork(opts.baseUrl, token, opts.mediaId, opts.kind, {
    w: opts.w,
    h: opts.h,
  });
  if (result.status === 401 || result.status === 403) {
    const fresh = await imageToken(opts.baseUrl, opts.accessToken, true);
    result = await tofaArtwork(opts.baseUrl, fresh, opts.mediaId, opts.kind, {
      w: opts.w,
      h: opts.h,
    });
  }
  return result;
}

async function imageToken(
  baseUrl: string,
  accessToken: string,
  force = false,
): Promise<string> {
  const cached = getSettingJson<CachedToken>("tofa.image_token");
  if (!force && cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }
  const minted = await tofaImageToken(baseUrl, accessToken);
  setSettingJson("tofa.image_token", {
    token: minted.token,
    expiresAt: Date.now() + minted.expires_in * 1000,
  });
  return minted.token;
}
