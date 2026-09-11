"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BusyLabel } from "@/components/toast/busy-label";
import {
  runWithBusyToast,
  useToastAction,
} from "@/components/toast/use-toast-action";
import {
  beginTraktDeviceFlow,
  type ConnectionActionState,
  saveTraktApp,
  testTraktConnection,
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

export function TraktCard({
  connection,
  pending,
}: {
  connection: PublicConnection;
  pending?: ConnectionActionState["flow"];
}) {
  const router = useRouter();
  const [appState, saveApp, appPending] = useToastAction(saveTraktApp, {
    busy: "Saving app…",
  });
  const [flowState, beginFlow, flowPending] = useToastAction(
    beginTraktDeviceFlow,
    { busy: "Starting Trakt login…" },
  );
  const [replace, setReplace] = useState(!connection.hasClientCredentials);
  const [flow, setFlow] = useState<ConnectionActionState["flow"]>();
  const [testBusy, setTestBusy] = useState(false);

  useEffect(() => {
    if (appState?.info) {
      setReplace(false);
    }
  }, [appState?.info]);

  useEffect(() => {
    if (flowState?.flow) {
      setFlow(flowState.flow);
    }
  }, [flowState]);

  const shown = flow ?? pending;
  const credentialsSaved =
    connection.hasClientCredentials || Boolean(appState?.info);
  const authorized = connection.hasSecret;
  const showCredentialForm = !credentialsSaved || replace;

  const statusText =
    connection.status === "ok"
      ? `Connected${connection.accountLabel ? ` · ${connection.accountLabel}` : ""}`
      : connection.status === "warn"
        ? "App saved"
        : connection.status === "down"
          ? "Unreachable"
          : "Not configured";

  const expiry = connection.expiresAt
    ? ` Token expires ${new Date(connection.expiresAt).toLocaleDateString()}.`
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
        Two steps. Save the client ID and secret from your own app at{" "}
        <a
          className="text-accent underline underline-offset-2"
          href="https://trakt.tv/oauth/applications"
          rel="noreferrer"
          target="_blank"
        >
          trakt.tv/oauth/applications
        </a>
        , then authorize that app on Trakt. Test connection works only after
        authorization.{expiry}
      </p>
      {connection.lastError ? (
        <p className="text-ui text-sync-failed" role="alert">
          {connection.lastError}
        </p>
      ) : null}

      {showCredentialForm ? (
        <form
          action={saveApp}
          aria-busy={appPending || undefined}
          className="flex flex-col gap-2"
        >
          <p className="text-meta leading-meta text-fg-muted">
            Step 1 · App credentials
          </p>
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
          <button className={primaryBtn} disabled={appPending} type="submit">
            <BusyLabel busy="Saving…" idle="Save app" pending={appPending} />
          </button>
        </form>
      ) : (
        <SavedSecret label="Client ID and secret saved" />
      )}

      {credentialsSaved && !authorized ? (
        <NextStep>
          Next: Connect account and approve Watchlog on trakt.tv. The saved
          credentials stay here. Test connection stays off until Trakt approves
          the app.
        </NextStep>
      ) : null}
      {authorized && connection.status !== "ok" ? (
        <p className="text-ui leading-[18px] text-fg-muted">
          Account authorized. Test connection to confirm, or re-auth if the
          token expires.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {credentialsSaved && !authorized ? (
          <form action={beginFlow} aria-busy={flowPending || undefined}>
            <button
              className={primaryBtn}
              disabled={testBusy || flowPending || appPending}
              type="submit"
            >
              <BusyLabel
                busy="Starting…"
                idle="Connect account"
                pending={flowPending}
              />
            </button>
          </form>
        ) : null}
        <button
          className={outlineBtn}
          disabled={testBusy || flowPending || !authorized}
          onClick={() => {
            setTestBusy(true);
            void runWithBusyToast("Testing Trakt…", () => testTraktConnection())
              .then(() => {
                router.refresh();
              })
              .catch(() => undefined)
              .finally(() => {
                setTestBusy(false);
              });
          }}
          title={
            authorized
              ? undefined
              : "Authorize on Trakt before testing this connection."
          }
          type="button"
        >
          <BusyLabel
            busy="Testing…"
            idle="Test connection"
            pending={testBusy}
          />
        </button>
        {authorized ? (
          <form action={beginFlow} aria-busy={flowPending || undefined}>
            <button
              className={outlineBtn}
              disabled={testBusy || flowPending || appPending}
              type="submit"
            >
              <BusyLabel
                busy="Starting…"
                idle="Re-auth"
                pending={flowPending}
              />
            </button>
          </form>
        ) : null}
        {credentialsSaved ? (
          <button
            className={ghostBtn}
            onClick={() => setReplace((value) => !value)}
            type="button"
          >
            {replace ? "Cancel replace" : "Replace app"}
          </button>
        ) : null}
      </div>
      {credentialsSaved && !authorized ? (
        <p className="text-meta leading-meta text-fg-muted">
          Test connection is available after you authorize.
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
