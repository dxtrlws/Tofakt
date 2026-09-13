import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { syncRecords, watchEvents } from "../db/schema";

function countByStatus(
  status: "pending" | "synced" | "failed" | "unmatched" | "skipped",
): number {
  const row = getDb()
    .select({ n: sql<number>`count(*)` })
    .from(syncRecords)
    .innerJoin(watchEvents, eq(watchEvents.id, syncRecords.watchEventId))
    .where(
      and(eq(syncRecords.status, status), eq(watchEvents.isComplete, true)),
    )
    .get();
  return Number(row?.n ?? 0);
}

export function pendingCount(): number {
  return countByStatus("pending");
}

export function clearBeforeCutoff(): void {
  getDb()
    .update(syncRecords)
    .set({ status: "pending", skipReason: null })
    .where(eq(syncRecords.skipReason, "before_cutoff"))
    .run();
}

export function applyForwardCutoff(cutoff: Date): void {
  const rows = getDb()
    .select({
      id: syncRecords.id,
      watchedAt: watchEvents.watchedAtUtc,
      status: syncRecords.status,
      skipReason: syncRecords.skipReason,
    })
    .from(syncRecords)
    .innerJoin(watchEvents, eq(watchEvents.id, syncRecords.watchEventId))
    .all();
  for (const row of rows) {
    if (row.status === "synced" || row.skipReason === "user_ignored") {
      continue;
    }
    if (row.watchedAt.getTime() < cutoff.getTime()) {
      getDb()
        .update(syncRecords)
        .set({ status: "skipped", skipReason: "before_cutoff" })
        .where(eq(syncRecords.id, row.id))
        .run();
    }
  }
}
