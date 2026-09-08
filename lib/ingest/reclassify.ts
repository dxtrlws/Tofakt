import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { mediaItems, watchEvents } from "../db/schema";
import { logger } from "../logger";
import { getSyncSettings } from "../sync/settings";
import { playSessionSchema } from "../tofa/history";
import { evaluatePlay } from "./evaluate";
import type { Thresholds } from "./persist";
import { upsertSyncRecord, upsertWatchEvent } from "./persist";

export function reclassifyStoredPlays(thresholds: Thresholds): number {
  const sync = getSyncSettings();
  const rows = getDb()
    .select({
      event: watchEvents,
      media: mediaItems,
    })
    .from(watchEvents)
    .leftJoin(mediaItems, eq(mediaItems.id, watchEvents.mediaItemId))
    .all();
  let updated = 0;
  for (const row of rows) {
    if (!row.event.rawJson || !row.media) {
      continue;
    }
    let play: ReturnType<typeof playSessionSchema.parse>;
    try {
      play = playSessionSchema.parse(JSON.parse(row.event.rawJson));
    } catch {
      continue;
    }
    const media = {
      kind:
        row.media.kind === "episode"
          ? ("episode" as const)
          : ("movie" as const),
      runtimeSeconds: row.media.runtimeSeconds,
      tofaLibraryId: row.media.tofaLibraryId,
    };
    const evaluated = evaluatePlay(play, media, thresholds, sync);
    upsertWatchEvent(row.media.id, {
      dedupeKey: row.event.dedupeKey,
      dedupeStrategy:
        row.event.dedupeStrategy === "fingerprint"
          ? "fingerprint"
          : "tofa_history_id",
      tofaHistoryId: row.event.tofaHistoryId,
      tofaUserId: row.event.tofaUserId,
      watchedAt: evaluated.watchedAt,
      timestampConvention: evaluated.convention,
      durationWatchedSeconds: evaluated.durationWatchedSeconds,
      completionPercent: evaluated.completionPercent,
      isComplete: evaluated.isComplete,
      deviceName: row.event.deviceName,
      rawJson: row.event.rawJson,
    });
    upsertSyncRecord(
      row.event.id,
      media.kind,
      row.media,
      {
        progressPercent: play.progress_percent ?? evaluated.completionPercent,
        durationWatchedSeconds: evaluated.durationWatchedSeconds,
        runtimeSeconds: row.media.runtimeSeconds,
        isPlayback: evaluated.isPlayback,
        libraryExcluded: evaluated.libraryExcluded,
        beforeCutoff: evaluated.beforeCutoff,
        reclassify: true,
      },
      thresholds,
    );
    updated += 1;
  }
  if (updated > 0) {
    logger.info({ updated }, "Reclassified stored plays");
  }
  return updated;
}
