import type { ReactNode } from "react";

export type SyncBadgeState =
  | "synced"
  | "pending"
  | "skipped"
  | "failed"
  | "unmatched";

const LABELS: Record<SyncBadgeState, string> = {
  synced: "Synced",
  pending: "Pending",
  skipped: "Not synced",
  failed: "Failed",
  unmatched: "Unmatched",
};

const HINTS: Record<SyncBadgeState, string> = {
  synced: "On Trakt. Use Remove from Trakt on the row to delete this play.",
  pending: "Queued. Will go to Trakt when you run a sync job.",
  skipped: "Deliberately excluded from sync.",
  failed: "Tried to sync and could not.",
  unmatched: "No usable external id, so Trakt cannot identify it.",
};

function hintFor(state: SyncBadgeState, skipReason: string | null): string {
  if (state === "skipped") {
    if (skipReason === "before_cutoff") {
      return "Older than Newly watched only. It will not auto-sync. Use Sync now to send this play anyway.";
    }
    if (skipReason === "user_ignored") {
      return "You chose not to sync this play.";
    }
    if (skipReason === "library_excluded") {
      return "This library is excluded in Settings.";
    }
    if (skipReason === "below_threshold") {
      return "Did not reach the completion threshold.";
    }
  }
  if (state === "pending") {
    return "Queued. Manual mode waits for Run sync now or Sync now. Newly watched only sends these on the next automatic run.";
  }
  return HINTS[state];
}

export function badgeState(status: string): SyncBadgeState {
  if (
    status === "synced" ||
    status === "pending" ||
    status === "failed" ||
    status === "unmatched"
  ) {
    return status;
  }
  return "skipped";
}

export function SyncBadge({
  status,
  skipReason = null,
}: {
  status: string;
  skipReason?: string | null;
}) {
  const state = badgeState(status);
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 ${shellClass(state)}`}
      title={hintFor(state, skipReason)}
    >
      <span className="sr-only">{hintFor(state, skipReason)}</span>
      {icon(state)}
      <span
        className={`text-meta font-semibold leading-meta ${labelClass(state)}`}
      >
        {LABELS[state]}
      </span>
    </span>
  );
}

function shellClass(state: SyncBadgeState): string {
  switch (state) {
    case "synced":
      return "border-sync-synced/35 bg-sync-synced/12";
    case "pending":
      return "border-sync-pending/35 bg-sync-pending/12";
    case "failed":
      return "border-sync-failed/35 bg-sync-failed/12";
    case "unmatched":
      return "border-sync-unmatched/35 bg-sync-unmatched/12";
    default:
      return "border-sync-skipped/35 bg-sync-skipped/12";
  }
}

function labelClass(state: SyncBadgeState): string {
  switch (state) {
    case "synced":
      return "text-sync-synced";
    case "pending":
      return "text-sync-pending";
    case "failed":
      return "text-sync-failed";
    case "unmatched":
      return "text-sync-unmatched";
    default:
      return "text-sync-skipped";
  }
}

function icon(state: SyncBadgeState): ReactNode {
  const stroke = "currentColor";
  const className = `size-3 shrink-0 ${labelClass(state)}`;
  return (
    <span aria-hidden="true" className={className}>
      {/* biome-ignore lint/a11y/noSvgWithoutTitle: paired with a visible text label */}
      <svg fill="none" viewBox="0 0 12 12">
        {paths(state, stroke)}
      </svg>
    </span>
  );
}

function paths(state: SyncBadgeState, stroke: string): ReactNode {
  if (state === "synced") {
    return (
      <>
        <circle cx="6" cy="6" r="5" stroke={stroke} strokeWidth="1.5" />
        <path
          d="M3.5 6.2L5.2 8L8.5 4.2"
          stroke={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </>
    );
  }
  if (state === "pending") {
    return (
      <>
        <circle cx="6" cy="6" r="5" stroke={stroke} strokeWidth="1.5" />
        <path
          d="M6 3.5V6L8 7.2"
          stroke={stroke}
          strokeLinecap="round"
          strokeWidth="1.5"
        />
      </>
    );
  }
  if (state === "failed") {
    return (
      <>
        <path
          d="M6 1.5L11 10.5H1L6 1.5Z"
          stroke={stroke}
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M6 5V7.5"
          stroke={stroke}
          strokeLinecap="round"
          strokeWidth="1.5"
        />
        <circle cx="6" cy="9" fill={stroke} r="0.6" />
      </>
    );
  }
  if (state === "unmatched") {
    return (
      <>
        <circle cx="6" cy="6" r="5" stroke={stroke} strokeWidth="1.5" />
        <path
          d="M6 3.2V3.8"
          stroke={stroke}
          strokeLinecap="round"
          strokeWidth="1.5"
        />
        <path
          d="M6 5.2V8.8"
          stroke={stroke}
          strokeLinecap="round"
          strokeWidth="1.5"
        />
      </>
    );
  }
  return (
    <>
      <circle cx="6" cy="6" r="5" stroke={stroke} strokeWidth="1.5" />
      <path
        d="M4 6H8"
        stroke={stroke}
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </>
  );
}
