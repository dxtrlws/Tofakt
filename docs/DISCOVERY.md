# tofa discovery (Phase 1)

Live probe against a claimed tofa **0.9.36** server (`api_version` **49**), `connection_type: direct`, via a custom HTTPS URL. Auth: admin API key. The one-off probe scripts and redacted dumps in `docs/discovery-raw/` are local only and are not in git.

OpenAPI is **not** public at `docs.tofa.tv` without login. The running server serves it at **`GET /api/v1/openapi.json`** (authenticated). That spec is the schema source of truth below; examples are from real responses.

**Dedupe decision (questions 3 and 6):** one row per play, stable UUID `id`. Use `history.id` as `dedupe_key`. Strategy column: `tofa_history_id`.

---

## Server identity

`GET /api/v1/auth/status` (no auth):

```json
{
  "claimed": true,
  "connect_url": "https://api.tofa.tv",
  "server_id": "<uuid>"
}
```

`GET /api/v1/health`: `{ "status": "ok", "database": "ok", "version": "0.9.36", "server_id": "<uuid>" }`

`GET /api/v1/system/info` (auth): `version`, `api_version` (integer, currently 49), `capabilities[]`, `library_count`, `user_count`, `connection_type`, `relay_*`, `server_id`, `port` (33333). Gate on **capabilities**, not the version string. This install advertises `auth.api_keys`, `artwork.id_urls`, `media.watched_played`, `watch.bulk_status`, among others.

`GET /api/v1/users/me`: `id`, `username`, `is_admin`, `disabled`, `preferences` (large). No user ratings field. This token was admin (`is_admin: true`).

---

## 1. Pagination

Envelope (OpenAPI `HistoryListResponse`):

```json
{ "items": [ /* PlaySessionListItem */ ], "has_more": true }
```

No `total`, no opaque cursor, no `Link` header.

Documented query params (`operationId: list_my_history`):

| Param | Type | Observed |
|---|---|---|
| `limit` | int64 | Honored. Default **50**. `1` → 1. `100` → 100. `200`/`500`/`1000` all returned **166** (the entire history) with `has_more: false`. No max advertised; treat 200 as a safe page size. |
| `before` | date-time | **The pager.** ISO-8601 with time (`2026-09-04T00:00:00Z`). Date-only (`2026-09-04`) → **400**. UUID → **400**. Exclusive: `before=<row.started_at>` does not include that row. |
| `media_type` | string | `movie` and `tv` filter correctly. `episode` returns an empty list. Enum on media is `movie` \| `tv` \| `other`. |

Ignored (200, same first page): `page`, `offset`, `cursor`, `after`, `since`, `skip`, `from`, `start`, `after_id`. Do not use them.

**Ordering:** newest `started_at` first.

**How to page:**

```
GET /watch/history?limit=200
while has_more:
  GET /watch/history?limit=200&before=<last_item.started_at>
```

On this library, 166 rows fit in one `limit=200` call. Still implement the `before` walk; libraries will grow past one page.

Admin `GET /api/v1/system/watch-history` uses the same `before` + `limit` pair, plus `user_id`, `client`, `device`, `play_method`, `media_id`.

---

## 2. Filtering / incremental ingest

There is **no `after` / `since`**. Incremental ingest cannot ask “everything newer than T”.

Cheap incremental path:

1. Persist watermark `last_started_at_seen` (and the set of ids in the last ~24h for overlap).
2. Fetch newest pages (`limit=200`, then `before` if needed) until a page is entirely older than the watermark minus 24h, or until every id on the page is already stored.
3. Re-read the last 24 hours every run (late edits / mark-watched bursts).

`before=2026-09-04T00:00:00Z` returned 161 rows whose newest `started_at` was `2026-09-03T21:59:35Z` — it is a real cutoff, just exclusive-upper-bound, not a lower bound.

`GET /api/v1/media/changes` is **not** a watch-history cursor. Shape:

```json
{ "latest_revision": <int>, "changes": [{ "revision", "media_id", "change_kind", "library_id" }], "requires_full_sync": false }
```

Query: `since_revision`, `limit`. It reports library/metadata mutations. Keep polling `/watch/history`.

---

