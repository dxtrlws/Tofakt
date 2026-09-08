import type { SyncSettings } from "../sync/settings";
import type { PlaySession } from "../tofa/history";
import { durationWatchedSeconds } from "./duration";
import {
  completionPercent,
  type EligibilityKind,
  isComplete,
} from "./eligibility";
import type { Thresholds } from "./persist";
import { isPlaybackSession, watchedAtFromPlay } from "./timestamps";

export type EvaluatedPlay = {
  watchedAt: Date;
  convention: "completion" | "start";
  clamped: boolean;
  durationWatchedSeconds: number | null;
  completionPercent: number | null;
  isComplete: boolean;
  isPlayback: boolean;
  libraryExcluded: boolean;
  beforeCutoff: boolean;
};

export function evaluatePlay(
  play: PlaySession,
  media: {
    kind: EligibilityKind;
    runtimeSeconds: number | null;
    tofaLibraryId: string | null;
  },
  thresholds: Thresholds,
  sync: SyncSettings,
): EvaluatedPlay {
  const playback = isPlaybackSession({
    startedAt: play.started_at,
    endedAt: play.ended_at,
  });
  const started = Date.parse(play.started_at);
  const ended = play.ended_at ? Date.parse(play.ended_at) : Number.NaN;
  const wallClockMs =
    Number.isFinite(started) && Number.isFinite(ended) ? ended - started : null;
  const duration = durationWatchedSeconds({
    secondsWatched: play.seconds_watched,
    positionMs: playback ? play.position_ms : 0,
    wallClockMs,
  });
  const watched = watchedAtFromPlay({
    startedAt: play.started_at,
    endedAt: play.ended_at,
    prefer: sync.timestampConvention,
    durationWatchedSeconds: duration,
    runtimeSeconds: media.runtimeSeconds,
  });
  const percent = completionPercent({
    kind: media.kind,
    progressPercent: play.progress_percent,
    durationWatchedSeconds: duration,
    runtimeSeconds: media.runtimeSeconds,
    movieThreshold: thresholds.movie,
    episodeThreshold: thresholds.episode,
  });
  const cutoff =
    sync.mode === "forward" && sync.cutoffIso
      ? Date.parse(sync.cutoffIso)
      : null;
  return {
    watchedAt: watched.watchedAt,
    convention: watched.convention,
    clamped: watched.clamped,
    durationWatchedSeconds: duration,
    completionPercent: percent,
    isComplete: isComplete({
      kind: media.kind,
      progressPercent: play.progress_percent,
      durationWatchedSeconds: duration,
      runtimeSeconds: media.runtimeSeconds,
      movieThreshold: thresholds.movie,
      episodeThreshold: thresholds.episode,
      isPlayback: playback,
    }),
    isPlayback: playback,
    libraryExcluded: Boolean(
      media.tofaLibraryId &&
        sync.excludedLibraryIds.includes(media.tofaLibraryId),
    ),
    beforeCutoff: cutoff != null && watched.watchedAt.getTime() < cutoff,
  };
}

export function playKind(play: PlaySession): EligibilityKind {
  return play.media_type === "tv" || play.episode_id ? "episode" : "movie";
}
