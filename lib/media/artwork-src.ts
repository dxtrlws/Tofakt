/**
 * Builds the `src` for an artwork URL.
 *
 * `artworkUrl` is either a local tofa proxy path (`/api/artwork/<id>/poster`),
 * which takes `w`/`h` query params, or an absolute TMDB CDN URL, which already
 * carries its size in the path and must be left alone.
 */
export function artworkSrc(url: string, w: number, h: number): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${url}${url.includes("?") ? "&" : "?"}w=${String(w)}&h=${String(h)}`;
}
