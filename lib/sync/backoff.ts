const STEPS_MS = [30_000, 120_000, 480_000, 1_800_000, 7_200_000, 21_600_000];

export const MAX_SYNC_ATTEMPTS = 6;

export function nextAttemptAt(
  attempts: number,
  now = Date.now(),
  random = Math.random,
): Date {
  const cap = STEPS_MS[Math.min(attempts, STEPS_MS.length) - 1] ?? STEPS_MS[0];
  const delay = Math.round(random() * cap);
  return new Date(now + delay);
}

export function shouldRetryStatus(status: number): boolean {
  return status === 429 || status >= 500 || status === 0;
}
