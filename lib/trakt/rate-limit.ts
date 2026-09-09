const WRITE_INTERVAL_MS = 1_000;
const GET_WINDOW_MS = 5 * 60_000;
const GET_BUDGET = 500;

export type SleepFn = (ms: number) => Promise<void>;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class TraktLimiter {
  private nextWriteAt = 0;
  private getStamps: number[] = [];

  constructor(
    private readonly writeIntervalMs = WRITE_INTERVAL_MS,
    private readonly sleep: SleepFn = defaultSleep,
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
    const now = this.now();
    this.getStamps = this.getStamps.filter(
      (stamp) => now - stamp < GET_WINDOW_MS,
    );
    if (this.getStamps.length < GET_BUDGET) {
      this.getStamps.push(now);
      return;
    }
    const wait = GET_WINDOW_MS - (now - this.getStamps[0]);
    if (wait > 0) {
      await this.sleep(wait);
    }
    this.getStamps = this.getStamps.filter(
      (stamp) => this.now() - stamp < GET_WINDOW_MS,
    );
    this.getStamps.push(this.now());
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
}

export const traktLimiter = new TraktLimiter();