## 3. Per-event fields (`PlaySessionListItem`)

One object per play. Required: `id`, `title`, `play_method`, `position_ms`, `progress_percent`, `seconds_watched`, `started_at`.

| Field | Role |
|---|---|
| `id` | Stable UUID. **Dedupe key.** |
| `media_id` | Show UUID for TV, movie UUID for movies. Nullable in spec; present on every live row. |
| `episode_id` | Episode UUID for TV; `null` for movies. `GET /media/{episode_id}` is **404**. |
| `media_file_id` | File UUID. |
| `media_type` | `tv` \| `movie` (also `other` in the enum). |
| `title` | Show name or movie title. Not the episode title. |
| `season_number`, `episode_number`, `episode_title` | TV only; null on movies. |
| `poster_path` | Relative, e.g. `images/posters/….jpg`. Not a URL. |
| `play_method` | e.g. `DirectPlay`. |
| `duration_ms` | File/runtime length in ms. |
| `position_ms` | Playback head. Completed Silo row: `position_ms == duration_ms`. Partial Suzume: `43669` of `7285320`. |
| `progress_percent` | Integer 0–100. **Use this for the completion threshold.** |
| `seconds_watched` | Unreliable. Completed 100% rows often have `0`. Some real sessions have thousands. Do **not** use as the only duration source. |
| `started_at` | Required ISO datetime. |
| `ended_at` | Nullable. Present on live rows. |
| `end_reason` | `completed` \| `stopped` \| `abandoned` (first 50: 21 / 20 / 9). |

**No device/client on the user history endpoint.** Those exist only on admin `PlaySessionAdminItem`: `client_name`, `platform`, `device_model`, `device_name`, `client_version`, plus `user_id` / `username`. Prefer the admin endpoint when the token is admin if we want device labels.

**Completed vs partial:** `end_reason === "completed"` and/or `progress_percent` vs configured thresholds. Do not trust `seconds_watched`. Fallback duration for stats: `position_ms / 1000` if `seconds_watched == 0`, else `seconds_watched`; last resort `duration_ms / 1000`.

**Timestamps for Trakt `watched_at`:** prefer `ended_at` when present (completion convention). Caveat: bulk mark-watched / import rows can have `ended_at - started_at` of **44ms** while `duration_ms` is a full episode. Real plays span minutes to hours (median gap in first 50 ≈ 533s, max ≈ 2.5h). If `ended_at` is missing or within a second of `started_at` and `progress_percent` is high, still send `ended_at` (that is when tofa recorded completion). Never send a future timestamp.

**User history has no TMDB/IMDb/TVDB fields.**

Redacted example (TV, completed):

```json
{
  "id": "9b054280-7068-44f1-81dc-7ced5320d977",
  "media_id": "cafba6b0-4d86-444c-93d9-1e8f2c4821e1",
  "episode_id": "d45ee862-914a-4936-a547-349448f02a46",
  "title": "Silo",
  "media_type": "tv",
  "season_number": 3,
  "episode_number": 10,
  "episode_title": "Troy",
  "play_method": "DirectPlay",
  "duration_ms": 3619408,
  "position_ms": 3619408,
  "progress_percent": 100,
  "seconds_watched": 0,
  "started_at": "2026-09-05T01:24:30.623707Z",
  "ended_at": "2026-09-05T01:24:30.667739Z",
  "end_reason": "completed"
}
```

Redacted example (movie, partial, two plays of the same title = rewatch rows):

```json
{
  "id": "9b611431-97bb-44ea-a104-23741306ea9b",
  "media_id": "a21643bf-f170-4efd-b82d-dc4700d5f06a",
  "episode_id": null,
  "title": "Suzume",
  "media_type": "movie",
  "progress_percent": 1,
  "end_reason": "stopped"
}
```

---

## 4. Media linkage

History carries **tofa UUIDs only**. Hydrate with `GET /api/v1/media/{media_id}` (the show/movie id, never `episode_id`).

Movie detail includes `tmdb_id`, `imdb_id`, `provider_ids[]` (`tmdb` / `imdb` / `tofa-connect`), `runtime_minutes`, `genres[]`, `library_id`, artwork paths.

