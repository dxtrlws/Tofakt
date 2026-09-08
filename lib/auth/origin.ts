export function originCandidates(input: {
  baseUrl?: string;
  host?: string | null;
  forwardedHost?: string | null;
  forwardedProto?: string | null;
}): string[] {
  const out: string[] = [];
  if (input.baseUrl) {
    out.push(input.baseUrl);
  }
  const host = (input.forwardedHost ?? input.host)?.split(",")[0]?.trim();
  const proto =
    (input.forwardedProto ?? "http").split(",")[0]?.trim() || "http";
  if (host) {
    out.push(`${proto}://${host}`);
  }
  return out;
}

export function isAllowedOrigin(origin: string, candidates: string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  return candidates.some((candidate) => {
    try {
      return new URL(candidate).origin === parsed.origin;
    } catch {
      return false;
    }
  });
}
