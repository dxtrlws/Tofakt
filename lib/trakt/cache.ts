import { getSettingJson, setSettingJson } from "../data/settings";
import { logger } from "../logger";
import {
  pullTraktHistory,
  snapshotCount,
  snapshotFetchedAt,
  snapshotMissingPayload,
} from "../sync/reconcile";
import { type TraktCalendarItem, traktGetShowCalendar } from "./calendar";

export const HISTORY_TTL_MS = 15 * 60_000;
export const CALENDAR_TTL_MS = 30 * 60_000;

const CALENDAR_KEY = "trakt.calendar_cache";

type CalendarCache = {
  startDate: string;
  days: number;
  items: TraktCalendarItem[];
  fetchedAt: number;
};

let calendarInFlight: Promise<TraktCalendarItem[]> | null = null;

export function historySnapshotStale(now = Date.now()): boolean {
  const at = snapshotFetchedAt();
  if (!at) {
    return true;
  }
  return now - at.getTime() > HISTORY_TTL_MS;
}

export function historySnapshotReady(): boolean {
  return snapshotCount() > 0 && !snapshotMissingPayload();
}

export async function ensureHistorySnapshot(opts?: {
  revalidate?: boolean;
}): Promise<{
  ready: boolean;
  error?: string;
}> {
  const revalidate = opts?.revalidate !== false;
  if (!historySnapshotReady()) {
    const pulled = await pullTraktHistory();
    return {
      ready: snapshotCount() > 0 && !pulled.error,
      error: pulled.error,
    };
  }
  if (revalidate && historySnapshotStale()) {
    void pullTraktHistory().catch((err) => {
      logger.warn({ err }, "background Trakt history refresh failed");
    });
  }
  return { ready: true };
}

export async function loadCachedShowCalendar(
  clientId: string,
  token: string,
  startDate: string,
  days = 21,
): Promise<TraktCalendarItem[]> {
  const cached = getSettingJson<CalendarCache>(CALENDAR_KEY);
  const matches =
    cached && cached.startDate === startDate && cached.days === days;
  if (matches && cached) {
    if (Date.now() - cached.fetchedAt >= CALENDAR_TTL_MS) {
      void refreshCalendar(clientId, token, startDate, days).catch((err) => {
        logger.warn({ err }, "background Trakt calendar refresh failed");
      });
    }
    return cached.items;
  }
  return refreshCalendar(clientId, token, startDate, days);
}

async function refreshCalendar(
  clientId: string,
  token: string,
  startDate: string,
  days: number,
): Promise<TraktCalendarItem[]> {
  if (calendarInFlight) {
    return calendarInFlight;
  }
  calendarInFlight = (async () => {
    const res = await traktGetShowCalendar(clientId, token, startDate, days);
    const items = res.status === 200 ? res.items : [];
    if (res.status === 200) {
      setSettingJson(CALENDAR_KEY, {
        startDate,
        days,
        items,
        fetchedAt: Date.now(),
      } satisfies CalendarCache);
    }
    return items;
  })().finally(() => {
    calendarInFlight = null;
  });
  return calendarInFlight;
}
