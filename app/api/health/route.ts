import { NextResponse } from "next/server";
import { getConnection } from "@/lib/connections/store";
import type { ConnectionStatus } from "@/lib/connections/types";
import { pingDatabase } from "@/lib/db";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function statusOf(provider: "tofa" | "trakt" | "tmdb"): ConnectionStatus {
  const row = getConnection(provider);
  const value = row?.status;
  if (value === "ok" || value === "warn" || value === "down") {
    return value;
  }
  return "unknown";
}

export async function GET() {
  let db: "ok" | "error" = "ok";
  try {
    pingDatabase();
  } catch (err) {
    db = "error";
    logger.error({ err }, "Health check database failed");
  }

  const ok = db === "ok";
  return NextResponse.json(
    {
      ok,
      db,
      connections: {
        tofa: statusOf("tofa"),
        trakt: statusOf("trakt"),
        tmdb: statusOf("tmdb"),
      },
    },
    { status: ok ? 200 : 503 },
  );
}
