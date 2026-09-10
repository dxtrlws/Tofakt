import { execFileSync } from "node:child_process";

const SHA = /^[0-9a-f]{7,40}$/i;

export function formatBuildId(
  raw: string | undefined | null,
): string | undefined {
  const value = raw?.trim();
  if (!value) {
    return undefined;
  }
  if (SHA.test(value)) {
    return value.slice(0, 7).toLowerCase();
  }
  return value;
}

function gitHead(): string | undefined {
  if (process.env.NODE_ENV === "test") {
    return undefined;
  }
  try {
    const sha = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2000,
    }).trim();
    return sha || undefined;
  } catch {
    return undefined;
  }
}

export function resolveBuildId(fromEnv?: string, gitSha?: string): string {
  return formatBuildId(fromEnv) ?? formatBuildId(gitSha) ?? "dev";
}

let cached: string | undefined;

export function currentBuild(): string {
  cached ??= resolveBuildId(process.env.WATCHLOG_BUILD, gitHead());
  return cached;
}
