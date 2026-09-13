export type SemVer = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
};

const SEMVER =
  /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/i;

export function parseSemver(raw: string): SemVer | null {
  const match = SEMVER.exec(raw.trim());
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  };
}

export function canonicalVersion(raw: string): string {
  const parsed = parseSemver(raw);
  if (!parsed) {
    return raw.trim().replace(/^v/i, "");
  }
  const core = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
  return parsed.prerelease ? `${core}-${parsed.prerelease}` : core;
}

function prereleaseParts(value: string | null): Array<string | number> {
  if (!value) {
    return [];
  }
  return value.split(".").map((part) => {
    if (/^\d+$/.test(part)) {
      return Number(part);
    }
    return part;
  });
}

function comparePrerelease(a: string | null, b: string | null): number {
  if (a === b) {
    return 0;
  }
  if (a == null) {
    return 1;
  }
  if (b == null) {
    return -1;
  }
  const left = prereleaseParts(a);
  const right = prereleaseParts(b);
  const n = Math.max(left.length, right.length);
  for (let i = 0; i < n; i += 1) {
    const l = left[i];
    const r = right[i];
    if (l === undefined) {
      return -1;
    }
    if (r === undefined) {
      return 1;
    }
    if (l === r) {
      continue;
    }
    if (typeof l === "number" && typeof r === "number") {
      return l - r;
    }
    if (typeof l === "number") {
      return -1;
    }
    if (typeof r === "number") {
      return 1;
    }
    return l < r ? -1 : 1;
  }
  return 0;
}

export function compareSemver(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) {
    return a.major - b.major;
  }
  if (a.minor !== b.minor) {
    return a.minor - b.minor;
  }
  if (a.patch !== b.patch) {
    return a.patch - b.patch;
  }
  return comparePrerelease(a.prerelease, b.prerelease);
}

export function compareVersionStrings(
  current: string,
  latest: string,
): "current" | "available" | "ahead" | null {
  const a = parseSemver(current);
  const b = parseSemver(latest);
  if (!a || !b) {
    return null;
  }
  const order = compareSemver(a, b);
  if (order === 0) {
    return "current";
  }
  return order < 0 ? "available" : "ahead";
}
