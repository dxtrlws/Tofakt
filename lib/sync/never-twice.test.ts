import { describe, expect, it } from "vitest";
import type { SyncCandidate } from "./payload";
import { applyPostResponse } from "./response";
import { shouldPostRecord } from "./sendable";

type PlayState = {
  status: string;
  skipReason: string | null;
};

type Op =
  | "ingest"
  | "begin_sync"
  | "post_ok"
  | "post_partial"
  | "retry"
  | "ignore"
  | "interrupt";

function movie(id: string): SyncCandidate {
  return {
    eventId: id,
    kind: "movie",
    tmdbId: 1,
    imdbId: null,
    tvdbId: null,
    showTmdbId: null,
    seasonNumber: null,
    episodeNumber: null,
    watchedAt: new Date("2026-09-04T02:31:00.000Z"),
  };
}

function applyOp(state: PlayState, op: Op): PlayState {
  switch (op) {
    case "ingest":
      if (state.status === "synced" || state.skipReason === "user_ignored") {
        return state;
      }
      if (state.status === "syncing" || state.status === "failed") {
        return state;
      }
      return { status: "pending", skipReason: state.skipReason };
    case "begin_sync":
      return shouldPostRecord(state)
        ? { status: "syncing", skipReason: null }
        : state;
    case "post_ok": {
      if (state.status !== "syncing") {
        return state;
      }
      const outcome = applyPostResponse([movie("a")], {
        added: { movies: 1, episodes: 0 },
        not_found: {},
      });
      if (outcome.synced.includes("a")) {
        return { status: "synced", skipReason: "watchlog_posted" };
      }
      return { status: "pending", skipReason: null };
    }
    case "post_partial": {
      if (state.status !== "syncing") {
        return state;
      }
      const outcome = applyPostResponse([movie("a")], {
        added: { movies: 0, episodes: 0 },
        not_found: {},
      });
      if (outcome.pending.includes("a")) {
        return { status: "pending", skipReason: null };
      }
      return state;
    }
    case "retry":
      return state.status === "failed"
        ? { status: "pending", skipReason: null }
        : state;
    case "ignore":
      return { status: "skipped", skipReason: "user_ignored" };
    case "interrupt":
      return state.status === "syncing"
        ? { status: "pending", skipReason: null }
        : state;
    default:
      return state;
  }
}

const OPS: Op[] = [
  "ingest",
  "begin_sync",
  "post_ok",
  "post_partial",
  "retry",
  "ignore",
  "interrupt",
];

function sequences(length: number): Op[][] {
  if (length === 0) {
    return [[]];
  }
  const shorter = sequences(length - 1);
  const out: Op[][] = [];
  for (const prefix of shorter) {
    for (const op of OPS) {
      out.push([...prefix, op]);
    }
  }
  return out;
}

describe("never send a play twice", () => {
  it("refuses to post after a successful Watchlog send", () => {
    let state: PlayState = { status: "pending", skipReason: null };
    state = applyOp(state, "begin_sync");
    state = applyOp(state, "post_ok");
    expect(state).toEqual({ status: "synced", skipReason: "watchlog_posted" });
    expect(shouldPostRecord(state)).toBe(false);
    state = applyOp(state, "ingest");
    state = applyOp(state, "begin_sync");
    state = applyOp(state, "retry");
    expect(shouldPostRecord(state)).toBe(false);
  });

  it("keeps the invariant across shuffled ingest and sync interruptions", () => {
    for (const ops of sequences(4)) {
      let state: PlayState = { status: "pending", skipReason: null };
      let posted = 0;
      for (const op of ops) {
        const next = applyOp(state, op);
        if (
          state.skipReason !== "watchlog_posted" &&
          next.skipReason === "watchlog_posted"
        ) {
          posted += 1;
        }
        if (next.skipReason === "watchlog_posted") {
          expect(shouldPostRecord(next)).toBe(false);
        }
        state = next;
      }
      expect(posted).toBeLessThanOrEqual(1);
    }
  });
});
