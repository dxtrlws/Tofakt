"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { PrefSelect } from "@/components/settings/pref-select";
import { BusyLabel } from "@/components/toast/busy-label";
import { useToastAction } from "@/components/toast/use-toast-action";
import {
  runReconcileNow,
  runSyncNow,
  saveSyncPrefs,
  setSyncMode,
} from "@/lib/sync/actions";
import {
  formatScheduleLabel,
  INGEST_INTERVALS,
  RECONCILE_INTERVALS,
  scheduleOptions,
  scheduleSelectValue,
} from "@/lib/sync/schedule";
import type { SyncSettings } from "@/lib/sync/settings";

const card =
  "flex flex-col gap-3 rounded-lg border border-border bg-bg-raised p-5";
const field =
  "w-24 shrink-0 rounded-md border border-border bg-bg-overlay px-3 py-1.5 text-right text-ui text-fg outline-none";
const primary =
  "rounded-md bg-accent px-3.5 py-2 text-ui font-medium leading-[18px] text-fg-on-accent";
const secondary =
  "rounded-md border border-border bg-bg-overlay px-3.5 py-2 text-ui font-medium leading-[18px] text-fg";

export function SyncSettingsForm({
  sync,
  movieThreshold,
  episodeThreshold,
  ingestEnabled,
  intervalMinutes,
  reconcileEnabled,
  reconcileEveryMinutes,
  libraries,
  pending,
  jobLabel,
  username,
  traktUsername,
}: {
  sync: SyncSettings;
  movieThreshold: number;
  episodeThreshold: number;
  ingestEnabled: boolean;
  intervalMinutes: number;
  reconcileEnabled: boolean;
  reconcileEveryMinutes: number;
  libraries: { id: string; name: string; mediaType: string | null }[];
  pending: number;
  jobLabel: string;
  username: string;
  traktUsername: string | null;
}) {
  const [, modeAction, modePending] = useToastAction(setSyncMode, {
    busy: "Saving mode…",
  });
  const [, prefsAction, prefsPending] = useToastAction(saveSyncPrefs, {
    busy: "Saving preferences…",
  });
  const [, syncAction, syncPending] = useToastAction(runSyncNow, {
    busy: "Syncing plays…",
  });
  const [, reconAction, reconPending] = useToastAction(runReconcileNow, {
    busy: "Importing from Trakt…",
  });
  const jobTitle = syncPending
    ? "Syncing"
    : reconPending
      ? "Importing from Trakt"
      : "Idle";

  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <p className="text-label font-semibold uppercase leading-label tracking-label text-fg-muted">
          Mode
        </p>
        <div
          aria-busy={modePending || undefined}
          aria-label="Sync mode"
          className="flex flex-col gap-2"
          role="radiogroup"
        >
          <form
            action={modeAction}
            className="flex flex-col gap-2"
            key={sync.mode}
          >
            <ModeOption
              checked={sync.mode === "forward"}
              description="Only plays that finish after you turn this on become pending. Nothing is sent until you click Run sync now or Sync now on a row. Older plays stay in History as Not synced unless you use Sync now."
              disabled={modePending}
              name="Newly watched only"
              value="forward"
            />
            <ModeOption
              checked={sync.mode === "manual"}
              description="Nothing is sent unless you click Run sync now or Sync now on a row. Eligible plays stay Pending, including ones Newly watched only had held back."
              disabled={modePending}
              name="Manual"
              value="manual"
            />
          </form>
        </div>
      </section>

      <form
        action={prefsAction}
        aria-busy={prefsPending || undefined}
        className={card}
        key={`${ingestEnabled}-${intervalMinutes}-${reconcileEnabled}-${reconcileEveryMinutes}`}
      >
        <p className="text-label font-semibold uppercase leading-label tracking-label text-fg-muted">
          Schedule
        </p>
        <PrefRow
          hint="How often Watchlog pulls new plays from tofa. Does not send plays to Trakt."
          label="Import from Tofa"
        >
          <ScheduleSelect
            currentMinutes={intervalMinutes}
            enabled={ingestEnabled}
            label="Import from Tofa schedule"
            name="ingestSchedule"
            presets={INGEST_INTERVALS}
          />
        </PrefRow>
        <PrefRow
          hint="How often Watchlog downloads Trakt history for reviews and duplicate checks. This does not post plays or change sync status."
          label="Import from Trakt"
        >
          <ScheduleSelect
            currentMinutes={reconcileEveryMinutes}
            enabled={reconcileEnabled}
            label="Import from Trakt schedule"
            name="reconcileSchedule"
            presets={RECONCILE_INTERVALS}
          />
        </PrefRow>
        <PrefRow
          hint="A movie is eligible to sync once playback reaches this percent."
          htmlFor="movie-threshold"
          label="Movie completion"
        >
          <input
            aria-describedby="movie-threshold-hint"
            className={field}
            defaultValue={movieThreshold}
            id="movie-threshold"
            max={100}
            min={1}
            name="movieThreshold"
            type="number"
          />
        </PrefRow>
        <PrefRow
          hint="An episode is eligible to sync once playback reaches this percent."
          htmlFor="episode-threshold"
          label="Episode completion"
        >
          <input
            aria-describedby="episode-threshold-hint"
            className={field}
            defaultValue={episodeThreshold}
            id="episode-threshold"
            max={100}
            min={1}
            name="episodeThreshold"
            type="number"
          />
        </PrefRow>
        <PrefRow
          hint="History is ingested for this tofa account."
          label="tofa user"
        >
          <span className="text-ui text-fg-muted">{username}</span>
        </PrefRow>
        <PrefRow
          hint="Plays are sent to this Trakt account."
          label="Trakt user"
        >
          <span className="text-ui text-fg-muted">
            {traktUsername ?? "Not connected"}
          </span>
        </PrefRow>
        <PrefRow
          hint="A local play matches one already on Trakt if the timestamps are within this many minutes."
          htmlFor="window-minutes"
          label="Reconciliation window"
        >
          <input
            aria-describedby="window-minutes-hint"
            className={field}
            defaultValue={sync.windowMinutes}
            id="window-minutes"
            max={180}
            min={1}
            name="windowMinutes"
            type="number"
          />
        </PrefRow>
        {libraries.length > 0 ? (
          <div className="flex flex-col gap-2 pt-2">
            <p className="text-ui font-semibold text-fg">Libraries</p>
            <p className="text-meta leading-meta text-fg-muted">
              Uncheck a library to keep its plays in the ledger without sending
              them to Trakt.
            </p>
            {libraries.map((library) => (
              <label
                className="flex items-center justify-between gap-3 text-ui"
                key={library.id}
              >
                <span>
                  {library.name}
                  {library.mediaType ? (
                    <span className="text-fg-muted">
                      {" "}
                      · {library.mediaType}
                    </span>
                  ) : null}
                </span>
                <input name="libraryId" type="hidden" value={library.id} />
                <input
                  className="size-4 accent-accent"
                  defaultChecked={!sync.excludedLibraryIds.includes(library.id)}
                  name="includedLibrary"
                  type="checkbox"
                  value={library.id}
                />
              </label>
            ))}
          </div>
        ) : null}
        <SavePrefs />
      </form>

      <section className={card}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-body font-semibold">{jobTitle}</p>
            <p className="text-meta leading-meta text-fg-muted">{jobLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={syncAction} aria-busy={syncPending || undefined}>
              <JobButton label="Run sync now" />
            </form>
            <form action={reconAction} aria-busy={reconPending || undefined}>
              <JobButton label="Import from Trakt" primary />
            </form>
          </div>
        </div>
        <p className="text-meta leading-meta text-fg-muted">
          Downloads your Trakt watch history for reviews and duplicate checks.
          This does not add, remove, or mark local plays as synced. Matching
          happens when you run a sync.
        </p>
      </section>
      <p className="sr-only">{pending} pending</p>
    </div>
  );
}

