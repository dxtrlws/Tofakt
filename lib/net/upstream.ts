function stripSlash(url: string): string {
  return url.replace(/\/$/, "");
}

function configured(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return stripSlash(trimmed ? trimmed : fallback);
}

export function traktApiBase(): string {
  return configured(process.env.TRAKT_API_URL, "https://api.trakt.tv");
}

export function tmdbApiOrigin(): string {
  return configured(process.env.TMDB_API_URL, "https://api.themoviedb.org");
}
