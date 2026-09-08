import { createHash } from "node:crypto";

export type DedupeInput = {
  id?: string | null;
  mediaId?: string | null;
  watchedAt: Date;
};

export type DedupeResult = {
  key: string;
  strategy: "tofa_history_id" | "fingerprint";
};

export function dedupeForPlay(input: DedupeInput): DedupeResult {
  if (input.id) {
    return { key: input.id, strategy: "tofa_history_id" };
  }
  return {
    key: fingerprintKey(input.mediaId, input.watchedAt),
    strategy: "fingerprint",
  };
}

export function fingerprintKey(
  mediaId: string | null | undefined,
  watchedAt: Date,
): string {
  const truncated = new Date(watchedAt);
  truncated.setUTCSeconds(0, 0);
  const payload = `${mediaId ?? ""}:${truncated.toISOString()}`;
  return createHash("sha256").update(payload).digest("hex");
}

export function tofaMediaKey(play: {
  mediaType?: string | null;
  mediaId?: string | null;
  episodeId?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  historyId: string;
}): string {
  const isTv =
    play.mediaType === "tv" ||
    Boolean(play.episodeId) ||
    play.seasonNumber != null;
  if (isTv) {
    if (play.episodeId) {
      return play.episodeId;
    }
    return `${play.mediaId ?? "unknown"}:s${play.seasonNumber ?? 0}e${play.episodeNumber ?? 0}`;
  }
  return play.mediaId ?? play.historyId;
}
