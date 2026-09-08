export type SnapshotPlay = {
  traktHistoryId: number | null;
  kind: "movie" | "episode";
  tmdbId: number | null;
  imdbId: string | null;
  tvdbId: number | null;
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
    if (row.kind !== "episode") {
      return false;
    }
    if (sameId(play, row)) {
      return true;
    }
    return Boolean(
      play.showTmdbId &&
        row.tmdbId &&
        play.showTmdbId === row.tmdbId &&
        play.seasonNumber != null &&
        play.episodeNumber != null &&
        row.seasonNumber === play.seasonNumber &&
        row.episodeNumber === play.episodeNumber,
    );
  });
}
