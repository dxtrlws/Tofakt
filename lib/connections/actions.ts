"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertSameOrigin } from "../auth/csrf";
import { requireUser } from "../auth/require";
import { UpstreamError } from "../net/fetch-json";
import { parseTofaBaseUrl } from "../net/ssrf";
import { tofaPollDeviceToken, tofaStartDeviceCode } from "../tofa/client";
import { traktPollDeviceToken, traktStartDeviceCode } from "../trakt/client";
import {
  deletePendingFlow,
  getPendingFlow,
  markPolled,
  savePendingFlow,
  shouldWait,
} from "./device-flow";
import { toPublic } from "./public";
import { qrDataUrl } from "./qr";
import {
  refreshDueTokens,
  seedConnectionsFromEnv,
  verifyTmdb,
  verifyTofa,
  verifyTrakt,
} from "./service";
import {
  getConnection,
  mergeExtra,
  parseExtra,
  readTraktAppSecrets,
  saveSecret,
  saveTraktAppSecrets,
  upsertConnection,
} from "./store";
import type { PublicConnection } from "./types";

export type ConnectionActionState = {
  error?: string;
  info?: string;
  flow?: {
    id: string;
    userCode: string;
    verificationUrl: string;
    qrDataUrl: string | null;
    interval: number;
  };
};

async function guard(): Promise<{ error: string } | null> {
  await requireUser();
  return assertSameOrigin();
}

function refreshConnectionPages(): void {
  revalidatePath("/settings/connections");
  revalidatePath("/");
}

export async function getPublicConnections(): Promise<{
  tofa: PublicConnection;
  trakt: PublicConnection;
  tmdb: PublicConnection;
}> {
  await requireUser();
  seedConnectionsFromEnv();
  await refreshDueTokens();
  return {
    tofa: toPublic(getConnection("tofa"), "tofa"),
    trakt: toPublic(getConnection("trakt"), "trakt"),
    tmdb: toPublic(getConnection("tmdb"), "tmdb"),
  };
}

export async function saveTofaUrl(
  _prev: ConnectionActionState | undefined,
  formData: FormData,
): Promise<ConnectionActionState> {
  const blocked = await guard();
  if (blocked) {
    return blocked;
  }
  const parsed = parseTofaBaseUrl(String(formData.get("url") ?? ""));
  if (!parsed.ok) {
    return { error: parsed.error };
  }
  upsertConnection("tofa", {
    baseUrl: parsed.href,
    lastError: null,
  });
  await verifyTofa();
  refreshConnectionPages();
  const row = getConnection("tofa");
  if (row?.status === "down") {
    return { error: row.lastError ?? "Could not reach that URL." };
  }
  if (!row?.accessTokenEnc) {
    return {
      info: "URL saved. Next: paste an API key or start device flow.",
    };
  }
  return { info: "URL saved." };
}

export async function saveTofaApiKey(
  _prev: ConnectionActionState | undefined,
  formData: FormData,
): Promise<ConnectionActionState> {
  const blocked = await guard();
  if (blocked) {
    return blocked;
  }
  const key = String(formData.get("apiKey") ?? "").trim();
  if (key.length < 8) {
    return { error: "That API key looks too short." };
  }
  upsertConnection("tofa", {
    authMethod: "api_key",
    accessTokenEnc: saveSecret(key),
    refreshTokenEnc: null,
    lastError: null,
  });
  await verifyTofa();
  refreshConnectionPages();
  return { info: "API key saved. Test connection to confirm." };
}

export async function startTofaDeviceFlow(): Promise<ConnectionActionState> {
  const blocked = await guard();
  if (blocked) {
    return blocked;
  }
  const row = getConnection("tofa");
  if (!row?.baseUrl) {
    return { error: "Save a tofa URL first." };
  }
  await verifyTofa();
  const fresh = getConnection("tofa");
  const extra = parseExtra(fresh);
  if (!fresh?.serverId || !extra.connectUrl) {
    return { error: "Could not read server_id from tofa." };
  }
  try {
    const code = await tofaStartDeviceCode(extra.connectUrl, fresh.serverId);
    const flow = savePendingFlow({
      provider: "tofa",
      deviceCode: code.device_code,
      intervalMs: Math.max(code.interval, 1) * 1000,
      expiresAt: Date.now() + code.expires_in * 1000,
      connectUrl: extra.connectUrl,
      serverId: fresh.serverId,
      baseUrl: fresh.baseUrl ?? undefined,
    });
    upsertConnection("tofa", { authMethod: "device" });
    refreshConnectionPages();
    return {
      info: "Approve Watchlog in tofa, then wait here.",
      flow: {
        id: flow.id,
        userCode: code.user_code,
        verificationUrl:
          code.verification_uri_complete ?? code.verification_uri,
        qrDataUrl: await qrSvgOrUrl(
          code.qr_code_svg,
          code.verification_uri_complete ?? code.verification_uri,
        ),
        interval: code.interval,
      },
    };
  } catch (err) {
    return { error: messageOf(err) };
  }
}

