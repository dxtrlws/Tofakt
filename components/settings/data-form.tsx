"use client";

import type { ReactNode } from "react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { PrefSelect } from "@/components/settings/pref-select";
import {
  cancelImportAction,
  clearSyncAction,
  confirmImportAction,
  forgetConnectionAction,
  previewImportAction,
  saveDataPrefsAction,
  wipeLocalAction,
} from "@/lib/data/actions";
import type { WeekStart } from "@/lib/data/prefs";

const secondary =
  "rounded-md border border-border bg-bg-overlay px-3.5 py-2 text-ui font-medium leading-[18px] text-fg";
const dangerBtn =
  "shrink-0 rounded-md border border-sync-failed px-3.5 py-2 text-ui font-medium leading-[18px] text-sync-failed";

type ConnectionOption = {
  provider: "tofa" | "trakt" | "tmdb";
  label: string;
  connected: boolean;
};

type DangerKind = "clear" | "wipe" | "forget";

export function DataSettingsForm({
  connections,
  countPartials,
  importPreviewCount,
  timezone,
  timeZones,
  weekStarts,
}: {
  connections: ConnectionOption[];
  countPartials: boolean;
  importPreviewCount: number;
  timezone: string;
  timeZones: string[];
  weekStarts: WeekStart;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [danger, setDanger] = useState<DangerKind | null>(null);
  const [zone, setZone] = useState(timezone);
  const [week, setWeek] = useState(weekStarts);
  const [partials, setPartials] = useState(countPartials ? "on" : "off");
  const [prefsState, prefsAction] = useActionState(
    saveDataPrefsAction,
    undefined,
  );
  const [importState, importAction] = useActionState(
    previewImportAction,
    undefined,
  );
  const [confirmState, confirmAction] = useActionState(
    confirmImportAction,
    undefined,
  );
  const [cancelState, cancelAction] = useActionState(
    cancelImportAction,
    undefined,
  );
  const [clearState, clearAction, clearPending] = useActionState(
    clearSyncAction,
    undefined,
  );
  const [wipeState, wipeAction, wipePending] = useActionState(
    wipeLocalAction,
    undefined,
  );
  const [forgetState, forgetAction, forgetPending] = useActionState(
    forgetConnectionAction,
    undefined,
  );

  useCloseOnSuccess(danger === "clear", clearPending, clearState?.info, () =>
    setDanger(null),
  );
  useCloseOnSuccess(danger === "wipe", wipePending, wipeState?.info, () =>
    setDanger(null),
  );
  useCloseOnSuccess(danger === "forget", forgetPending, forgetState?.info, () =>
    setDanger(null),
  );

  return (
    <div className="flex flex-col gap-4">
      <form
        action={prefsAction}
        className="rounded-lg border border-border bg-bg-raised px-5 py-2"
      >
        <PrefRow label="Timezone">
          <PrefSelect
            className="w-[180px] shrink-0 justify-end"
            label="Timezone"
            menuClassName="w-[min(22rem,calc(100vw-2.5rem))]"
            name="timezone"
            onChange={setZone}
            options={timeZones.map((zoneOption) => ({
              value: zoneOption,
              label: zoneOption,
            }))}
            submitOnChange
            value={zone}
          />
        </PrefRow>
        <PrefRow label="Week starts">
          <PrefSelect
            className="w-[180px] shrink-0 justify-end"
            label="Week starts"
            name="weekStarts"
            onChange={(next) => setWeek(next as WeekStart)}
            options={[
              { value: "sunday", label: "Sunday" },
              { value: "monday", label: "Monday" },
            ]}
            submitOnChange
            value={week}
          />
        </PrefRow>
        <PrefRow border={false} label="Count partial plays">
          <PrefSelect
            className="w-[180px] shrink-0 justify-end"
            label="Count partial plays"
            name="countPartials"
            onChange={setPartials}
            options={[
              { value: "off", label: "Off" },
              { value: "on", label: "On" },
            ]}
            submitOnChange
            value={partials}
          />
        </PrefRow>
        <Flash error={prefsState?.error} info={prefsState?.info} />
      </form>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-bg-raised p-5">
        <p className="text-label font-semibold uppercase leading-label tracking-label text-fg-muted">
          History files
        </p>
        <p className="text-ui leading-[18px] text-fg-muted">
          JSON is the round-trip format. CSV is for spreadsheets. Import
          replaces nothing until you confirm the count.
        </p>
        <div className="flex flex-wrap gap-2">
          <a className={secondary} href="/settings/data/export?format=json">
            Export JSON
          </a>
          <a className={secondary} href="/settings/data/export?format=csv">
            Export CSV
          </a>
          <form action={importAction}>
            <input
              accept="application/json,.json"
              className="hidden"
              name="file"
              onChange={(event) => {
                event.currentTarget.form?.requestSubmit();
                event.currentTarget.value = "";
              }}
              ref={fileRef}
              type="file"
            />
            <button
              className={secondary}
              onClick={() => fileRef.current?.click()}
              type="button"
            >
              Import
            </button>
          </form>
        </div>
        {importPreviewCount > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-ui text-fg">
              {importPreviewCount} {importPreviewCount === 1 ? "play" : "plays"}{" "}
              ready to write. Existing plays are skipped.
            </p>
            <form action={confirmAction}>
              <PendingButton className={secondary} label="Confirm import" />
            </form>
            <form action={cancelAction}>
              <PendingButton className={secondary} label="Cancel" />
            </form>
          </div>
        ) : null}
        <Flash error={importState?.error} info={importState?.info} />
        <Flash error={confirmState?.error} info={confirmState?.info} />
        <Flash error={cancelState?.error} info={cancelState?.info} />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-sync-failed bg-bg-raised p-5">
        <p className="text-label font-semibold uppercase leading-label tracking-label text-sync-failed">
          Danger zone
        </p>
        <p className="text-meta leading-meta text-fg-muted">
          Each action asks you to type the name. None of these delete plays on
          Trakt unless the copy says so.
        </p>
        <DangerRow
          action="Clear"
          detail="Keeps local history. Forgets Trakt play ids."
          onClick={() => setDanger("clear")}
          title="Clear sync records"
        />
        <DangerRow
          action="Wipe"
          detail="Wipes SQLite. Does not touch Trakt."
          onClick={() => setDanger("wipe")}
          title="Clear all local data"
        />
        <DangerRow
          action="Forget"
          detail="Drops stored tokens. Trakt history stays."
          onClick={() => setDanger("forget")}
          title="Forget a connection"
        />
        <Flash error={clearState?.error} info={clearState?.info} />
        <Flash error={wipeState?.error} info={wipeState?.info} />
        <Flash error={forgetState?.error} info={forgetState?.info} />
      </section>

      {danger === "clear" ? (
        <ConfirmModal
          action={clearAction}
          error={clearState?.error}
          onClose={() => setDanger(null)}
          phrase="Clear sync records"
          title="Clear sync records"
        >
          Keeps local history. Forgets Trakt play ids stored on this machine.
          Trakt is not changed.
        </ConfirmModal>
      ) : null}
      {danger === "wipe" ? (
        <ConfirmModal
          action={wipeAction}
          error={wipeState?.error}
          onClose={() => setDanger(null)}
          phrase="Clear all local data"
          title="Clear all local data"
        >
          Wipes local watch history, sync records, and Trakt snapshots on this
          machine. Connections and login stay. Trakt is not changed.
        </ConfirmModal>
      ) : null}
      {danger === "forget" ? (
        <ConfirmModal
          action={forgetAction}
          error={forgetState?.error}
          extra={
            <label className="mt-4 block">
              <span className="text-meta leading-meta text-fg-muted">
                Connection
              </span>
              <select
                className="mt-1 w-full rounded-md border border-border bg-bg-overlay px-3 py-2 text-ui text-fg outline-none"
                defaultValue={
                  connections.find((row) => row.connected)?.provider ?? "tofa"
                }
                name="provider"
              >
                {connections.map((row) => (
                  <option key={row.provider} value={row.provider}>
                    {row.label}
                    {row.connected ? "" : " · not connected"}
                  </option>
                ))}
              </select>
            </label>
          }
          onClose={() => setDanger(null)}
          phrase="Forget a connection"
          title="Forget a connection"
        >
          Drops stored tokens for that provider. Trakt history stays.
        </ConfirmModal>
      ) : null}
    </div>
  );
}

