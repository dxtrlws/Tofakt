const OVERLAP_MS = 24 * 60 * 60 * 1000;

export function overlapStartIso(
  lastStartedAtSeen: string | null,
): string | null {
  if (!lastStartedAtSeen) {
    return null;
  }
  const at = Date.parse(lastStartedAtSeen);
  if (Number.isNaN(at)) {
    return null;
  }
  return new Date(at - OVERLAP_MS).toISOString();
}

export function shouldStopPaging(opts: {
  hasMore: boolean;
  pageOldestStartedAt: string | null;
  overlapStartIso: string | null;
}): boolean {
  if (!opts.hasMore) {
    return true;
  }
  if (!opts.overlapStartIso || !opts.pageOldestStartedAt) {
    return false;
  }
  return (
    Date.parse(opts.pageOldestStartedAt) < Date.parse(opts.overlapStartIso)
  );
}

export function maxIso(a: string | null, b: string | null): string | null {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  return Date.parse(a) >= Date.parse(b) ? a : b;
}
