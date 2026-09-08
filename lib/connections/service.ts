import { env } from "../env";
import { logger } from "../logger";
import { LOOPBACK_HINT, parseTofaBaseUrl } from "../net/ssrf";
import { tmdbValidateKey } from "../tmdb/client";
import {
  tofaAuthStatus,
  tofaRefreshDeviceToken,
  tofaSystemInfo,
  tofaUsersMe,
} from "../tofa/client";
import { traktRefreshToken, traktUsersSettings } from "../trakt/client";
import {
  type ConnectionRow,
  getConnection,
  mergeExtra,
  needsProactiveRefresh,
  parseExtra,
  readAccessToken,
  readRefreshToken,
  readTraktAppSecrets,
  saveSecret,
  saveTraktAppSecrets,
  upsertConnection,
} from "./store";

export function seedConnectionsFromEnv(): void {
  const e = env();
  if (!getConnection("tofa") && e.TOFA_URL) {
    const parsed = parseTofaBaseUrl(e.TOFA_URL);
    if (parsed.ok) {
      upsertConnection("tofa", {
        baseUrl: parsed.href,
        authMethod: e.TOFA_API_KEY ? "api_key" : null,
        accessTokenEnc: e.TOFA_API_KEY ? saveSecret(e.TOFA_API_KEY) : null,
        status: "unknown",
      });
      logger.info("Seeded tofa connection from env");
    }
  }
  if (!getConnection("trakt") && e.TRAKT_CLIENT_ID && e.TRAKT_CLIENT_SECRET) {
    upsertConnection("trakt", {
      extraEnc: saveTraktAppSecrets({
        clientId: e.TRAKT_CLIENT_ID,
        clientSecret: e.TRAKT_CLIENT_SECRET,
      }),
      status: "unknown",
    });
    logger.info("Seeded Trakt app credentials from env");
  }
  if (!getConnection("tmdb") && e.TMDB_API_KEY) {
    upsertConnection("tmdb", {
      accessTokenEnc: saveSecret(e.TMDB_API_KEY),
      extraJson: JSON.stringify({ region: "US" }),
      status: "unknown",
    });
    logger.info("Seeded TMDB key from env");
  }
}

export async function verifyTofa(): Promise<void> {
  const row = getConnection("tofa");
  if (!row?.baseUrl) {
    upsertConnection("tofa", {
      status: "unknown",
      lastError: "No server URL saved.",
    });
    return;
  }
  const token = readAccessToken(row);
  try {
    const status = await tofaAuthStatus(row.baseUrl);
    let accountLabel = row.accountLabel;
    let capabilitiesJson = row.capabilitiesJson;
    let extra = mergeExtra(row, { connectUrl: status.connect_url });
    if (token) {
      const info = await tofaSystemInfo(row.baseUrl, token);
      const me = await tofaUsersMe(row.baseUrl, token);
      accountLabel = me.username;
      capabilitiesJson = JSON.stringify(info.capabilities ?? []);
      extra = mergeExtra(
        { ...row, extraJson: extra },
        {
          connectUrl: status.connect_url,
          version: info.version,
          apiVersion: info.api_version,
        },
      );
    }
    upsertConnection("tofa", {
      serverId: status.server_id,
      accountLabel,
      capabilitiesJson,
      extraJson: extra,
      status: token ? "ok" : "warn",
      lastVerifiedAt: new Date(),
      lastError: null,
    });
  } catch (err) {
    upsertConnection("tofa", {
      status: "down",
      lastError: `${messageOf(err)}${loopbackSuffix(row.baseUrl)}`,
    });
  }
}

