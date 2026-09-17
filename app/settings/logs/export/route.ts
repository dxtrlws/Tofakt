import { NextResponse } from "next/server";
import { auditToCsv, listAudit } from "@/lib/audit/audit";
import { requireUser } from "@/lib/auth/require";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await requireUser();
  const rows = listAudit(1000);
  return new NextResponse(auditToCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="watchlog-audit-log.csv"',
    },
  });
}
