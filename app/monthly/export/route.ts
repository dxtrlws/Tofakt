import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require";
import { timezone } from "@/lib/ingest/run";
import { loadMonthBundle } from "@/lib/stats/month";
import { parseMonthParam } from "@/lib/stats/period";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireUser();
  const url = new URL(request.url);
  const month = parseMonthParam(
    url.searchParams.get("month"),
    new Date(),
    timezone(),
  );
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
  const { review, rows } = await loadMonthBundle(month);
  if (format === "csv") {
    const header = [
      "watched_at",
      "title",
      "show_title",
      "kind",
      "season",
      "episode",
      "seconds",
    ];
    const body = [
      header.join(","),
      ...rows.map((row) =>
        [
          row.watchedAt.toISOString(),
          csv(row.title),
          csv(row.showTitle ?? ""),
          row.kind,
          row.seasonNumber ?? "",
          row.episodeNumber ?? "",
          row.seconds,
        ].join(","),
      ),
    ].join("\n");
    return new NextResponse(body, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="watchlog-${review.monthKey}.csv"`,
      },
    });
  }
  return NextResponse.json(
    {
      month: review.monthKey,
      name: review.name,
      plays: review.plays,
      hours: review.hoursLabel,
      daysActive: review.daysActive,
      events: rows.map((row) => ({
        watchedAt: row.watchedAt.toISOString(),
        title: row.title,
        showTitle: row.showTitle,
        kind: row.kind,
        seasonNumber: row.seasonNumber,
        episodeNumber: row.episodeNumber,
        seconds: row.seconds,
      })),
    },
    {
      headers: {
        "content-disposition": `attachment; filename="watchlog-${review.monthKey}.json"`,
      },
    },
  );
}

function csv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}
