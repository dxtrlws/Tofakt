import { eq } from "drizzle-orm";
import { decryptSecret, encryptSecret } from "../crypto";
import { getDb } from "../db";
import { connections } from "../db/schema";
import { toPublic } from "./public";
import type { ConnectionExtra, Provider, TraktAppSecrets } from "./types";

export type ConnectionRow = typeof connections.$inferSelect;

export { toPublic };

export function getConnection(provider: Provider): ConnectionRow | undefined {
  return getDb()
    .select()
    .from(connections)
    .where(eq(connections.provider, provider))
    .get();
}

export function listConnections(): ConnectionRow[] {
  return getDb().select().from(connections).all();
}

export function parseExtra(row: ConnectionRow | undefined): ConnectionExtra {
  if (!row?.extraJson) {
    return {};
  }
  try {
    return JSON.parse(row.extraJson) as ConnectionExtra;
  } catch {
    return {};
  }
}

export function readAccessToken(row: ConnectionRow): string | null {
  return row.accessTokenEnc ? decryptSecret(row.accessTokenEnc) : null;
}

export function readRefreshToken(row: ConnectionRow): string | null {
  return row.refreshTokenEnc ? decryptSecret(row.refreshTokenEnc) : null;
}

export function readTraktAppSecrets(
  row: ConnectionRow,
): TraktAppSecrets | null {
  if (!row.extraEnc) {
    return null;
  }
  try {
    return JSON.parse(decryptSecret(row.extraEnc)) as TraktAppSecrets;
  } catch {
    return null;
  }
}

export function upsertConnection(
  provider: Provider,
  patch: Partial<Omit<typeof connections.$inferInsert, "id" | "provider">>,
): ConnectionRow {
  const existing = getConnection(provider);
  if (existing) {
    getDb()
      .update(connections)
      .set(patch)
      .where(eq(connections.provider, provider))
      .run();
  } else {
    getDb()
      .insert(connections)
      .values({
        id: provider,
        provider,
        status: "unknown",
        ...patch,
      })
      .run();
  }
  const saved = getConnection(provider);
  if (!saved) {
    throw new Error("Failed to persist connection");
  }
  return saved;
}

export function saveSecret(value: string): string {
  return encryptSecret(value);
}

export function saveTraktAppSecrets(secrets: TraktAppSecrets): string {
  return encryptSecret(JSON.stringify(secrets));
}

export function mergeExtra(
  row: ConnectionRow | undefined,
  patch: ConnectionExtra,
): string {
  return JSON.stringify({ ...parseExtra(row), ...patch });
}

export function deleteConnection(provider: Provider): void {
  getDb().delete(connections).where(eq(connections.provider, provider)).run();
}

export function needsProactiveRefresh(row: ConnectionRow): boolean {
  if (!row.expiresAt || !row.refreshTokenEnc) {
    return false;
  }
  const issuedAt = parseExtra(row).tokenIssuedAt;
  if (!issuedAt) {
    return Date.now() >= row.expiresAt.getTime();
  }
  const lifetime = row.expiresAt.getTime() - issuedAt;
  if (lifetime <= 0) {
    return true;
  }
  return Date.now() >= issuedAt + lifetime * 0.75;
}
