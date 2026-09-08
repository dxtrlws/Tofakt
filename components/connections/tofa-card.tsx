"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import {
  type ConnectionActionState,
  saveTofaApiKey,
  saveTofaUrl,
  startTofaDeviceFlow,
  testTofaConnection,
} from "@/lib/connections/actions";
import type { PublicConnection } from "@/lib/connections/types";
import { DeviceFlowPanel } from "./device-flow-panel";
import { statusClass, statusDotClass } from "./status";

const fieldClass =
  "w-full rounded-md border border-border bg-bg-overlay px-3.5 py-2 text-ui text-fg outline-none";
const ghostBtn =
  "rounded-md px-3.5 py-2 text-ui font-medium leading-[18px] text-fg-muted";
const outlineBtn =
  "rounded-md border border-border bg-bg-overlay px-3.5 py-2 text-ui font-medium leading-[18px] text-fg";

export function TofaCard({ connection }: { connection: PublicConnection }) {
  const router = useRouter();
  const [urlState, saveUrl, urlPending] = useActionState(
    saveTofaUrl,
    undefined,
  );
  const [keyState, saveKey, keyPending] = useActionState(
    saveTofaApiKey,
    undefined,
  );
  const [replace, setReplace] = useState(!connection.hasSecret);
  const [flow, setFlow] = useState<ConnectionActionState["flow"]>();
  const [localError, setLocalError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const statusText =
    connection.status === "ok"
      ? `Connected${connection.versionLabel ? ` · ${connection.versionLabel}` : ""}`
      : connection.status === "warn"
        ? "Server reached"
        : connection.status === "down"
          ? "Unreachable"
          : "Not configured";

  const detail = connection.hasSecret
    ? `${connection.authMethod === "device" ? "Device flow" : "Admin API key"}${
        connection.accountLabel ? ` · user ${connection.accountLabel}` : ""
      }${connection.serverId ? " · claimed server" : ""}`
    : "Paste a LAN or access URL, then an API key (recommended) or start device flow.";

  return (
    <section className="flex w-full flex-col gap-3 rounded-lg border border-border bg-bg-raised p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className={`size-2 shrink-0 rounded-full ${statusDotClass(connection.status)}`}
          />
          <h2 className="text-body font-semibold leading-[18px]">tofa</h2>
        </div>
        <p
          className={`text-meta leading-meta ${statusClass(connection.status)}`}
        >
          {statusText}
        </p>
      </div>
      <p className="text-ui leading-[18px] text-fg-muted">{detail}</p>
      {connection.lastError ? (
        <p className="text-ui text-sync-failed" role="alert">
          {connection.lastError}
        </p>
      ) : null}
      <form action={saveUrl} className="flex flex-col gap-2 sm:flex-row">
        <input
          aria-label="tofa server URL"
          className={fieldClass}
          defaultValue={connection.baseUrl ?? ""}
          name="url"
          placeholder="http://192.168.1.50:33333"
          required
        />
        <button className={outlineBtn} disabled={urlPending} type="submit">
          {urlPending ? "Saving…" : "Save URL"}
        </button>
      </form>
      {urlState?.error ? (
        <p className="text-ui text-sync-failed">{urlState.error}</p>
      ) : null}

      {replace ? (
        <form action={saveKey} className="flex flex-col gap-2 sm:flex-row">
          <input
            aria-label="tofa API key"
            autoComplete="off"
            className={fieldClass}
            name="apiKey"
            placeholder="API key"
            required
            type="password"
          />
          <button className={outlineBtn} disabled={keyPending} type="submit">
            {keyPending ? "Saving…" : "Save key"}
          </button>
        </form>
      ) : (
        <p className="text-ui text-fg-muted">
          {connection.authMethod === "device" ? "Access token" : "API key"} ·
          ••••••••
        </p>
      )}
      {keyState?.error ? (
        <p className="text-ui text-sync-failed">{keyState.error}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          className={outlineBtn}
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void testTofaConnection().then((result) => {
              setBusy(false);
              setLocalError(result.error);
              router.refresh();
            });
          }}
          type="button"
        >
          Test connection
        </button>
        {connection.hasSecret ? (
          <button
            className={ghostBtn}
            onClick={() => setReplace((v) => !v)}
            type="button"
          >
            {replace ? "Cancel replace" : "Replace key"}
          </button>
        ) : null}
        <button
          className={ghostBtn}
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void startTofaDeviceFlow().then((result) => {
              setBusy(false);
              setLocalError(result.error);
              setFlow(result.flow);
            });
          }}
          type="button"
        >
          Device flow
        </button>
      </div>
      {localError ? (
        <p className="text-ui text-sync-failed">{localError}</p>
      ) : null}
      {flow ? (
        <DeviceFlowPanel
          flow={flow}
          onDone={() => {
            setFlow(undefined);
            router.refresh();
          }}
        />
      ) : null}
    </section>
  );
}
