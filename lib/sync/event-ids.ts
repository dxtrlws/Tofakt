export function parseSyncEventIds(form: FormData): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const value of form.getAll("eventId")) {
    const id = String(value).trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  return ids;
}
