import type { ConnectionRow } from "./store";
import type { ConnectionStatus, Provider, PublicConnection } from "./types";

export function toPublic(
  row: ConnectionRow | undefined,
  provider: Provider,
): PublicConnection {
  const extra = parseExtraJson(row?.extraJson);
  return {
    provider,
    status: (row?.status as ConnectionStatus | undefined) ?? "unknown",
    baseUrl: row?.baseUrl ?? null,
    serverId: row?.serverId ?? null,
    authMethod: row?.authMethod ?? null,
    accountLabel: row?.accountLabel ?? null,
    hasSecret: Boolean(row?.accessTokenEnc),
    hasRefresh: Boolean(row?.refreshTokenEnc),
    hasClientCredentials: Boolean(row?.extraEnc),
    expiresAt: row?.expiresAt ? row.expiresAt.toISOString() : null,
    lastVerifiedAt: row?.lastVerifiedAt
      ? row.lastVerifiedAt.toISOString()
      : null,
    lastError: row?.lastError ?? null,
    capabilities: parseCapabilities(row?.capabilitiesJson),
    region: extra.region ?? null,
    versionLabel: extra.version ?? null,
  };
}

function parseExtraJson(raw: string | null | undefined): {
  region?: string;
  version?: string;
} {
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as { region?: string; version?: string };
  } catch {
    return {};
  }
}

function parseCapabilities(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export function publicPayloadHasSecrets(dto: PublicConnection): boolean {
  const blob = JSON.stringify(dto);
  return (
    blob.includes("access_token") ||
    blob.includes("client_secret") ||
    blob.includes("refresh_token")
  );
}