export async function pollDeviceFlow(
  flowId: string,
): Promise<ConnectionActionState> {
  const blocked = await guard();
  if (blocked) {
    return blocked;
  }
  const flow = getPendingFlow(flowId);
  if (!flow) {
    return { error: "That device code expired. Start again." };
  }
  if (shouldWait(flow) > 0) {
    return { info: "Waiting for approval…" };
  }
  markPolled(flow.id);
  try {
    if (flow.provider === "tofa") {
      if (!flow.connectUrl) {
        return { error: "Missing tofa connect URL." };
      }
      const result = await tofaPollDeviceToken(
        flow.connectUrl,
        flow.deviceCode,
      );
      if (result.pending) {
        if (result.slowDown) {
          markPolled(flow.id, 2000);
        }
        return { info: "Waiting for approval…" };
      }
      persistDeviceTokens("tofa", result.tokens);
      deletePendingFlow(flow.id);
      await verifyTofa();
      refreshConnectionPages();
      return { info: "tofa connected." };
    }

    const row = getConnection("trakt");
    const app = row ? readTraktAppSecrets(row) : null;
    if (!app) {
      return { error: "Trakt app credentials missing." };
    }
    const result = await traktPollDeviceToken(
      app.clientId,
      app.clientSecret,
      flow.deviceCode,
    );
    if (result.pending) {
      if (result.expired) {
        deletePendingFlow(flow.id);
        return { error: "The Trakt code expired. Start again." };
      }
      if (result.denied) {
        deletePendingFlow(flow.id);
        return { error: "Trakt denied this code." };
      }
      if (result.slowDown) {
        markPolled(flow.id, 2000);
      }
      return { info: "Waiting for approval…" };
    }
    persistDeviceTokens("trakt", result.tokens);
    deletePendingFlow(flow.id);
    await verifyTrakt();
    refreshConnectionPages();
    return { info: "Trakt connected." };
  } catch (err) {
    return { error: messageOf(err) };
  }
}

export async function testTofaConnection(): Promise<ConnectionActionState> {
  const blocked = await guard();
  if (blocked) {
    return blocked;
  }
  await refreshDueTokens();
  await verifyTofa();
  refreshConnectionPages();
  const row = getConnection("tofa");
  if (!row?.baseUrl) {
    return { error: "Save a tofa URL first." };
  }
  if (!row.accessTokenEnc) {
    return {
      error: "Save an API key or finish device flow before testing.",
    };
  }
  if (row.status === "ok") {
    return { info: "tofa connection is good." };
  }
  return { error: row.lastError ?? "Test failed." };
}

export async function saveTraktApp(
  _prev: ConnectionActionState | undefined,
  formData: FormData,
): Promise<ConnectionActionState> {
  const blocked = await guard();
  if (blocked) {
    return blocked;
  }
  const clientId = String(formData.get("clientId") ?? "").trim();
  const clientSecret = String(formData.get("clientSecret") ?? "").trim();
  if (!clientId || !clientSecret) {
    return { error: "Both client id and secret are required." };
  }
  upsertConnection("trakt", {
    extraEnc: saveTraktAppSecrets({ clientId, clientSecret }),
    lastError: null,
  });
  await verifyTrakt();
  refreshConnectionPages();
  return {
    info: "App credentials saved. Next: connect your Trakt account.",
  };
}

export async function beginTraktDeviceFlow(
  _prev: ConnectionActionState | undefined,
  _formData: FormData,
): Promise<ConnectionActionState> {
  const result = await startTraktDeviceFlow();
  if (!result.flow) {
    return result;
  }
  const polled = await pollDeviceFlow(result.flow.id);
  if (polled.error) {
    return polled;
  }
  redirect("/settings/connections");
}

