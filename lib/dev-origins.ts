import { type NetworkInterfaceInfo, networkInterfaces } from "node:os";

export function stripIpv6ZoneId(address: string): string {
  const zone = address.indexOf("%");
  if (zone === -1) {
    return address;
  }
  return address.slice(0, zone);
}

function extraHosts(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function skipAddress(address: string): boolean {
  return address === "0.0.0.0" || address === "::";
}

export function lanDevOrigins(opts?: {
  extra?: string;
  interfaces?: NodeJS.Dict<NetworkInterfaceInfo[]>;
}): string[] {
  const ifaces = opts?.interfaces ?? networkInterfaces();
  const hosts = new Set<string>();
  for (const addrs of Object.values(ifaces)) {
    for (const addr of addrs ?? []) {
      if (addr.internal) {
        continue;
      }
      const host = stripIpv6ZoneId(addr.address);
      if (!host || skipAddress(host)) {
        continue;
      }
      hosts.add(host);
    }
  }
  for (const host of extraHosts(
    opts?.extra ?? process.env.WATCHLOG_DEV_ORIGINS,
  )) {
    hosts.add(host);
  }
  return [...hosts];
}
