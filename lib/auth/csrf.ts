import { headers } from "next/headers";
import { env } from "../env";
import { isAllowedOrigin, originCandidates } from "./origin";

export async function assertSameOrigin(): Promise<{ error: string } | null> {
  const headerList = await headers();
  const origin = headerList.get("origin");
  if (!origin) {
    return { error: "Missing origin." };
  }
  const allowed = originCandidates({
    baseUrl: env().BASE_URL,
    host: headerList.get("host"),
    forwardedHost: headerList.get("x-forwarded-host"),
    forwardedProto: headerList.get("x-forwarded-proto"),
  });
  if (!isAllowedOrigin(origin, allowed)) {
    return { error: "Invalid origin." };
  }
  return null;
}
