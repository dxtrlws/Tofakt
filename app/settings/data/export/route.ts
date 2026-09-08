import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/require";
import { buildHistoryFile, historyToCsv } from "@/lib/data/history-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireUser();
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
  const file = buildHistoryFile();
  writeAudit({
    action: "data.export",
    subjectType: "watch_events",
    detail: { format, count: file.events.length },
  });
  if (format === "csv") {
    return new NextResponse(historyToCsv(file.events), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="watchlog-history.csv"',
      },
    });
  }
  return NextResponse.json(file, {
    headers: {
      "content-disposition": 'attachment; filename="watchlog-history.json"',
    },
  });
}
