"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  beginTraktDeviceFlow,
  type ConnectionActionState,
  saveTraktApp,
  testTraktConnection,
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

export function TraktCard({
  connection,
  pending,
}: {
  connection: PublicConnection;
  pending?: ConnectionActionState["flow"];
}) {
  const router = useRouter();
  const [appState, saveApp, appPending] = useActionState(
    saveTraktApp,
    undefined,
  );
  const [flowState, beginFlow, flowPending] = useActionState(
    beginTraktDeviceFlow,
    undefined,
  );
  const [replace, setReplace] = useState(!connection.hasClientCredentials);
  const [flow, setFlow] = useState<ConnectionActionState["flow"]>();
  const [localError, setLocalError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (flowState?.flow) {
      setFlow(flowState.flow);
    }
  }, [flowState]);

  const shown = flow ?? pending;

  const statusText =
    connection.status === "ok"
      ? `Connected${connection.accountLabel ? ` · ${connection.accountLabel}` : ""}`
      : connection.status === "warn"
        ? "App saved"
        : connection.status === "down"
          ? "Unreachable"
          : "Not configured";

  const expiry = connection.expiresAt
    ? ` · token expires ${new Date(connection.expiresAt).toLocaleDateString()}`
    : "";

  return (
    <section className="flex w-full flex-col gap-3 rounded-lg border border-border bg-bg-raised p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className={`size-2 shrink-0 rounded-full ${statusDotClass(connection.status)}`}
          />
          <h2 className="text-body font-semibold leading-[18px]">Trakt</h2>
        </div>
        <p
          className={`text-meta leading-meta ${statusClass(connection.status)}`}
        >
          {statusText}
        </p>
      </div>
      <p className="text-ui leading-[18px] text-fg-muted">
        Create your own app at{" "}
        <a
          className="text-accent underline underline-offset-2"
          href="https://trakt.tv/oauth/applications"
          rel="noreferrer"
          target="_blank"
        >
          trakt.tv/oauth/applications
        </a>
        . Watchlog cannot ship a shared client id. Device flow connects that app
        to your account
        {expiry}.
      </p>
      {connection.lastError ? (
        <p className="text-ui text-sync-failed" role="alert">
          {connection.lastError}
        </p>
      ) : null}

      {replace ? (
        <form action={saveApp} className="flex flex-col gap-2">
          <input
            aria-label="Trakt client ID"
            autoComplete="off"
            className={fieldClass}
            name="clientId"
            placeholder="Client ID"
            required
            type="text"
          />
          <input
            aria-label="Trakt client secret"
            autoComplete="off"
            className={fieldClass}
            name="clientSecret"
            placeholder="Client secret"
            required
            type="password"
          />
          <button className={outlineBtn} disabled={appPending} type="submit">
            {appPending ? "Saving…" : "Save app"}
          </button>
        </form>
      ) : (
        <p className="text-ui text-fg-muted">Own app credentials · ••••••••</p>
      )}
      {appState?.error ? (
        <p className="text-ui text-sync-failed">{appState.error}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          className={outlineBtn}
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void testTraktConnection().then((result) => {
              setBusy(false);
              setLocalError(result.error);
              router.refresh();
            });
          }}
          type="button"
        >
          Test connection
        </button>
        <form action={beginFlow}>
          <button
            className={outlineBtn}
            disabled={busy || flowPending || appPending}
            type="submit"
          >
            {flowPending
              ? "Starting…"
              : connection.hasSecret
                ? "Re-auth"
                : "Connect account"}
          </button>
        </form>
        {connection.hasClientCredentials ? (
          <button
            className={ghostBtn}
            onClick={() => setReplace((v) => !v)}
            type="button"
          >
            {replace ? "Cancel replace" : "Replace app"}
          </button>
        ) : null}
      </div>
      {localError || flowState?.error ? (
        <p className="text-ui text-sync-failed" role="alert">
          {localError ?? flowState?.error}
        </p>
      ) : null}
      {shown ? (
        <DeviceFlowPanel
          flow={shown}
          onDone={() => {
            setFlow(undefined);
            router.refresh();
          }}
        />
      ) : null}
    </section>
  );
}