export async function verifyTrakt(): Promise<void> {
  const row = getConnection("trakt");
  if (!row) {
    upsertConnection("trakt", {
      status: "unknown",
      lastError: "No Trakt app saved.",
    });
    return;
  }
  const app = readTraktAppSecrets(row);
  const token = readAccessToken(row);
  if (!app) {
    upsertConnection("trakt", {
      status: "warn",
      lastError: "Paste your Trakt client id and secret first.",
    });
    return;
  }
  if (!token) {
    upsertConnection("trakt", {
      status: "warn",
      lastError: null,
    });
    return;
  }
  try {
    const settings = await traktUsersSettings(app.clientId, token);
    const label =
      settings.user?.username ?? settings.user?.name ?? row.accountLabel;
    upsertConnection("trakt", {
      accountLabel: label,
      status: "ok",
      lastVerifiedAt: new Date(),
      lastError: null,
    });
  } catch (err) {
    upsertConnection("trakt", {
      status: "down",
      lastError: messageOf(err),
    });
  }
}

export async function verifyTmdb(): Promise<void> {
  const row = getConnection("tmdb");
  const key = row ? readAccessToken(row) : null;
  if (!key) {
    upsertConnection("tmdb", {
      status: "warn",
      lastError:
        "Without a key, provider snapshots and some artwork enrichment are skipped.",
    });
    return;
  }
  try {
    await tmdbValidateKey(key);
    upsertConnection("tmdb", {
      status: "ok",
      lastVerifiedAt: new Date(),
      lastError: null,
    });
  } catch (err) {
    upsertConnection("tmdb", {
      status: "down",
      lastError: messageOf(err),
    });
  }
}

export async function refreshDueTokens(): Promise<void> {
  const tofa = getConnection("tofa");
  if (tofa && needsProactiveRefresh(tofa)) {
    await refreshTofa(tofa);
  }
  const trakt = getConnection("trakt");
  if (trakt && needsProactiveRefresh(trakt)) {
    await refreshTrakt(trakt);
  }
}

async function refreshTofa(row: ConnectionRow): Promise<void> {
  const extra = parseExtra(row);
  const refresh = readRefreshToken(row);
  const connectUrl = extra.connectUrl;
  if (!refresh || !connectUrl || !row.serverId) {
    return;
  }
  try {
    const tokens = await tofaRefreshDeviceToken(
      connectUrl,
      row.serverId,
      refresh,
    );
    persistRotatedTokens("tofa", row, tokens);
  } catch (err) {
    upsertConnection("tofa", {
      status: "down",
      lastError: messageOf(err),
    });
  }
}

export async function refreshTraktConnection(): Promise<boolean> {
  const row = getConnection("trakt");
  if (!row) {
    return false;
  }
  await refreshTrakt(row);
  const latest = getConnection("trakt");
  return Boolean(latest && latest.status !== "down" && readAccessToken(latest));
}

async function refreshTrakt(row: ConnectionRow): Promise<void> {
  const app = readTraktAppSecrets(row);
  const refresh = readRefreshToken(row);
  if (!app || !refresh) {
    return;
  }
  try {
    const tokens = await traktRefreshToken(
      app.clientId,
      app.clientSecret,
      refresh,
    );
    persistRotatedTokens("trakt", row, tokens);
  } catch (err) {
    upsertConnection("trakt", {
      status: "down",
      lastError: messageOf(err),
    });
  }
}

function persistRotatedTokens(
  provider: "tofa" | "trakt",
  row: ConnectionRow,
  tokens: { access_token: string; refresh_token: string; expires_in?: number },
): void {
  const issuedAt = Date.now();
  const expiresAt = tokens.expires_in
    ? new Date(issuedAt + tokens.expires_in * 1000)
    : row.expiresAt;
  upsertConnection(provider, {
    accessTokenEnc: saveSecret(tokens.access_token),
    refreshTokenEnc: saveSecret(tokens.refresh_token),
    expiresAt: expiresAt ?? null,
    extraJson: mergeExtra(row, { tokenIssuedAt: issuedAt }),
  });
}

function loopbackSuffix(baseUrl: string): string {
  const parsed = parseTofaBaseUrl(baseUrl);
  if (parsed.ok && parsed.loopback) {
    return ` ${LOOPBACK_HINT}`;
  }
  return "";
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : "Request failed.";
}
