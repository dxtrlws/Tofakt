import { z } from "zod";
import { fetchJson, UpstreamError } from "../net/fetch-json";
import { traktApiBase } from "../upstream";

const deviceCodeSchema = z.object({
  device_code: z.string(),
  user_code: z.string(),
  verification_url: z.string(),
  expires_in: z.number(),
  interval: z.number(),
});

const tokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number().optional(),
  token_type: z.string().optional(),
  created_at: z.number().optional(),
});

const settingsSchema = z.object({
  user: z
    .object({
      username: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
});

function headers(clientId: string, accessToken?: string): HeadersInit {
  return {
    "content-type": "application/json",
    "trakt-api-version": "2",
    "trakt-api-key": clientId,
    ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
  };
}

export async function traktStartDeviceCode(clientId: string) {
  const res = await fetchJson(`${traktApiBase()}/oauth/device/code`, {
    method: "POST",
    headers: headers(clientId),
    body: JSON.stringify({ client_id: clientId }),
  });
  if (res.status >= 400) {
    throw new UpstreamError(
      "Could not start the Trakt device flow.",
      res.status,
    );
  }
  return deviceCodeSchema.parse(res.json);
}

export async function traktPollDeviceToken(
  clientId: string,
  clientSecret: string,
  deviceCode: string,
): Promise<
  | { pending: true; slowDown: boolean; denied?: boolean; expired?: boolean }
  | { pending: false; tokens: z.infer<typeof tokenSchema> }
> {
  const res = await fetchJson(`${traktApiBase()}/oauth/device/token`, {
    method: "POST",
    headers: headers(clientId),
    body: JSON.stringify({
      code: deviceCode,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (res.status === 200) {
    return { pending: false, tokens: tokenSchema.parse(res.json) };
  }
  if (res.status === 400) {
    return { pending: true, slowDown: false };
  }
  if (res.status === 429) {
    return { pending: true, slowDown: true };
  }
  if (res.status === 410) {
    return { pending: true, slowDown: false, expired: true };
  }
  if (res.status === 418) {
    return { pending: true, slowDown: false, denied: true };
  }
  throw new UpstreamError("Trakt device poll failed.", res.status);
}

export async function traktRefreshToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
) {
  const res = await fetchJson(`${traktApiBase()}/oauth/token`, {
    method: "POST",
    headers: headers(clientId),
    body: JSON.stringify({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (res.status >= 400) {
    throw new UpstreamError("Trakt token refresh failed.", res.status);
  }
  return tokenSchema.parse(res.json);
}

export async function traktUsersSettings(
  clientId: string,
  accessToken: string,
) {
  const res = await fetchJson(`${traktApiBase()}/users/settings`, {
    headers: headers(clientId, accessToken),
  });
  if (res.status >= 400) {
    throw new UpstreamError("Trakt rejected the token.", res.status);
  }
  return settingsSchema.parse(res.json);
}
