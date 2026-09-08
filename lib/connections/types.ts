export type Provider = "tofa" | "trakt" | "tmdb";

export type ConnectionStatus = "unknown" | "ok" | "warn" | "down";

export type PublicConnection = {
  provider: Provider;
  status: ConnectionStatus;
  baseUrl: string | null;
  serverId: string | null;
  authMethod: string | null;
  accountLabel: string | null;
  hasSecret: boolean;
  hasRefresh: boolean;
  hasClientCredentials: boolean;
  expiresAt: string | null;
  lastVerifiedAt: string | null;
  lastError: string | null;
  capabilities: string[];
  region: string | null;
  versionLabel: string | null;
};

export type ConnectionExtra = {
  connectUrl?: string;
  tokenIssuedAt?: number;
  region?: string;
  version?: string;
  apiVersion?: number;
};

export type TraktAppSecrets = {
  clientId: string;
  clientSecret: string;
};
