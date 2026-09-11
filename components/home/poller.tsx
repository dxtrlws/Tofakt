"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const INTERVAL_MS = 45_000;

/** Refresh local pending/attention. Trakt history/calendar stay on the SQLite cache. */

export function HomePoller() {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => {
      router.refresh();
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [router]);
  return null;
}
