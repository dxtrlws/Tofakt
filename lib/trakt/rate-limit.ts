const WRITE_INTERVAL_MS = 1_000;
const GET_WINDOW_MS = 5 * 60_000;
const GET_BUDGET = 500;

export type SleepFn = (ms: number) => Promise<void>;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export type TraktRateLimit = {
  name?: string;
  period?: number;
  limit?: number;
  remaining?: number;
  until?: string;
};

export function parseXRatelimit(
  headers: Record<string, string>,
): TraktRateLimit | null {
  const raw = headers["x-ratelimit"];
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as TraktRateLimit;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export class TraktLimiter {
  private nextWriteAt = 0;
  private getStamps: number[] = [];
  private blockedUntil = 0;

  constructor(
    private readonly writeIntervalMs = WRITE_INTERVAL_MS,
    readonly sleep: SleepFn = defaultSleep,
    private readonly now: () => number = Date.now,
  ) {}

  async waitWrite(): Promise<void> {
    const now = this.now();
    const wait = Math.max(0, this.nextWriteAt - now);
    if (wait > 0) {
      await this.sleep(wait);
    }
    this.nextWriteAt = this.now() + this.writeIntervalMs;
  }

  async waitGet(): Promise<void> {
    await this.waitBlocked();
    const now = this.now();
    this.getStamps = this.getStamps.filter(
      (stamp) => now - stamp < GET_WINDOW_MS,
    );
    if (this.getStamps.length < GET_BUDGET) {
      this.getStamps.push(now);
      return;
    }
    const wait = Math.max(0, GET_WINDOW_MS - (now - this.getStamps[0]));
    if (wait > 0) {
      await this.sleep(wait);
    }
    this.getStamps = this.getStamps.filter(
      (stamp) => this.now() - stamp < GET_WINDOW_MS,
    );
    this.getStamps.push(this.now());
  }

  noteGetHeaders(headers: Record<string, string>): void {
    const limit = parseXRatelimit(headers);
    if (!limit) {
      return;
    }
    if (limit.remaining != null && limit.remaining <= 0 && limit.until) {
      const until = Date.parse(limit.until);
      if (Number.isFinite(until)) {
        this.blockedUntil = Math.max(this.blockedUntil, until);
      }
    }
  }

  retryDelayMs(): number | null {
    const wait = this.blockedUntil - this.now();
    return wait > 0 ? wait : null;
  }

  snapshot(): { gets: number; budget: number; windowMinutes: number } {
    const now = this.now();
    const gets = this.getStamps.filter(
      (stamp) => now - stamp < GET_WINDOW_MS,
    ).length;
    return {
      gets,
      budget: GET_BUDGET,
      windowMinutes: GET_WINDOW_MS / 60_000,
    };
  }

  private async waitBlocked(): Promise<void> {
    const wait = this.blockedUntil - this.now();
    if (wait > 0) {
      await this.sleep(wait);
    }
  }
}

export const traktLimiter = new TraktLimiter();
