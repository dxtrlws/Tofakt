import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalVersion, parseSemver } from "./semver";

function fromEnv(raw: string | undefined | null): string | undefined {
  const value = raw?.trim();
  if (!value || !parseSemver(value)) {
    return undefined;
  }
  return canonicalVersion(value);
}

function readPackageVersion(cwd = process.cwd()): string | undefined {
  try {
    const raw = readFileSync(join(cwd, "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === "string"
      ? fromEnv(parsed.version)
      : undefined;
  } catch {
    return undefined;
  }
}

export function resolveVersion(
  fromWatchlog?: string,
  fromNpm?: string,
  fromPackage?: string,
): string {
  return (
    fromEnv(fromWatchlog) ?? fromEnv(fromNpm) ?? fromEnv(fromPackage) ?? "0.0.0"
  );
}

let cached: string | undefined;

export function currentVersion(): string {
  cached ??= resolveVersion(
    process.env.WATCHLOG_VERSION,
    process.env.npm_package_version,
    readPackageVersion(),
  );
  return cached;
}
