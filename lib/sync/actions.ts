"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { writeAudit } from "../audit";
import { assertSameOrigin } from "../auth/csrf";
import { requireUser } from "../auth/require";
import { getConnection, readAccessToken } from "../connections/store";
import { getDb } from "../db";
import { jobs, syncRecords } from "../db/schema";
import { getIngestSettings } from "../ingest/run";
import { restartScheduler } from "../scheduler";
import { setSettingJson } from "../settings";
import { tofaLibraries } from "../tofa/client";
import {
  applyForwardCutoff,
  backfillPreview,
  clearBeforeCutoff,
} from "./preview";
import { pullTraktHistory } from "./reconcile";
import { removeOnePlay, removeWatchlogPosts } from "./remove";
import { runSync } from "./run";
import {
  INGEST_INTERVAL_MAX,
  INGEST_INTERVAL_MIN,
  parseScheduleValue,
  RECONCILE_INTERVAL_MAX,
  RECONCILE_INTERVAL_MIN,
} from "./schedule";
import { getSyncSettings, type SyncMode, saveSyncSettings } from "./settings";

export type SyncActionState = { error?: string; info?: string };

async function guard() {
  await requireUser();
  return assertSameOrigin();
}

function refresh() {
  revalidatePath("/settings/sync");
  revalidatePath("/history");
  revalidatePath("/settings/about");
  revalidatePath("/settings/logs");
}

export async function saveSyncPrefs(
  _prev: SyncActionState | undefined,
  form: FormData,
): Promise<SyncActionState> {
  const blocked = await guard();
  if (blocked) {
    return blocked;
  }
  const movie = Number(form.get("movieThreshold"));
  const episode = Number(form.get("episodeThreshold"));
  const windowMinutes = Number(form.get("windowMinutes"));
  const ingest = getIngestSettings();
  const sync = getSyncSettings();
  const ingestSchedule = parseScheduleValue(
    form.get("ingestSchedule"),
    { enabled: ingest.ingestEnabled, minutes: ingest.intervalMinutes },
    INGEST_INTERVAL_MIN,
    INGEST_INTERVAL_MAX,
  );
  const reconcileSchedule = parseScheduleValue(
    form.get("reconcileSchedule"),
    {
      enabled: sync.reconcileEnabled,
      minutes: sync.reconcileEveryMinutes,
    },
    RECONCILE_INTERVAL_MIN,
    RECONCILE_INTERVAL_MAX,
  );
  const included = new Set(form.getAll("includedLibrary").map(String));
  const allLibraries = form.getAll("libraryId").map(String);
  const excluded = allLibraries.filter((id) => !included.has(id));
  setSettingJson("ingest.settings", {
    ...ingest,
    movieThreshold: movie,
    episodeThreshold: episode,
    intervalMinutes: ingestSchedule.minutes,
    ingestEnabled: ingestSchedule.enabled,
  });
  saveSyncSettings({
    windowMinutes,
    timestampConvention: "completion",
    excludedLibraryIds: excluded,
    reconcileEnabled: reconcileSchedule.enabled,
    reconcileEveryMinutes: reconcileSchedule.minutes,
  });
  writeAudit({
    action: "sync.save_prefs",
    subjectType: "settings",
    detail: {
      movie,
      episode,
      ingestEnabled: ingestSchedule.enabled,
      interval: ingestSchedule.minutes,
      reconcileEnabled: reconcileSchedule.enabled,
      reconcileEveryMinutes: reconcileSchedule.minutes,
      windowMinutes,
    },
  });
  restartScheduler();
  refresh();
  return { info: "Sync preferences saved." };
}

export async function setSyncMode(
  _prev: SyncActionState | undefined,
  form: FormData,
): Promise<SyncActionState> {
  const blocked = await guard();
  if (blocked) {
    return blocked;
  }
  const mode = String(form.get("mode")) as SyncMode;
  if (mode === "manual") {
    saveSyncSettings({ mode: "manual", cutoffIso: null });
    clearBeforeCutoff();
    writeAudit({
      action: "sync.set_mode",
      subjectType: "settings",
      detail: { mode: "manual" },
    });
    refresh();
    return {
      info: "Manual mode. Eligible plays are pending until you run a job or sync a row. Nothing is sent automatically.",
    };
  }
  if (mode === "forward") {
    const cutoff = new Date();
    saveSyncSettings({
      mode: "forward",
      cutoffIso: cutoff.toISOString(),
    });
    applyForwardCutoff(cutoff);
    writeAudit({
      action: "sync.set_mode",
      subjectType: "settings",
      detail: { mode: "forward" },
    });
    refresh();
    return {
      info: "Only plays that finish after now will queue for Trakt. Older plays stay Not synced unless you sync a row.",
    };
  }
  if (mode === "backfill") {
    return { error: "Confirm the backfill preview first." };
  }
  return { error: "Unknown sync mode." };
}

