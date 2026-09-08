import { z } from "zod";
import { fetchJson, UpstreamError } from "../net/fetch-json";

const statusSchema = z.object({
  claimed: z.boolean().optional(),
  connect_url: z.string(),
  server_id: z.string(),
});

const healthSchema = z.object({
  status: z.string().optional(),
  version: z.string().optional(),
  server_id: z.string().optional(),
});

const infoSchema = z.object({
  version: z.string().optional(),
  api_version: z.number().optional(),
  capabilities: z.array(z.string()).optional(),
  server_id: z.string().optional(),
  connection_type: z.string().optional(),
});

const meSchema = z.object({
  id: z.string().optional(),
  username: z.string(),
  is_admin: z.boolean().optional(),
});

const deviceCodeSchema = z.object({
  device_code: z.string(),
  user_code: z.string(),
  verification_uri: z.string(),
  verification_uri_complete: z.string().optional(),
  expires_in: z.number(),
  interval: z.number(),
  qr_code_svg: z.string().optional(),
});

const tokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number().optional(),
  token_type: z.string().optional(),
});

function api(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, "")}/api/v1${path}`;
}

function authHeader(token: string): HeadersInit {
  return { authorization: `Bearer ${token}` };
}

export async function tofaAuthStatus(baseUrl: string) {
  const res = await fetchJson(api(baseUrl, "/auth/status"));
  if (res.status >= 400) {
    throw new UpstreamError("tofa did not answer /auth/status.", res.status);
  }
  return statusSchema.parse(res.json);
}

export async function tofaHealth(baseUrl: string) {
  const res = await fetchJson(api(baseUrl, "/health"));
  if (res.status >= 400) {
    return null;
  }
  const parsed = healthSchema.safeParse(res.json);
  return parsed.success ? parsed.data : null;
}

export async function tofaSystemInfo(baseUrl: string, token: string) {
  const res = await fetchJson(api(baseUrl, "/system/info"), {
    headers: authHeader(token),
  });
  if (res.status >= 400) {
    throw new UpstreamError(
      "tofa rejected the token on /system/info.",
      res.status,
    );
  }
  return infoSchema.parse(res.json);
}

export async function tofaUsersMe(baseUrl: string, token: string) {
  const res = await fetchJson(api(baseUrl, "/users/me"), {
    headers: authHeader(token),
  });
  if (res.status >= 400) {
    throw new UpstreamError(
      "tofa rejected the token on /users/me.",
      res.status,
    );
  }
  return meSchema.parse(res.json);
}

export async function tofaStartDeviceCode(
  connectUrl: string,
  serverId: string,
) {
  const res = await fetchJson(`${connectUrl.replace(/\/$/, "")}/device/code`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      server_id: serverId,
      client_name: "Watchlog",
      client_type: "script",
    }),
  });
  if (res.status >= 400) {
    throw new UpstreamError(
      "Could not start the tofa device flow.",
      res.status,
    );
  }
  return deviceCodeSchema.parse(res.json);
}

export async function tofaPollDeviceToken(
  connectUrl: string,
  deviceCode: string,
): Promise<
  | { pending: true; slowDown: boolean }
  | { pending: false; tokens: z.infer<typeof tokenSchema> }
> {
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    device_code: deviceCode,
  });
  const res = await fetchJson(`${connectUrl.replace(/\/$/, "")}/device/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (res.status === 400 || res.status === 428) {
    const err =
      res.json && typeof res.json === "object"
        ? (res.json as { error?: string }).error
        : undefined;
    if (err === "slow_down") {
      return { pending: true, slowDown: true };
    }
    return { pending: true, slowDown: false };
  }
  if (res.status >= 400) {
    throw new UpstreamError(
      "tofa device poll failed.",
      res.status,
      errorCode(res.json),
    );
  }
  return { pending: false, tokens: tokenSchema.parse(res.json) };
}

export async function tofaRefreshDeviceToken(
  connectUrl: string,
  serverId: string,
  refreshToken: string,
) {
  const res = await fetchJson(
    `${connectUrl.replace(/\/$/, "")}/servers/${serverId}/device-token/refresh`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    },
  );
  if (res.status >= 400) {
    throw new UpstreamError("tofa token refresh failed.", res.status);
  }
  return tokenSchema.parse(res.json);
}

const librarySchema = z.object({
  id: z.string(),
  name: z.string(),
  media_type: z.string().optional(),
});

export async function tofaLibraries(baseUrl: string, token: string) {
  const res = await fetchJson(api(baseUrl, "/libraries"), {
    headers: authHeader(token),
  });
  if (res.status >= 400) {
    throw new UpstreamError("Could not load tofa libraries.", res.status);
  }
  return z.array(librarySchema).parse(res.json);
}

function errorCode(json: unknown): string | undefined {
  if (json && typeof json === "object" && "error" in json) {
    const value = (json as { error?: unknown }).error;
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}
