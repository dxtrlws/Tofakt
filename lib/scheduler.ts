import { eq } from "drizzle-orm";
import { writeAudit } from "./audit/audit";
import { getDb } from "./db";
import { jobs } from "./db/schema";
import { getIngestSettings, runIngest } from "./ingest/run";
import { logger } from "./logger";
import { pullTraktHistory } from "./sync/reconcile";
import { isScheduleDue } from "./sync/schedule";
import { getSyncSettings } from "./sync/settings";

const TICK_MS = 15_000;

let started = false;
let timer: ReturnType<typeof setInterval> | undefined;
let bootTimer: ReturnType<typeof setTimeout> | undefined;
let ticking = false;

export function startScheduler(opts?: { kick?: boolean }): void {
  if (started) {
    return;
  }
  if (process.env.WATCHLOG_DISABLE_SCHEDULER === "1") {
    return;
  }
  started = true;
  const ingest = getIngestSettings();
  const sync = getSyncSettings();
  logger.info(
    {
      ingestEnabled: ingest.ingestEnabled,
      ingestEveryMinutes: ingest.intervalMinutes,
      reconcileEnabled: sync.reconcileEnabled,
      reconcileEveryMinutes: sync.reconcileEveryMinutes,
    },
    "Starting Watchlog scheduler",
  );
  if (opts?.kick !== false) {
    bootTimer = setTimeout(() => {
      bootTimer = undefined;
      void tick();
    }, 8_000);
  }
  timer = setInterval(() => {
    void tick();
  }, TICK_MS);
}

export function restartScheduler(): void {
  stopScheduler();
  startScheduler({ kick: false });
}

async function tick(): Promise<void> {
  if (ticking) {
    return;
  }
  ticking = true;
  try {
    const ingest = getIngestSettings();
    const ingestDue = isScheduleDue({
      enabled: ingest.ingestEnabled,
      everyMinutes: ingest.intervalMinutes,
      lastFinishedAt: lastJobFinishedAt("ingest"),
    });
    if (ingestDue) {
      // Ingest never posts. Matching pending plays as already_on_trakt uses
      // the existing Trakt snapshot; leftover pending waits for Run sync now.
      await runIngest();
    }

    const sync = getSyncSettings();
    if (
      isScheduleDue({
        enabled: sync.reconcileEnabled,
        everyMinutes: sync.reconcileEveryMinutes,
        lastFinishedAt: lastJobFinishedAt("reconcile"),
      })
    ) {
      const pulled = await pullTraktHistory();
      writeAudit({
        actor: "system",
        action: pulled.error ? "sync.reconcile_failed" : "sync.reconcile",
        subjectType: "job",
        subjectId: "reconcile",
        detail: {
          count: pulled.count,
          matched: pulled.matched,
          error: pulled.error,
        },
      });
    }
  } catch (err) {
    logger.error({ err }, "Scheduler tick failed");
  } finally {
    ticking = false;
  }
}

function lastJobFinishedAt(id: string): Date | null {
  return (
    getDb().select().from(jobs).where(eq(jobs.id, id)).get()?.finishedAt ?? null
  );
}

export function stopScheduler(): void {
  if (bootTimer) {
    clearTimeout(bootTimer);
    bootTimer = undefined;
  }
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
  started = false;
}
