/**
 * Runs `fn` over `items` with at most `limit` calls in flight.
 *
 * Upstream artwork lookups fan out over every distinct title in a month or a
 * year — hundreds of them — so an unbounded `Promise.all` reliably trips TMDB
 * rate limits and request timeouts. Results keep the order of `items`.
 */
export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  if (items.length === 0) {
    return out;
  }
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(items[index], index);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return out;
}
