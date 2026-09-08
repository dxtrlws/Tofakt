const METADATA_HOSTS = new Set([
  "metadata.google.internal",
  "metadata.goog",
  "metadata.google.com",
]);

export type ParsedTofaUrl =
  | { ok: true; href: string; loopback: boolean; hostname: string }
  | { ok: false; error: string };

export function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|]$/g, "");
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host === "::" ||
    host.endsWith(".localhost")
  );
}

export function isBlockedMetadataHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|]$/g, "");
  if (METADATA_HOSTS.has(host)) {
    return true;
  }
  if (host === "169.254.169.254" || host === "fd00:ec2::254") {
    return true;
  }
  return isLinkLocalIpv4(host);
}

function isLinkLocalIpv4(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) {
    return false;
  }
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 255)) {
    return false;
  }
  return parts[0] === 169 && parts[1] === 254;
}

export function parseTofaBaseUrl(raw: string): ParsedTofaUrl {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a tofa URL." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "That is not a valid URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Only http and https URLs are allowed." };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: "Do not put credentials in the URL." };
  }
  if (isBlockedMetadataHost(parsed.hostname)) {
    return { ok: false, error: "That host is not allowed." };
  }

  parsed.hash = "";
  parsed.search = "";
  let path = parsed.pathname.replace(/\/+$/, "");
  if (path.endsWith("/api/v1")) {
    path = path.slice(0, -"/api/v1".length);
  }
  parsed.pathname = path || "/";
  if (parsed.pathname === "/") {
    parsed.pathname = "";
  }

  const href = parsed.toString().replace(/\/$/, "");
  return {
    ok: true,
    href,
    loopback: isLoopbackHost(parsed.hostname),
    hostname: parsed.hostname,
  };
}

export const LOOPBACK_HINT =
  "tofa usually needs the host's LAN address (or host.docker.internal from Docker), not localhost.";
