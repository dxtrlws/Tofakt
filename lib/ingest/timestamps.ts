export type TimestampInput = {
  startedAt: string;
  endedAt?: string | null;
  now?: Date;
  prefer?: "completion" | "start";
  durationWatchedSeconds?: number | null;
  runtimeSeconds?: number | null;
};

export type TimestampResult = {
  watchedAt: Date;
  convention: "completion" | "start";
  clamped: boolean;
};

/** tofa mark-watched / import rows finish in tens of milliseconds. */
export const MIN_PLAYBACK_SESSION_MS = 2_000;

export function watchedAtFromPlay(input: TimestampInput): TimestampResult {
  const started = parseIso(input.startedAt);
  const ended = input.endedAt ? parseIso(input.endedAt) : null;
  const prefer = input.prefer ?? "completion";
  let watchedAt: Date;
  let convention: "completion" | "start";
  if (prefer === "start") {
    watchedAt = started;
    convention = "start";
  } else if (ended) {
    watchedAt = ended;
    convention = "completion";
  } else {
    const extra = Math.min(
      input.durationWatchedSeconds ?? Number.POSITIVE_INFINITY,
      input.runtimeSeconds ?? Number.POSITIVE_INFINITY,
    );
    if (Number.isFinite(extra) && extra > 0) {
      watchedAt = new Date(started.getTime() + extra * 1000);
      convention = "completion";
    } else {
      watchedAt = started;
      convention = "start";
    }
  }
  const now = input.now ?? new Date();
  let clamped = false;
  if (watchedAt.getTime() > now.getTime()) {
    watchedAt = now;
    clamped = true;
  }
  return { watchedAt, convention, clamped };
}

export function isPlaybackSession(input: {
  startedAt: string;
  endedAt?: string | null;
}): boolean {
  if (!input.endedAt) {
    return true;
  }
  const started = parseIso(input.startedAt);
  const ended = parseIso(input.endedAt);
  return ended.getTime() - started.getTime() >= MIN_PLAYBACK_SESSION_MS;
}

function parseIso(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid timestamp: ${value}`);
  }
  return parsed;
}
