"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { saveTmdb, testTmdbConnection } from "@/lib/connections/actions";
import type { PublicConnection } from "@/lib/connections/types";
import {
  fieldClass,
  ghostBtn,
  NextStep,
  Note,
  outlineBtn,
  primaryBtn,
  SavedSecret,
} from "./setup";
import { statusClass, statusDotClass } from "./status";

export function TmdbCard({ connection }: { connection: PublicConnection }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveTmdb, undefined);
  const [replace, setReplace] = useState(!connection.hasSecret);
  const [localError, setLocalError] = useState<string | undefined>();
  const [localInfo, setLocalInfo] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state?.info) {
      setReplace(false);
    }
  }, [state?.info]);

  const saved = connection.hasSecret || Boolean(state?.info);
  const showForm = !saved || replace;
  const region = connection.region ?? "US";
  const statusText =
    connection.status === "ok"
      ? "Connected"
      : saved
        ? "Key saved"
        : "Key missing";

  return (
    <section className="flex w-full flex-col gap-3 rounded-lg border border-border bg-bg-raised p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className={`size-2 shrink-0 rounded-full ${statusDotClass(connection.status)}`}
          />
          <h2 className="text-body font-semibold leading-[18px]">TMDB</h2>
        </div>
        <p
          className={`text-meta leading-meta ${statusClass(connection.status)}`}
        >
          {statusText}
        </p>
      </div>
      <p className="text-ui leading-[18px] text-fg-muted">
        Save an API key, then test it. Without a key, provider snapshots and
        some artwork enrichment are skipped. Region defaults to {region}.
      </p>
      {connection.lastError && connection.status !== "ok" ? (
        <p className="text-ui text-sync-failed" role="alert">
          {connection.lastError}
        </p>
      ) : null}

      {showForm ? (
        <form action={action} className="flex flex-col gap-2">
          <p className="text-meta leading-meta text-fg-muted">API key</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              aria-label="TMDB API key"
              autoComplete="off"
              className={fieldClass}
              name="apiKey"
              placeholder={saved ? "New API key" : "API key"}
              required={!saved}
              type="password"
            />
            <input
              aria-label="TMDB region"
              className="w-24 rounded-md border border-border bg-bg-overlay px-3.5 py-2 text-ui text-fg outline-none"
              defaultValue={region}
              maxLength={2}
              name="region"
              placeholder="US"
            />
            <button className={primaryBtn} disabled={pending} type="submit">
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      ) : (
        <SavedSecret label={`API key saved · region ${region}`} />
      )}
      <Note error={state?.error} info={state?.info} />

      {saved && connection.status !== "ok" ? (
        <NextStep>
          Key saved. It stays stored. Test connection to confirm the key works.
        </NextStep>
      ) : null}
      {saved && connection.status === "ok" ? (
        <p className="text-ui leading-[18px] text-fg-muted">
          Key saved. Provider snapshots use region {region}.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          className={saved ? primaryBtn : outlineBtn}
          disabled={pending || busy || !saved}
          onClick={() => {
            setBusy(true);
            setLocalError(undefined);
            setLocalInfo(undefined);
            void testTmdbConnection().then((result) => {
              setBusy(false);
              setLocalError(result.error);
              setLocalInfo(result.info);
              router.refresh();
            });
          }}
          title={saved ? undefined : "Save an API key before testing."}
          type="button"
        >
          {busy ? "Testing…" : "Test connection"}
        </button>
        {saved ? (
          <button
            className={ghostBtn}
            onClick={() => setReplace((value) => !value)}
            type="button"
          >
            {replace ? "Cancel replace" : "Replace key"}
          </button>
        ) : null}
      </div>
      {!saved ? (
        <p className="text-meta leading-meta text-fg-muted">
          Test connection is available after you save a key.
        </p>
      ) : null}
      <Note error={localError} info={localInfo} />
    </section>
  );
}
