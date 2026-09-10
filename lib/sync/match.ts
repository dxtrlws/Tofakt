export type SnapshotPlay = {
  traktHistoryId: number | null;
  kind: "movie" | "episode";
  tmdbId: number | null;
  imdbId: string | null;
  tvdbId: number | null;
  showTmdbId?: number | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  watchedAt: Date | null;
};

export type MatchablePlay = {
  kind: "movie" | "episode";
  tmdbId: number | null;
  imdbId: string | null;
  tvdbId: number | null;
  showTmdbId: number | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  watchedAt: Date;
};

function sameId(
  left: { tmdbId: number | null; imdbId: string | null; tvdbId: number | null },
  right: {
    tmdbId: number | null;
    imdbId: string | null;
    tvdbId: number | null;
  },
): boolean {
  if (left.tmdbId && right.tmdbId && left.tmdbId === right.tmdbId) {
    return true;
  }
  if (left.imdbId && right.imdbId && left.imdbId === right.imdbId) {
    return true;
  }
  if (left.tvdbId && right.tvdbId && left.tvdbId === right.tvdbId) {
    return true;
  }
  return false;
}

function sameShow(play: MatchablePlay, row: SnapshotPlay): boolean {
  const rowShow = row.showTmdbId ?? null;
  if (play.showTmdbId && rowShow && play.showTmdbId === rowShow) {
    return true;
  }
  // Older snapshots stored show TMDB in tmdbId when the episode had no TMDB id.
  return Boolean(
    play.showTmdbId && row.tmdbId && play.showTmdbId === row.tmdbId,
  );
}

function sameEpisode(play: MatchablePlay, row: SnapshotPlay): boolean {
  const bothHaveNumbers =
    play.seasonNumber != null &&
    play.episodeNumber != null &&
    row.seasonNumber != null &&
    row.episodeNumber != null;
  if (bothHaveNumbers) {
    if (
      row.seasonNumber !== play.seasonNumber ||
      row.episodeNumber !== play.episodeNumber
    ) {
      return false;
    }
    return sameId(play, row) || sameShow(play, row);
  }
  return sameId(play, row);
}

export function matchSnapshot(
  play: MatchablePlay,
  snapshots: SnapshotPlay[],
  windowMinutes: number,
): SnapshotPlay | undefined {
  const windowMs = windowMinutes * 60_000;
  return snapshots.find((row) => {
    if (!row.watchedAt) {
      return false;
    }
    if (
      Math.abs(row.watchedAt.getTime() - play.watchedAt.getTime()) > windowMs
    ) {
      return false;
    }
    if (play.kind === "movie") {
      return row.kind === "movie" && sameId(play, row);
    }
    return row.kind === "episode" && sameEpisode(play, row);
  });
}
