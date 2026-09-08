import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { refreshDueTokens } from "@/lib/connections/service";
import { getConnection, readAccessToken } from "@/lib/connections/store";
import {
  fetchTofaArtwork,
  isArtworkKind,
  isMediaUuid,
} from "@/lib/tofa/artwork";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/artwork/[mediaId]/[kind]">,
) {
  const user = await getSessionUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { mediaId, kind } = await ctx.params;
  if (!isMediaUuid(mediaId) || !isArtworkKind(kind)) {
    return new NextResponse("Not found", { status: 404 });
  }
  await refreshDueTokens();
  const row = getConnection("tofa");
  const token = row ? readAccessToken(row) : null;
  if (!row?.baseUrl || !token) {
    return new NextResponse("tofa is not connected", { status: 503 });
  }
  const url = new URL(request.url);
  const w = intParam(url.searchParams.get("w"));
  const h = intParam(url.searchParams.get("h"));
  const result = await fetchTofaArtwork({
    baseUrl: row.baseUrl,
    accessToken: token,
    mediaId,
    kind,
    w,
    h,
  });
  if (result.status >= 400 || result.bytes.length === 0) {
    return new NextResponse("Artwork unavailable", {
      status: result.status || 404,
    });
  }
  return new NextResponse(new Uint8Array(result.bytes), {
    status: 200,
    headers: {
      "content-type": result.contentType || "image/jpeg",
      "cache-control": "private, max-age=86400",
    },
  });
}

function intParam(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1 || n > 4096) {
    return undefined;
  }
  return n;
}
