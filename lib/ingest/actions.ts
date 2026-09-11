"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { writeAudit } from "../audit/audit";
import { assertSameOrigin } from "../auth/csrf";
import { requireUser } from "../auth/require";
import { getDb } from "../db";
import { mediaItems, syncRecords, watchEvents } from "../db/schema";
import type { ActionFlash } from "../toast/flash";
import { reply } from "../toast/persist";
import { eligibilityForEvent } from "./eligibility";
import { getIngestSettings, runIngest } from "./run";
import { isPlaybackSession } from "./timestamps";

export type IngestActionState = ActionFlash;

async function guard(): Promise<{ error: string } | null> {
  await requireUser();
  return assertSameOrigin();
}

export async function runIngestNow(
  _prev: IngestActionState | undefined,
  _form?: FormData,
): Promise<IngestActionState> {
  const blocked = await guard();
  if (blocked) {
    return reply(blocked);
  }
  const stats = await runIngest();
  revalidatePath("/history");
  revalidatePath("/settings/about");
  revalidatePath("/settings/logs");
  if (stats.error) {
    return reply({ error: stats.error });
  }
  return reply({
    info: `Ingested ${stats.inserted} new plays (${stats.updated} already stored).`,
  });
}

export async function ignoreWatchEvent(
  formData: FormData,
): Promise<IngestActionState> {
  const blocked = await guard();
  if (blocked) {
    return reply(blocked);
  }
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) {
    return reply({ error: "Missing play." });
  }
  const record = getDb()
    .select()
    .from(syncRecords)
    .where(eq(syncRecords.watchEventId, eventId))
    .get();
  if (!record) {
    return reply({ error: "This play has no sync record." });
  }
  getDb()
    .update(syncRecords)
    .set({ status: "skipped", skipReason: "user_ignored" })
    .where(eq(syncRecords.id, record.id))
    .run();
  writeAudit({
    action: "history.ignore",
    subjectType: "watch_event",
    subjectId: eventId,
  });
  revalidatePath("/history");
  return reply({ info: "This play will not sync." });
}

export async function unignoreWatchEvent(
  formData: FormData,
): Promise<IngestActionState> {
  const blocked = await guard();
  if (blocked) {
    return reply(blocked);
  }
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) {
    return reply({ error: "Missing play." });
  }
  const event = getDb()
    .select()
    .from(watchEvents)
    .where(eq(watchEvents.id, eventId))
    .get();
  if (!event) {
    return reply({ error: "This play is gone." });
  }
  const media = event.mediaItemId
    ? getDb()
        .select()
        .from(mediaItems)
        .where(eq(mediaItems.id, event.mediaItemId))
        .get()
    : undefined;
  const thresholds = getIngestSettings();
  const result = eligibilityForEvent({
    kind: media?.kind === "episode" ? "episode" : "movie",
    progressPercent: event.completionPercent,
    durationWatchedSeconds: event.durationWatchedSeconds,
    runtimeSeconds: media?.runtimeSeconds ?? null,
    movieThreshold: thresholds.movieThreshold,
    episodeThreshold: thresholds.episodeThreshold,
    tmdbId: media?.tmdbId,
    imdbId: media?.imdbId,
    tvdbId: media?.tvdbId,
    showTmdbId: media?.showTmdbId,
    seasonNumber: media?.seasonNumber,
    episodeNumber: media?.episodeNumber,
    isPlayback: playbackFromRaw(event.rawJson),
  });
  getDb()
    .update(syncRecords)
    .set({ status: result.status, skipReason: result.skipReason })
    .where(eq(syncRecords.watchEventId, eventId))
    .run();
  writeAudit({
    action: "history.unignore",
    subjectType: "watch_event",
    subjectId: eventId,
  });
  revalidatePath("/history");
  return reply({ info: "This play is eligible again." });
}

function playbackFromRaw(rawJson: string | null): boolean {
  if (!rawJson) {
    return true;
  }
  try {
    const play = JSON.parse(rawJson) as {
      started_at?: string;
      ended_at?: string | null;
    };
    if (!play.started_at) {
      return true;
    }
    return isPlaybackSession({
      startedAt: play.started_at,
      endedAt: play.ended_at,
    });
  } catch {
    return true;
  }
}
