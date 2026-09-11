"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toastFromAction } from "@/components/toast/store";
import { useToastAction } from "@/components/toast/use-toast-action";
import {
  type ConnectionActionState,
  saveTofaApiKey,
  saveTofaUrl,
  startTofaDeviceFlow,
  testTofaConnection,
} from "@/lib/connections/actions";
import type { PublicConnection } from "@/lib/connections/types";
import { DeviceFlowPanel } from "./device-flow-panel";
import {
  fieldClass,
  ghostBtn,
  NextStep,
  outlineBtn,
  primaryBtn,
  SavedSecret,
} from "./setup";
import { statusClass, statusDotClass } from "./status";

export function TofaCard({ connection }: { connection: PublicConnection }) {
  const router = useRouter();
  const [urlState, saveUrl, urlPending] = useToastAction(saveTofaUrl);
  const [keyState, saveKey, keyPending] = useToastAction(saveTofaApiKey);
  const [replace, setReplace] = useState(!connection.hasSecret);
  const [flow, setFlow] = useState<ConnectionActionState["flow"]>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (keyState?.info) {
      setReplace(false);
    }
  }, [keyState?.info]);

  useEffect(() => {
    if (connection.hasSecret) {
      setReplace(false);
    }
  }, [connection.hasSecret]);

  const hasUrl = Boolean(connection.baseUrl) || Boolean(urlState?.info);
  const authorized = connection.hasSecret || Boolean(keyState?.info);
  const showKeyForm = hasUrl && (!authorized || replace);

  const statusText =
    connection.status === "ok"
      ? `Connected${connection.versionLabel ? ` · ${connection.versionLabel}` : ""}`
      : connection.status === "warn"
        ? "Server reached"
        : connection.status === "down"
          ? "Unreachable"
          : "Not configured";

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
      <p className="text-ui leading-[18px] text-fg-muted">
        Two steps. Save the server URL, then an API key or device flow. Test
        connection works only after one of those is stored.
        {connection.accountLabel ? ` User ${connection.accountLabel}.` : ""}
        {connection.serverId ? " Server claimed." : ""}
      </p>
      {connection.lastError ? (
        <p className="text-ui text-sync-failed" role="alert">
          {connection.lastError}
        </p>
      ) : null}

      <form action={saveUrl} className="flex flex-col gap-2">
        <p className="text-meta leading-meta text-fg-muted">
          Step 1 · Server URL
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
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
        </div>
      </form>

      {hasUrl && !authorized && connection.status !== "down" ? (
        <NextStep>
          URL saved. Next: paste an API key, or start device flow. The URL stays
          in the field above. Test connection stays off until you authorize.
        </NextStep>
      ) : null}

      {showKeyForm ? (
        <form action={saveKey} className="flex flex-col gap-2">
          <p className="text-meta leading-meta text-fg-muted">
            Step 2 · API key
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              aria-label="tofa API key"
              autoComplete="off"
              className={fieldClass}
              name="apiKey"
              placeholder="API key"
              required
              type="password"
            />
            <button className={primaryBtn} disabled={keyPending} type="submit">
              {keyPending ? "Saving…" : "Save key"}
            </button>
          </div>
        </form>
      ) : null}
      {authorized && !replace ? (
        <SavedSecret
          label={
            connection.authMethod === "device"
              ? "Access token saved"
              : "API key saved"
          }
        />
      ) : null}

      {authorized && connection.status !== "ok" ? (
        <p className="text-ui leading-[18px] text-fg-muted">
          Credentials saved. Test connection to confirm.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {hasUrl && !authorized ? (
          <button
            className={outlineBtn}
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void startTofaDeviceFlow().then((result) => {
                setBusy(false);
                toastFromAction(result);
                setFlow(result.flow);
              });
            }}
            type="button"
          >
            Device flow
          </button>
        ) : null}
        <button
          className={authorized ? primaryBtn : outlineBtn}
          disabled={busy || !authorized}
          onClick={() => {
            setBusy(true);
            void testTofaConnection().then((result) => {
              setBusy(false);
              toastFromAction(result);
              router.refresh();
            });
          }}
          title={
            authorized
              ? undefined
              : "Save an API key or finish device flow before testing."
          }
          type="button"
        >
          {busy ? "Testing…" : "Test connection"}
        </button>
        {authorized ? (
          <button
            className={ghostBtn}
            onClick={() => setReplace((value) => !value)}
            type="button"
          >
            {replace ? "Cancel replace" : "Replace key"}
          </button>
        ) : null}
        {authorized ? (
          <button
            className={ghostBtn}
            disabled={busy || !hasUrl}
            onClick={() => {
              setBusy(true);
              void startTofaDeviceFlow().then((result) => {
                setBusy(false);
                toastFromAction(result);
                setFlow(result.flow);
              });
            }}
            type="button"
          >
            {connection.authMethod === "device" ? "Re-auth" : "Device flow"}
          </button>
        ) : null}
      </div>
      {hasUrl && !authorized ? (
        <p className="text-meta leading-meta text-fg-muted">
          Test connection is available after an API key or device flow.
        </p>
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
