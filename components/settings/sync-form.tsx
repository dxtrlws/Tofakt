"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { PrefSelect } from "@/components/settings/pref-select";
import { BusyLabel } from "@/components/toast/busy-label";
import { useToastAction } from "@/components/toast/use-toast-action";
import {
  confirmBackfill,
  runReconcileNow,
  runSyncNow,
  saveSyncPrefs,
  setSyncMode,
  undoWatchlogPosts,
} from "@/lib/sync/actions";
import type { BackfillPreview } from "@/lib/sync/preview";
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
const danger =
  "rounded-md border border-sync-failed/40 bg-sync-failed/12 px-3.5 py-2 text-ui font-medium leading-[18px] text-sync-failed";

export function SyncSettingsForm({
  sync,
  movieThreshold,
  episodeThreshold,
  ingestEnabled,
  intervalMinutes,
  reconcileEnabled,
  reconcileEveryMinutes,
  preview,
  libraries,
  pending,
  postedCount,
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
  preview: BackfillPreview;
  libraries: { id: string; name: string; mediaType: string | null }[];
  pending: number;
  postedCount: number;
  jobLabel: string;
  username: string;
  traktUsername: string | null;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [undoOpen, setUndoOpen] = useState(false);
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
    busy: "Reconciling…",
  });
  const [, backfillAction] = useToastAction(confirmBackfill, {
    busy: "Queueing plays…",
  });
  const [, undoAction] = useToastAction(undoWatchlogPosts, {
    busy: "Removing Watchlog posts…",
  });
  const jobTitle = syncPending
    ? "Syncing"
    : reconPending
      ? "Reconciling"
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
        <button
          className="flex w-full items-start gap-3 rounded-md px-1 py-2 text-left"
          onClick={() => setPreviewOpen(true)}
          type="button"
        >
          <span
            className={`mt-1 size-3.5 shrink-0 rounded-full border ${
              sync.mode === "backfill"
                ? "border-accent bg-accent"
                : "border-fg-subtle"
            }`}
          />
          <span>
            <span className="block text-ui font-medium text-fg">
              Sync everything
            </span>
            <span className="mt-0.5 block text-meta leading-meta text-fg-muted">
              Queue the full history, including plays Newly watched only held
              back. Opens a preview before anything is sent to Trakt.
            </span>
            <span className="mt-1.5 block text-meta leading-meta text-status-warn">
              Use with caution. Trakt keeps each play you send, so a watch
              already on your account can land a second time if reconciliation
              missed it.
            </span>
          </span>
        </button>
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
          label="Ingest"
        >
          <ScheduleSelect
            currentMinutes={intervalMinutes}
            enabled={ingestEnabled}
            label="Ingest schedule"
            name="ingestSchedule"
            presets={INGEST_INTERVALS}
          />
        </PrefRow>
        <PrefRow
          hint="How often Watchlog downloads Trakt history and matches it to this ledger. This does not post plays."
          label="Reconciliation"
        >
          <ScheduleSelect
            currentMinutes={reconcileEveryMinutes}
            enabled={reconcileEnabled}
            label="Reconciliation schedule"
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
            <button
              className={secondary}
              onClick={() => setUndoOpen(true)}
              type="button"
            >
              Undo Watchlog posts
            </button>
            <form action={reconAction} aria-busy={reconPending || undefined}>
              <JobButton label="Re-run reconciliation" primary />
            </form>
          </div>
        </div>
        <p className="text-meta leading-meta text-fg-muted">
          Downloads your Trakt watch history and matches it to this ledger.
          Plays already on Trakt are marked synced and will not be sent again.
          This does not add or remove anything on Trakt.
        </p>
      </section>

      {previewOpen ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-scrim px-4">
          <div className="w-full max-w-[560px] rounded-lg border border-border bg-bg-raised p-8">
            <p className="text-label font-semibold uppercase leading-label tracking-label text-accent">
              Backfill preview
            </p>
            <p className="mt-3 font-headline text-title-sm font-bold leading-title-sm">
              Send {preview.eligible} plays to Trakt
            </p>
            <p className="mt-3 text-ui leading-ui text-fg-muted">
              {`${[
                `${preview.history} in history`,
                `${preview.eligible} above threshold`,
                `${preview.unmatched} unmatched skipped`,
                `${preview.alreadyOnTrakt} already on Trakt`,
                preview.earliestAt && preview.latestAt
                  ? formatRange(preview.earliestAt, preview.latestAt)
                  : null,
                preview.estimatedSeconds > 0
                  ? `about ${preview.estimatedSeconds}s at one request/sec`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}. This does not delete anything on Trakt.`}
            </p>
            <p className="mt-2 text-meta leading-meta text-status-warn">
              Trakt does not replace a matching play. If reconciliation missed
              one, this queue can create a duplicate. Use with caution.
            </p>
            {preview.snapshotCount === 0 ? (
              <p className="mt-2 text-meta leading-meta text-fg-muted">
                Re-run reconciliation first so plays already on Trakt are
                skipped.
              </p>
            ) : null}
            <div className="mt-6 flex gap-2">
              <button
                className={secondary}
                onClick={() => setPreviewOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <form action={backfillAction}>
                <button
                  className={primary}
                  onClick={() => setPreviewOpen(false)}
                  type="submit"
                >
                  Queue {preview.eligible} plays
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
      {undoOpen ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-scrim px-4">
          <div className="w-full max-w-[560px] rounded-lg border border-border bg-bg-raised p-8">
            <p className="text-label font-semibold uppercase leading-label tracking-label text-accent">
              Undo Watchlog posts
            </p>
            <p className="mt-3 font-headline text-title-sm font-bold leading-title-sm">
              {postedCount === 0
                ? "Nothing to remove"
                : `Remove ${postedCount} plays from Trakt`}
            </p>
            <p className="mt-3 text-ui leading-ui text-fg-muted">
              {postedCount === 0
                ? "Watchlog has not posted any plays yet. Plays that were already on your Trakt account are never included here."
                : "Only plays Watchlog sent are removed. Plays that were already on your Trakt account stay put. Each History row can still remove one matched play."}
            </p>
            {postedCount > 0 ? (
              <p className="mt-2 text-meta leading-meta text-status-warn">
                This deletes those history rows on Trakt. It cannot be undone
                except by syncing them again.
              </p>
            ) : null}
            <div className="mt-6 flex gap-2">
              <button
                className={secondary}
                onClick={() => setUndoOpen(false)}
                type="button"
              >
                Cancel
              </button>
              {postedCount > 0 ? (
                <form action={undoAction}>
                  <button
                    className={danger}
                    onClick={() => setUndoOpen(false)}
                    type="submit"
                  >
                    Remove {postedCount} plays
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
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

function formatRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}