function PrefRow({
  border = true,
  children,
  label,
}: {
  border?: boolean;
  children: ReactNode;
  label: string;
}) {
  return (
    <div
      className={`flex items-center py-[14px] ${border ? "border-b border-border" : ""}`}
    >
      <span className="grow basis-0 text-body leading-[18px] text-fg">
        {label}
      </span>
      {children}
    </div>
  );
}

function DangerRow({
  action,
  detail,
  onClick,
  title,
}: {
  action: string;
  detail: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <div className="flex items-center py-2.5">
      <div className="flex min-w-0 grow basis-0 flex-col gap-0.5">
        <p className="text-body leading-[18px] text-fg">{title}</p>
        <p className="text-meta leading-meta text-fg-muted">{detail}</p>
      </div>
      <button className={dangerBtn} onClick={onClick} type="button">
        {action}
      </button>
    </div>
  );
}

function ConfirmModal({
  action,
  children,
  error,
  extra,
  onClose,
  phrase,
  title,
}: {
  action: (form: FormData) => void;
  children: ReactNode;
  error?: string;
  extra?: ReactNode;
  onClose: () => void;
  phrase: string;
  title: string;
}) {
  const [confirm, setConfirm] = useState("");
  const matches = confirm.trim() === phrase;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-scrim px-4">
      <div className="w-full max-w-[560px] rounded-lg border border-border bg-bg-raised p-8">
        <p className="text-label font-semibold uppercase leading-label tracking-label text-sync-failed">
          Danger zone
        </p>
        <p className="mt-3 font-headline text-title-sm font-bold leading-title-sm">
          {title}
        </p>
        <p className="mt-3 text-ui leading-ui text-fg-muted">{children}</p>
        <form
          action={action}
          onSubmit={(event) => {
            if (confirm.trim() !== phrase) {
              event.preventDefault();
            }
          }}
        >
          {extra}
          <label className="mt-4 block">
            <span className="text-meta leading-meta text-fg-muted">
              Type {phrase}
            </span>
            <input
              autoComplete="off"
              className="mt-1 w-full rounded-md border border-border bg-bg-overlay px-3 py-2 text-ui text-fg outline-none"
              name="confirm"
              onChange={(event) => setConfirm(event.target.value)}
              placeholder={phrase}
              required
              value={confirm}
            />
          </label>
          {confirm.length > 0 && !matches ? (
            <p className="mt-2 text-meta leading-meta text-fg-muted">
              Must match exactly, including capitalization.
            </p>
          ) : null}
          <ModalError error={error} />
          <div className="mt-6 flex gap-2">
            <button className={secondary} onClick={onClose} type="button">
              Cancel
            </button>
            <PendingButton
              className={dangerBtn}
              disabled={!matches}
              label={title}
            />
          </div>
        </form>
      </div>
    </div>
  );
}

