import { statSync } from "node:fs";
import { desc, eq, isNotNull } from "drizzle-orm";
import { getConnection, parseExtra } from "../connections/store";
import { watchEventTotal } from "../data/danger";
import { getDb, getSqlite, sqlitePath } from "../db";
import { jobRuns, jobs } from "../db/schema";
import { lastIngestStats, timezone } from "../ingest/run";
import { lastSyncStats } from "../sync/run";
import { getCircuit } from "../sync/settings";
import { traktLimiter } from "../trakt/rate-limit";
import { formatBytes, formatStamp, formatUptime } from "./about-format";
import { processStartedAt } from "./boot";
import { currentBuild } from "./build";
import { currentVersion } from "./version";

export type AboutFacts = {
  version: string;
  build: string;
  uptime: string;
  database: string;
  events: string;
};

export type JobRowStatus = "ok" | "error" | "running" | "idle";

export type JobRow = {
  type: string;
  stamp: string;
  duration: string;
  status: JobRowStatus;
  summary: string;
};

export type JobErrorRow = {
  type: string;
  stamp: string;
  message: string;
};

export type JobStatus = {
  rows: JobRow[];
  rate: string;
  tofa: string;
  pause: string | null;
  errors: JobErrorRow[];
};

export { formatBytes, formatStamp, formatUptime } from "./about-format";

function durationLabel(started: Date | null, finished: Date | null): string {
  if (!started || !finished) {
    return "—";
  }
  const seconds = Math.max(0, (finished.getTime() - started.getTime()) / 1000);
  if (seconds < 10) {
    return `${seconds.toFixed(1)}s`;
  }
  return `${Math.round(seconds)}s`;
}

function databaseBytes(): number {
  try {
    const sqlite = getSqlite();
    const pageSize = Number(sqlite.pragma("page_size", { simple: true }));
    const pageCount = Number(sqlite.pragma("page_count", { simple: true }));
    if (Number.isFinite(pageSize) && Number.isFinite(pageCount)) {
      return pageSize * pageCount;
    }
  } catch {
    // fall through to the file size
  }
  try {
    return statSync(sqlitePath()).size;
  } catch {
    return 0;
  }
}

export function aboutFacts(): AboutFacts {
  const count = watchEventTotal();
  return {
    version: currentVersion(),
    build: currentBuild(),
    uptime: formatUptime(Date.now() - processStartedAt),
    database: formatBytes(databaseBytes()),
    events: `${count} ${count === 1 ? "play" : "plays"}`,
  };
}

function ingestSummary(): string {
  const stats = lastIngestStats();
  if (!stats) {
    return "idle";
  }
  if (stats.error) {
    return stats.error;
  }
  return `${stats.inserted} new`;
}

function syncSummary(): string {
  const stats = lastSyncStats();
  if (!stats) {
    return "idle";
  }
  if (stats.error) {
    return stats.error;
  }
  return `${stats.synced} sent, ${stats.unmatched} unmatched`;
}

function reconcileSummary(): string {
  const row = getDb().select().from(jobs).where(eq(jobs.id, "reconcile")).get();
  if (!row) {
    return "idle";
  }
  if (row.error) {
    return row.error;
  }
  if (!row.statsJson) {
    return "idle";
  }
  try {
    const stats = JSON.parse(row.statsJson) as { count?: unknown };
    if (typeof stats.count === "number") {
      return `${stats.count} plays`;
    }
  } catch {
    return "idle";
  }
  return "idle";
}

function jobRow(
  type: string,
  row:
    | {
        startedAt: Date | null;
        finishedAt: Date | null;
        status: string;
      }
    | undefined,
  summary: string,
  tz: string,
): JobRow {
  const at = row?.finishedAt ?? row?.startedAt;
  const status: JobRowStatus =
    row?.status === "ok" || row?.status === "error" || row?.status === "running"
      ? row.status
      : "idle";
  return {
    type,
    stamp: at ? formatStamp(at, tz) : "never",
    duration: durationLabel(row?.startedAt ?? null, row?.finishedAt ?? null),
    status,
    summary,
  };
}

export function jobStatus(): JobStatus {
  const tz = timezone();
  const ingest = getDb().select().from(jobs).where(eq(jobs.id, "ingest")).get();
  const reconcile = getDb()
    .select()
    .from(jobs)
    .where(eq(jobs.id, "reconcile"))
    .get();
  const sync = getDb().select().from(jobs).where(eq(jobs.id, "sync")).get();
  const rate = traktLimiter.snapshot();
  const circuit = getCircuit();
  const tofa = getConnection("tofa");
  const extra = parseExtra(tofa);
  let capCount = 0;
  try {
    const caps = tofa?.capabilitiesJson
      ? (JSON.parse(tofa.capabilitiesJson) as unknown)
      : [];
    capCount = Array.isArray(caps) ? caps.length : 0;
  } catch {
    capCount = 0;
  }
  const claimed = tofa?.serverId ? "claimed" : "unclaimed";
  const api =
    extra.apiVersion != null ? `api ${extra.apiVersion}` : `caps ${capCount}`;
  const errors = getDb()
    .select()
    .from(jobRuns)
    .where(isNotNull(jobRuns.error))
    .orderBy(desc(jobRuns.finishedAt))
    .limit(5)
    .all()
    .flatMap((row) => {
      if (!row.error) {
        return [];
      }
      const at = row.finishedAt ?? row.startedAt;
      return [
        { type: row.type, stamp: at ? formatStamp(at, tz) : "—", message: row.error },
      ];
    });
  return {
    rows: [
      jobRow("ingest", ingest, ingestSummary(), tz),
      jobRow("recon", reconcile, reconcileSummary(), tz),
      jobRow("sync", sync, syncSummary(), tz),
    ],
    rate: `Trakt ${rate.gets}/${rate.budget} · ${rate.windowMinutes} min window`,
    tofa: `${extra.version ?? "—"} · ${api} · ${claimed}`,
    pause:
      circuit.pausedUntil && circuit.pausedUntil > Date.now()
        ? `Trakt writes paused until ${formatStamp(new Date(circuit.pausedUntil), tz)}`
        : null,
    errors,
  };
}

