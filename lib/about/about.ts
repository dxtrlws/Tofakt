import { statSync } from "node:fs";
import { desc, eq, isNotNull } from "drizzle-orm";
import { formatAuditDetail, formatAuditLabel, listAudit } from "../audit/audit";
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

function jobLine(
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
): string {
  const at = row?.finishedAt ?? row?.startedAt;
  const stamp = at ? formatStamp(at, tz) : "never";
  const status = row?.status === "ok" ? "ok" : row?.status || "idle";
  return `${type.padEnd(7)}${stamp}  ${durationLabel(row?.startedAt ?? null, row?.finishedAt ?? null)}  ${status}  ${summary}`;
}

function jobStatusLines(): string[] {
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
  const lines = [
    jobLine("ingest", ingest, ingestSummary(), tz),
    jobLine("recon", reconcile, reconcileSummary(), tz),
    jobLine("sync", sync, syncSummary(), tz),
    `rate   Trakt  ${rate.gets}/${rate.budget}  ${rate.windowMinutes} min window`,
    `tofa   ${extra.version ?? "—"}  ${api}  ${claimed}`,
  ];
  if (circuit.pausedUntil && circuit.pausedUntil > Date.now()) {
    lines.push(
      `pause  Trakt writes paused until ${formatStamp(new Date(circuit.pausedUntil), tz)}`,
    );
  }
  const errors = getDb()
    .select()
    .from(jobRuns)
    .where(isNotNull(jobRuns.error))
    .orderBy(desc(jobRuns.finishedAt))
    .limit(5)
    .all();
  for (const row of errors) {
    if (!row.error) {
      continue;
    }
    const at = row.finishedAt ?? row.startedAt;
    lines.push(
      `error  ${row.type}  ${at ? formatStamp(at, tz) : "—"}  ${row.error}`,
    );
  }
  return lines;
}

export function jobStatusText(): string {
  return jobStatusLines().join("\n");
}

export function diagnosticText(): string {
  const tz = timezone();
  const lines = jobStatusLines();
  const audit = listAudit(12);
  if (audit.length > 0) {
    lines.push("");
    lines.push("audit");
    for (const row of audit) {
      const detail = formatAuditDetail(row.detailJson);
      lines.push(
        `${row.actor.padEnd(7)}${formatStamp(row.at, tz)}  ${formatAuditLabel(row.action)}${detail ? `  ${detail}` : ""}`,
      );
    }
  }
  return lines.join("\n");
}

export function copyReport(): string {
  const facts = aboutFacts();
  return [
    `Watchlog ${facts.version} (${facts.build})`,
    `uptime ${facts.uptime} · db ${facts.database} · ${facts.events}`,
    "",
    diagnosticText(),
  ].join("\n");
}