export async function startTraktDeviceFlow(): Promise<ConnectionActionState> {
  const blocked = await guard();
  if (blocked) {
    return blocked;
  }
  const row = getConnection("trakt");
  const app = row ? readTraktAppSecrets(row) : null;
  if (!app) {
    return { error: "Save your Trakt client id and secret first." };
  }
  try {
    const code = await traktStartDeviceCode(app.clientId);
    const flow = savePendingFlow({
      provider: "trakt",
      deviceCode: code.device_code,
      intervalMs: Math.max(code.interval, 1) * 1000,
      expiresAt: Date.now() + code.expires_in * 1000,
      userCode: code.user_code,
      verificationUrl: code.verification_url,
    });
    upsertConnection("trakt", { authMethod: "device" });
    refreshConnectionPages();
    let qr: string | null = null;
    try {
      qr = await qrDataUrl(code.verification_url);
    } catch {
      qr = null;
    }
    return {
      info: "Enter this code on Trakt, then wait here.",
      flow: {
        id: flow.id,
        userCode: code.user_code,
        verificationUrl: code.verification_url,
        qrDataUrl: qr,
        interval: code.interval,
      },
    };
  } catch (err) {
    return { error: messageOf(err) };
  }
}

export async function testTraktConnection(): Promise<ConnectionActionState> {
  const blocked = await guard();
  if (blocked) {
    return blocked;
  }
  await refreshDueTokens();
  await verifyTrakt();
  refreshConnectionPages();
  const row = getConnection("trakt");
  if (!row?.extraEnc) {
    return { error: "Save your Trakt client id and secret first." };
  }
  if (!row.accessTokenEnc) {
    return {
      error: "Authorize on Trakt first. Use Connect account, then test.",
    };
  }
  if (row.status === "ok") {
    return { info: "Trakt connection is good." };
  }
  return { error: row.lastError ?? "Test failed." };
}

export async function saveTmdb(
  _prev: ConnectionActionState | undefined,
  formData: FormData,
): Promise<ConnectionActionState> {
  const blocked = await guard();
  if (blocked) {
    return blocked;
  }
  const key = String(formData.get("apiKey") ?? "").trim();
  const region = String(formData.get("region") ?? "US")
    .trim()
    .toUpperCase()
    .slice(0, 2);
  const existing = getConnection("tmdb");
  if (!key && !existing?.accessTokenEnc) {
    return { error: "Enter a TMDB API key or v4 read token." };
  }
  upsertConnection("tmdb", {
    ...(key ? { accessTokenEnc: saveSecret(key) } : {}),
    extraJson: mergeExtra(existing, { region: region || "US" }),
    lastError: null,
  });
  await verifyTmdb();
  refreshConnectionPages();
  return { info: "API key saved. Test connection to confirm." };
}

export async function testTmdbConnection(): Promise<ConnectionActionState> {
  const blocked = await guard();
  if (blocked) {
    return blocked;
  }
  await verifyTmdb();
  refreshConnectionPages();
  const row = getConnection("tmdb");
  if (!row?.accessTokenEnc) {
    return { error: "Save a TMDB API key first." };
  }
  if (row.status === "ok") {
    return { info: "TMDB key is good." };
  }
  return { error: row.lastError ?? "Test failed." };
}

function persistDeviceTokens(
  provider: "tofa" | "trakt",
  tokens: { access_token: string; refresh_token: string; expires_in?: number },
): void {
  const issuedAt = Date.now();
  const row = getConnection(provider);
  upsertConnection(provider, {
    accessTokenEnc: saveSecret(tokens.access_token),
    refreshTokenEnc: saveSecret(tokens.refresh_token),
    expiresAt: tokens.expires_in
      ? new Date(issuedAt + tokens.expires_in * 1000)
      : null,
    extraJson: mergeExtra(row, { tokenIssuedAt: issuedAt }),
  });
}

async function qrSvgOrUrl(
  svg: string | undefined,
  fallbackUrl: string,
): Promise<string | null> {
  if (svg) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
  try {
    return await qrDataUrl(fallbackUrl);
  } catch {
    return null;
  }
}

function messageOf(err: unknown): string {
  if (err instanceof UpstreamError) {
    return err.message;
  }
  return err instanceof Error ? err.message : "Request failed.";
}
