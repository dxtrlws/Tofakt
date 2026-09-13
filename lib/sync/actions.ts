"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { writeAudit } from "../audit/audit";
import { assertSameOrigin } from "../auth/csrf";
import { requireUser } from "../auth/require";
import { getConnection, readAccessToken } from "../connections/store";
import { setSettingJson } from "../data/settings";
import { getDb } from "../db";
import { jobs, syncRecords } from "../db/schema";
import { getIngestSettings } from "../ingest/run";
import { restartScheduler } from "../scheduler";
import type { ActionFlash } from "../toast/flash";
import { reply } from "../toast/persist";
import { tofaLibraries } from "../tofa/client";
import { applyForwardCutoff, clearBeforeCutoff } from "./preview";
import { pullTraktHistory } from "./reconcile";
import { removeOnePlay } from "./remove";
import { runSync, type SyncStats } from "./run";
import {
  INGEST_INTERVAL_MAX,
  INGEST_INTERVAL_MIN,
  parseScheduleValue,
  RECONCILE_INTERVAL_MAX,
  RECONCILE_INTERVAL_MIN,
} from "./schedule";
import { getSyncSettings, type SyncMode, saveSyncSettings } from "./settings";

export type SyncActionState = ActionFlash;

async function guard() {
  await requireUser();
  return assertSameOrigin();
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/settings", "layout");
  revalidatePath("/settings/sync");
  revalidatePath("/history");
  revalidatePath("/monthly");
  revalidatePath("/year");
  revalidatePath("/settings/about");
  revalidatePath("/settings/logs");
}

export async function saveSyncPrefs(
  _prev: SyncActionState | undefined,
  form: FormData,
): Promise<SyncActionState> {
  const blocked = await guard();
  if (blocked) {
    return reply(blocked);
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
  return reply({ info: "Sync preferences saved." }, refresh);
}

export async function setSyncMode(
  _prev: SyncActionState | undefined,
  form: FormData,
): Promise<SyncActionState> {
  const blocked = await guard();
  if (blocked) {
    return reply(blocked);
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
    const flash = {
      info: "Manual mode. Eligible plays are pending until you run a job or sync a row. Nothing is sent automatically.",
    };
    return reply(flash, refresh);
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
    const flash = {
      info: "Only plays that finish after now will queue as pending. Nothing is sent until you run a sync. Older plays stay Not synced unless you sync a row.",
    };
    return reply(flash, refresh);
  }
  return reply({ error: "Unknown sync mode." });
}

export async function runSyncNow(
  _prev: SyncActionState | undefined,
  _form?: FormData,
): Promise<SyncActionState> {
  const blocked = await guard();
  if (blocked) {
    return reply(blocked);
  }
  const stats = await runSync({ force: true });
  return reply(syncJobFlash(stats), refresh);
}

export async function runReconcileNow(
  _prev: SyncActionState | undefined,
  _form?: FormData,
): Promise<SyncActionState> {
  const blocked = await guard();
  if (blocked) {
    return reply(blocked);
  }
  const pulled = await pullTraktHistory();
  writeAudit({
    action: "sync.reconcile",
    subjectType: "trakt",
    detail: { count: pulled.count, error: pulled.error },
  });
  if (pulled.error) {
    return reply({ error: pulled.error }, refresh);
  }
  return reply(
    {
      info: `Loaded ${pulled.count} plays from Trakt history. Pending plays stay pending until you run a sync.`,
    },
    refresh,
  );
}

export async function syncWatchEvent(
  formData: FormData,
): Promise<SyncActionState> {
  const blocked = await guard();
  if (blocked) {
    return reply(blocked);
  }
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) {
    return reply({ error: "Missing play." });
  }
  const stats = await runSync({
    eventIds: [eventId],
    ignoreCutoff: true,
    force: true,
  });
  return reply(syncJobFlash(stats, true), refresh);
}

export async function removeWatchEvent(
  _prev: SyncActionState | undefined,
  form: FormData,
): Promise<SyncActionState> {
  const blocked = await guard();
  if (blocked) {
    return reply(blocked);
  }
  const eventId = String(form.get("eventId") ?? "");
  if (!eventId) {
    return reply({ error: "Missing play." });
  }
  const stats = await removeOnePlay(eventId);
  if (stats.removed > 0 || stats.cleared > 0) {
    writeAudit({
      action: "sync.remove_play",
      subjectType: "watch_event",
      subjectId: eventId,
      detail: stats,
    });
  }
  if (stats.error) {
    return reply({ error: stats.error }, refresh);
  }
  if (stats.removed > 0) {
    return reply({ info: "Removed this play from Trakt." }, refresh);
  }
  if (stats.cleared > 0) {
    return reply(
      {
        info: "This play was not on Trakt. Sync status was reset so you can sync it again.",
      },
      refresh,
    );
  }
  return reply(
    {
      error:
        "Could not remove this play from Trakt. Re-run reconciliation, then try again.",
    },
    refresh,
  );
}

export async function retryWatchEvent(
  formData: FormData,
): Promise<SyncActionState> {
  const blocked = await guard();
  if (blocked) {
    return reply(blocked);
  }
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) {
    return reply({ error: "Missing play." });
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
  const stats = await runSync({
    eventIds: [eventId],
    ignoreCutoff: true,
    force: true,
  });
  return reply(syncJobFlash(stats, true), refresh);
}

function syncJobFlash(stats: SyncStats, onePlay = false): SyncActionState {
  if (stats.error) {
    return { error: stats.error };
  }
  if (onePlay) {
    if (stats.unmatched > 0) {
      return {
        info: "This play is unmatched. Trakt could not identify it.",
        level: "warn",
      };
    }
    if (stats.failed > 0) {
      return { info: "This play failed to sync.", level: "warn" };
    }
    if (stats.synced > 0) {
      return { info: "Synced this play." };
    }
    return { info: "Nothing to sync for this play." };
  }
  const info = `Synced ${stats.synced} (${stats.alreadyOnTrakt} already on Trakt, ${stats.unmatched} unmatched).`;
  if (stats.unmatched > 0 || stats.failed > 0) {
    return { info, level: "warn" };
  }
  return { info };
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
