import type { ConnectionStatus } from "../connections/types";

export type HomeConnection = {
  provider: "tofa" | "trakt" | "tmdb";
  status: ConnectionStatus;
  label: string;
  detail: string;
};

export type HomeMonth = {
  name: string;
  plays: number;
  hours: number;
  hoursLabel: string;
  daysActive: number;
  firstPlay: string | null;
};

export type HomeAttention = {
  eventId: string;
  title: string;
  artworkUrl: string | null;
  href: string;
  line: string;
  tone: "failed" | "unmatched";
};

export type HomePosterTone = "pending" | "premiere" | "finale" | "soon";

export type HomePoster = {
  id: string;
  title: string;
  subtitle: string;
  overlay: string;
  overlayMuted: string | null;
  badge: string | null;
  badgeTone: HomePosterTone;
  artworkUrl: string | null;
  href: string | null;
  artworkKey?: string | null;
  episodeType?: string | null;
  airsAt?: Date;
};