function PendingButton({
  className,
  disabled,
  label,
}: {
  className: string;
  disabled?: boolean;
  label: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={`${className} disabled:cursor-not-allowed disabled:opacity-40`}
      disabled={pending || disabled}
      type="submit"
    >
      {pending ? "Working…" : label}
    </button>
  );
}

function ModalError({ error }: { error?: string }) {
  const { pending } = useFormStatus();
  const sawPending = useRef(false);
  if (pending) {
    sawPending.current = true;
  }
  if (!sawPending.current || pending || !error) {
    return null;
  }
  return (
    <p className="mt-3 text-ui text-sync-failed" role="alert">
      {error}
    </p>
  );
}

function useCloseOnSuccess(
  open: boolean,
  pending: boolean,
  info: string | undefined,
  onClose: () => void,
) {
  const submitted = useRef(false);
  useEffect(() => {
    if (!open) {
      submitted.current = false;
      return;
    }
    if (pending) {
      submitted.current = true;
      return;
    }
    if (submitted.current && info) {
      submitted.current = false;
      onClose();
    }
  }, [info, onClose, open, pending]);
}

function Flash({ error, info }: { error?: string; info?: string }) {
  if (error) {
    return (
      <p className="pb-2 text-ui text-sync-failed" role="alert">
        {error}
      </p>
    );
  }
  if (info) {
    return <p className="pb-2 text-ui text-accent">{info}</p>;
  }
  return null;
}