export async function confirmBackfill(
  _prev: SyncActionState | undefined,
  _form?: FormData,
): Promise<SyncActionState> {
  const blocked = await guard();
  if (blocked) {
    return blocked;
  }
  saveSyncSettings({
    mode: "backfill",
    backfillConfirmedAt: new Date().toISOString(),
  });
  clearBeforeCutoff();
  const preview = backfillPreview();
  writeAudit({
    action: "sync.backfill_confirm",
    subjectType: "settings",
    detail: { eligible: preview.eligible },
  });
  refresh();
  return {
    info: `Queued ${preview.eligible} plays for Trakt. Run sync to send them.`,
  };
}

export async function runSyncNow(
  _prev: SyncActionState | undefined,
  _form?: FormData,
): Promise<SyncActionState> {
  const blocked = await guard();
  if (blocked) {
    return blocked;
  }
  const stats = await runSync({ force: true });
  refresh();
  if (stats.error) {
    return { error: stats.error };
  }
  return {
    info: `Synced ${stats.synced} (${stats.alreadyOnTrakt} already on Trakt, ${stats.unmatched} unmatched).`,
  };
}

export async function runReconcileNow(
  _prev: SyncActionState | undefined,
  _form?: FormData,
): Promise<SyncActionState> {
  const blocked = await guard();
  if (blocked) {
    return blocked;
  }
  const pulled = await pullTraktHistory();
  writeAudit({
    action: "sync.reconcile",
    subjectType: "trakt",
    detail: { count: pulled.count, error: pulled.error },
  });
  refresh();
  if (pulled.error) {
    return { error: pulled.error };
  }
  return { info: `Loaded ${pulled.count} plays from Trakt history.` };
}

export async function syncWatchEvent(formData: FormData): Promise<void> {
  const blocked = await guard();
  if (blocked) {
    return;
  }
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) {
    return;
  }
  await runSync({ eventIds: [eventId], ignoreCutoff: true, force: true });
  refresh();
}

export async function removeWatchEvent(formData: FormData): Promise<void> {
  const blocked = await guard();
  if (blocked) {
    return;
  }
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) {
    return;
  }
  await removeOnePlay(eventId);
  writeAudit({
    action: "sync.remove_play",
    subjectType: "watch_event",
    subjectId: eventId,
  });
  refresh();
}

export async function undoWatchlogPosts(
  _prev: SyncActionState | undefined,
  _form?: FormData,
): Promise<SyncActionState> {
  const blocked = await guard();
  if (blocked) {
    return blocked;
  }
  const stats = await removeWatchlogPosts();
  writeAudit({
    action: "sync.undo_watchlog_posts",
    subjectType: "trakt",
    detail: stats,
  });
  refresh();
  if (stats.error) {
    return { error: stats.error };
  }
  if (stats.removed === 0) {
    return {
      info: "Watchlog has not posted any plays to Trakt yet.",
    };
  }
  return {
    info: `Removed ${stats.removed} Watchlog-posted plays from Trakt.`,
  };
}

export async function retryWatchEvent(formData: FormData): Promise<void> {
  const blocked = await guard();
  if (blocked) {
    return;
  }
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) {
    return;
  }
  getDb()
    .update(syncRecords)
    .set({
      status: "pending",
      attempts: 0,
      lastErrorCode: null,
      lastErrorMessage: null,
      nextAttemptAt: null,
    })
    .where(eq(syncRecords.watchEventId, eventId))
    .run();
  await runSync({ eventIds: [eventId], ignoreCutoff: true, force: true });
  refresh();
}

export async function listTofaLibraries() {
  await requireUser();
  const row = getConnection("tofa");
  const token = row ? readAccessToken(row) : null;
  if (!row?.baseUrl || !token) {
    return [] as { id: string; name: string; mediaType: string | null }[];
  }
  try {
    const libraries = await tofaLibraries(row.baseUrl, token);
    return libraries.map((lib) => ({
      id: lib.id,
      name: lib.name,
      mediaType: lib.media_type ?? null,
    }));
  } catch {
    return [];
  }
}

export async function lastJobTimes() {
  await requireUser();
  const ingest = getDb().select().from(jobs).where(eq(jobs.id, "ingest")).get();
  const reconcile = getDb()
    .select()
    .from(jobs)
    .where(eq(jobs.id, "reconcile"))
    .get();
  const sync = getDb().select().from(jobs).where(eq(jobs.id, "sync")).get();
  return {
    ingestFinishedAt: ingest?.finishedAt ?? null,
    reconcileFinishedAt: reconcile?.finishedAt ?? null,
    syncFinishedAt: sync?.finishedAt ?? null,
    ingestStatus: ingest?.status ?? "Idle",
    reconcileStatus: reconcile?.status ?? "Idle",
    syncStatus: sync?.status ?? "Idle",
  };
}