TV detail is the **show**. Same id fields at show level (`tmdb_id: 125988` for Silo). Nested `seasons[].episodes[]` each have:

```json
{
  "id": "<episode uuid>",
  "season_id": "<uuid>",
  "episode_number": 10,
  "title": "Troy",
  "runtime_minutes": 60,
  "tmdb_episode_id": 7173966
}
```

Match `history.episode_id` to `seasons[].episodes[].id` to get **episode-level TMDB**. Also keep show `tmdb_id` + `season_number` + `episode_number` as the Trakt fallback body.

`POST /api/v1/media/batch` exists (array of `MediaDetail`). Use it when hydrating many unknown `media_id`s.

Artwork: `GET /api/v1/auth/image-token` → `{ token, expires_in: 604800 }` (7 days). Then `GET /api/v1/artwork/{media_id}/{kind}?st=<token>` with **`Accept: image/*`**. Without that Accept the server returns **406**. Kinds: `poster`, `backdrop`, `backdrop_thumb`, `logo`. Optional `w`/`h` (1–4096). For TV, `media_id` is the show. Proxy in our app; never send `st` to the browser.

---

## 5. Episode shape

| History field | Meaning |
|---|---|
| `media_type: "tv"` | Episode play (not `"episode"`). |
| `title` | Show title. |
| `season_number` / `episode_number` / `episode_title` | SxxExx identity. |
| `episode_id` | Episode UUID (not a media-detail URL). |
| `media_id` | Show UUID. |

Show-level TMDB/IMDb/TVDB: yes, on `GET /media/{show media_id}`. Episode-level TMDB: `tmdb_episode_id` on the nested episode object. No TVDB episode id observed on that object.

---

## 6. Rewatches

**One row per play.** Same `media_id` + `episode_id` (or movie `media_id`) appears multiple times with **different `id`s**. First 50 rows included e.g. four plays of Suzume and two of Silo S03E09.

Do not collapse by media id. Dedupe only on `history.id`.

---

## Other findings

- **Libraries:** `GET /api/v1/libraries` returns an array (`id`, `name`, `media_type`, paths, scan metadata). Use for include/exclude.
- **User ratings:** `GET /api/v1/users/me/ratings` and `/watch/ratings` are **404**. Media payload has critic/audience scores (`tofa_critics_rating`, RT, IMDb), not the user’s stars. Monthly ratings come from **Trakt only** unless a ratings path appears later.
- **Genres:** `GET /api/v1/media/genres` is a list (200).
- **Custom access URL:** API key worked against HTTPS on a non-loopback hostname (direct). Still warn on `localhost` inside Docker.

---

## Ingest implications (lock these in)

| Decision | Value |
|---|---|
| `dedupe_key` | `tofa_history_id` = `PlaySessionListItem.id` |
| Fingerprint fallback | Keep the sha256 path in code but do not use it while `id` is present |
| Qualifying play | `progress_percent` vs thresholds; `end_reason` as extra signal; never `seconds_watched` alone |
| `watched_at` | `ended_at` if set, else `started_at` |
| Hours watched | `seconds_watched` if > 0, else `position_ms/1000`, else `duration_ms/1000`; footnote runtime fallbacks |
| TV ids for Trakt | Prefer `tmdb_episode_id`; else show `tmdb_id` + season + episode numbers |
| Artwork | Show/movie `media_id` + image token + `Accept: image/*` |
| Incremental | Newest-first `limit` + `before` walk; 24h overlap; ignore `media/changes` for plays |

---

## Assumptions that were wrong

See also `app-instructions.md` §5.1 / §14.

1. History pagination is **not** page/offset. It is `limit` + exclusive `before` datetime.
2. There is **no** `since`/`after` lower bound.
3. History rows do **not** include TMDB ids.
4. `media_id` on a TV play is the **show**, not the episode. Episode UUID is `episode_id` and is not a `/media/{id}` target.
5. `seconds_watched` is **not** a trustworthy duration.
6. User history has **no** device name; admin history does.
7. `media/changes` does **not** replace history polling.
8. Artwork requires an image `Accept` header; JSON Accept → 406.
9. tofa user ratings are **not** exposed on the probed endpoints.
