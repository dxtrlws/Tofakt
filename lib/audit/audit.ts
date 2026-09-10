import { desc } from "drizzle-orm";
import { getDb, getSqlite } from "../db";
import { auditLog } from "../db/schema";
import { newId } from "../ids";
import { logger } from "../logger";

const MAX_AUDIT_ROWS = 1000;

export type AuditActor = "system" | "user";

export type AuditEntry = {
  actor?: AuditActor;
  action: string;
  subjectType?: string | null;
  subjectId?: string | null;
  detail?: unknown;
};

export function writeAudit(entry: AuditEntry): void {
  const actor = entry.actor ?? "user";
  const detail = entry.detail === undefined ? null : safeJson(entry.detail);
  try {
    getDb()
      .insert(auditLog)
      .values({
        id: newId(),
        at: new Date(),
        actor,
        action: entry.action,
        subjectType: entry.subjectType ?? null,
        subjectId: entry.subjectId ?? null,
        detailJson: detail,
      })
      .run();
    pruneAudit();
  } catch (err) {
    logger.warn({ err, action: entry.action }, "audit write failed");
  }
  logger.info(
    {
      actor,
      action: entry.action,
      subjectType: entry.subjectType,
      subjectId: entry.subjectId,
      detail: entry.detail,
    },
    entry.action,
  );
}

function pruneAudit(): void {
  getSqlite().exec(
    `delete from audit_log where at < (
      select at from audit_log order by at desc limit 1 offset ${MAX_AUDIT_ROWS - 1}
    )`,
  );
}

function safeJson(value: unknown): string | null {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export function formatAuditLabel(action: string): string {
  return AUDIT_LABELS[action] ?? action.replaceAll(".", " ");
}

export function formatAuditDetail(raw: string | null): string {
  if (!raw) {
    return "";
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return String(parsed);
    }
    return Object.entries(parsed as Record<string, unknown>)
      .map(([key, value]) => `${key}=${value}`)
      .join(" ");
  } catch {
    return "";
  }
}

const AUDIT_LABELS: Record<string, string> = {
  "data.save_prefs": "Saved data preferences",
  "data.export": "Exported history",
  "data.import_preview": "Prepared a history import",
  "data.import_confirm": "Imported history",
  "data.import_cancel": "Cancelled a history import",
  "data.clear_sync_records": "Cleared sync records",
  "data.wipe_local_history": "Wiped local history",
  "data.forget_connection": "Forgot a connection",
  "ingest.finished": "Ingest finished",
  "ingest.failed": "Ingest failed",
  "sync.finished": "Trakt sync finished",
  "sync.failed": "Trakt sync failed",
  "sync.save_prefs": "Saved sync preferences",
  "sync.set_mode": "Changed sync mode",
  "sync.backfill_confirm": "Confirmed backfill",
  "sync.reconcile": "Reconciled Trakt history",
  "sync.reconcile_failed": "Trakt reconciliation failed",
  "sync.remove_play": "Removed a play from Trakt",
  "sync.undo_watchlog_posts": "Removed Watchlog posts from Trakt",
  "history.ignore": "Ignored a play",
  "history.unignore": "Unignored a play",
};

export function listAudit(limit = 40): {
  at: Date;
  actor: AuditActor;
  action: string;
  subjectType: string | null;
  subjectId: string | null;
  detailJson: string | null;
}[] {
  return getDb()
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.at))
    .limit(limit)
    .all()
    .map((row) => ({
      at: row.at,
      actor: row.actor === "system" ? "system" : "user",
      action: row.action,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      detailJson: row.detailJson,
    }));
}
