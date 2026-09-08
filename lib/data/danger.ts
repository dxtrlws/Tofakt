import { writeAudit } from "../audit";
import { deleteConnection } from "../connections/store";
import type { Provider } from "../connections/types";
import { getDb, getSqlite } from "../db";
import { mediaItems, syncRecords, watchEvents } from "../db/schema";
import { setSettingJson } from "../settings";

export function clearSyncRecords(): number {
  const count = getDb()
    .select({ id: syncRecords.id })
    .from(syncRecords)
    .all().length;
  getSqlite().exec("delete from sync_records");
  writeAudit({
    action: "data.clear_sync_records",
    subjectType: "sync_records",
    detail: { count },
  });
  return count;
}

export function wipeLocalHistory(): void {
  const sqlite = getSqlite();
  sqlite.transaction(() => {
    sqlite.exec("delete from sync_records");
    sqlite.exec("delete from watch_events");
    sqlite.exec("delete from ratings");
    sqlite.exec("delete from provider_snapshots");
    sqlite.exec("delete from media_genres");
    sqlite.exec("delete from media_items");
    sqlite.exec("delete from genres");
    sqlite.exec("delete from trakt_history_snapshot");
    sqlite.exec("delete from job_runs");
    sqlite.exec(
      "update jobs set status = 'idle', started_at = null, finished_at = null, stats_json = null, error = null, items_processed = 0",
    );
  })();
  setSettingJson("ingest.watermark", { lastStartedAtSeen: null });
  setSettingJson("ingest.last_stats", null);
  setSettingJson("sync.last_stats", null);
  setSettingJson("data.import_preview", null);
  writeAudit({
    action: "data.wipe_local_history",
    subjectType: "watch_events",
  });
}

export function forgetProvider(provider: Provider): void {
  deleteConnection(provider);
  writeAudit({
    action: "data.forget_connection",
    subjectType: "connection",
    subjectId: provider,
  });
}

export function syncRecordCount(): number {
  return getDb().select({ id: syncRecords.id }).from(syncRecords).all().length;
}

export function watchEventTotal(): number {
  return getDb().select({ id: watchEvents.id }).from(watchEvents).all().length;
}

export function mediaItemCount(): number {
  return getDb().select({ id: mediaItems.id }).from(mediaItems).all().length;
}