function ModeOption({
  checked,
  description,
  disabled,
  name,
  value,
}: {
  checked: boolean;
  description: string;
  disabled?: boolean;
  name: string;
  value: string;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a submitter is required for React 19 server actions
    <button
      aria-checked={checked}
      className="flex w-full cursor-pointer items-start gap-3 rounded-md px-1 py-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled}
      name="mode"
      role="radio"
      type="submit"
      value={value}
    >
      <span
        className={`mt-1 size-3.5 shrink-0 rounded-full border ${
          checked ? "border-accent bg-accent" : "border-fg-subtle"
        }`}
      />
      <span>
        <span className="block text-ui font-medium text-fg">{name}</span>
        <span className="mt-0.5 block text-meta leading-meta text-fg-muted">
          {description}
        </span>
      </span>
    </button>
  );
}

function PrefRow({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  const hintId = htmlFor ? `${htmlFor}-hint` : undefined;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        {htmlFor ? (
          <label className="text-ui text-fg" htmlFor={htmlFor}>
            {label}
          </label>
        ) : (
          <p className="text-ui text-fg">{label}</p>
        )}
        {hint ? (
          <p
            className="mt-0.5 max-w-[28rem] text-meta leading-meta text-fg-muted"
            id={hintId}
          >
            {hint}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function ScheduleSelect({
  currentMinutes,
  enabled,
  label,
  name,
  presets,
}: {
  currentMinutes: number;
  enabled: boolean;
  label: string;
  name: string;
  presets: readonly number[];
}) {
  const [value, setValue] = useState(() =>
    scheduleSelectValue(enabled, currentMinutes),
  );
  return (
    <PrefSelect
      className="w-[180px] shrink-0 justify-end"
      label={label}
      name={name}
      onChange={setValue}
      options={[
        { value: "off", label: "Off" },
        ...scheduleOptions(presets, currentMinutes).map((minutes) => ({
          value: String(minutes),
          label: formatScheduleLabel(minutes),
        })),
      ]}
      value={value}
    />
  );
}

function SavePrefs() {
  const { pending } = useFormStatus();
  return (
    <button
      aria-busy={pending || undefined}
      className={`${secondary} self-end`}
      disabled={pending}
      type="submit"
    >
      <BusyLabel busy="Saving…" idle="Save preferences" pending={pending} />
    </button>
  );
}

function JobButton({
  label,
  primary: isPrimary,
}: {
  label: string;
  primary?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      aria-busy={pending || undefined}
      className={isPrimary ? primary : secondary}
      disabled={pending}
      type="submit"
    >
      <BusyLabel busy="Working…" idle={label} pending={pending} />
    </button>
  );
}
