# Watchlog — Build Brief

A self-hosted web app that watches your **tofa** media server, records everything you play, syncs those plays to **Trakt** with accurate timestamps, and turns the accumulated history into monthly and yearly reviews.

This document is the single source of truth for an AI coding agent building the app. Read it end to end before writing code. Agents should cite **`app-instructions.md`**, not `README.md`.

> "Watchlog" is a placeholder. Rename it throughout before Phase 2 if you have something better.

---

## 0. How to use this repository

```
/
├── app-instructions.md    ← this file (the build brief)
├── README.md              ← how to run Watchlog
├── design/
│   ├── *.png|jpg          ← design language references (Paper Design exports)
│   └── TOKENS.md          ← YOU generate this in Phase 0 (see §3)
├── docs/
│   ├── tofa-api.md        ← tofa public API reference (provided)
│   └── DISCOVERY.md       ← YOU generate this in Phase 1 (see §5.1)
└── (source tree — you create)
```

**Kickoff prompt** (paste into your code editor's agent to start):

> Read `app-instructions.md` in full, then `docs/tofa-api.md`, then every image in `design/`. Do not write application code yet. First produce `design/TOKENS.md` per §3 and a proposed file tree per §4, and list every assumption you are making about tofa response shapes. Wait for my confirmation before Phase 1.

**Two rules for the agent:**

1. **Do not invent API response shapes.** The tofa reference lists endpoints and paths but not full response schemas. Where this brief describes a field, treat it as a *hypothesis to verify* against the live server, not as fact. §5.1 defines the discovery step that resolves this.
2. **Do not invent visual design.** The design language comes from the images in `design/`. connect to @paper mcp server to design the UI to lock down it down before the build starts.

---

## 1. What the app is

**Problem.** tofa records what you watch. Trakt is where your permanent, portable viewing history lives. Nothing connects the two, and manually marking things watched loses the timestamps that make history worth keeping.

**Solution.** A always-on companion service that:

- Polls tofa for new watch events
- Maps each play to a Trakt movie or episode
- Posts it to Trakt with the correct `watched_at` timestamp
- Keeps a local ledger of what has and hasn't been synced, and why
- Builds statistics on top of that ledger that neither tofa nor Trakt gives you

**Audience.** One person or one household running it on a home server, NAS, or VPS, in Docker, next to their tofa install.

### Non-goals (do not build these)

- Media playback. This app never streams video.
- A tofa client or browser. No library browsing, no "play" buttons.
- Replacing Trakt's own scrobbler for other players. Only tofa is a source.
- Multi-tenant SaaS. Single deployment, single household.
- Writing back to tofa. The app reads tofa watch state; it does not modify it.

---

## 2. Core concepts and vocabulary

Use these exact terms in code, UI copy, and the database. Consistency here prevents most of the confusion in this domain.

| Term | Meaning |
|---|---|
| **Watch event** | One play of one thing at one time, ingested from tofa. Rewatches are separate watch events. This is the atomic unit of the app. |
| **Media item** | A movie or an episode, with its external IDs (TMDB/IMDb/TVDB), runtime, genres, artwork. Cached locally. |
| **Sync record** | The state of one watch event with respect to Trakt: pending, synced, failed, skipped, unmatched. |
| **Ingestion** | Pulling watch events from tofa into the local database. Independent of syncing. |
| **Sync** | Pushing a watch event to Trakt. |
| **Backfill** | A one-time sync of watch events that predate the app's installation. |
| **Forward-only** | Sync mode where only events after the activation timestamp are eligible. |
| **Cutoff** | The activation timestamp used by forward-only mode. |
| **Qualifying play** | A watch event that met the completion threshold and is therefore eligible for sync. |
| **Reconciliation** | Comparing local watch events against Trakt's existing history to avoid creating duplicate plays. |

**Ingestion and sync are separate concerns.** Everything tofa reports gets ingested and shows in history and statistics. Only qualifying, eligible events get synced. Keep these decoupled in the code; conflating them is the most common way this kind of app goes wrong.

---

## 3. Design language (Phase 0)

The `design/` folder holds reference images produced in Paper Design. They define the app's visual identity. Your first task is to extract, not interpret.

Read the frontend design skill/guidance available in your environment before styling anything.

### Phase 0 deliverable: `design/TOKENS.md`

Derive from the images and record:

- **Color**: background layers (base, raised, overlay), foreground/text tiers, accent/brand, semantic colors for the five sync states (§7.3), chart palette of at least 8 distinguishable hues that survive dark mode. Record as OKLCH with hex fallback.
- **Typography**: families, the actual scale used in the mockups (don't impose a generic 1.25 ratio if the images show otherwise), weights, line heights, letter spacing on display sizes.
- **Spacing and radius**: the base unit, the radius scale, whether the design is soft or sharp.
- **Elevation**: shadows, borders, or neither. Many 2026 designs use border + tinted background instead of shadow. Match what you see.
- **Motion**: durations and easing implied by the design. Default to 150–250 ms and a single easing curve unless the design says otherwise.
- **Density**: how much air the layouts use. This one decision changes the whole feel and is easy to get wrong.

Then implement the tokens as CSS custom properties in a Tailwind v4 CSS-first theme (`@theme`). Every component consumes tokens. No hard-coded hex values anywhere in the component tree.

Where the images don't cover something (empty states, error states, focus rings, disabled states), extend the system in the same spirit and note the extension in `TOKENS.md` as your own addition.

---

## 4. Architecture

### 4.1 Shape

A single Node process serving both the UI and the API, plus an in-process background scheduler, backed by an embedded database. One container. No external services required.

This is deliberate. A self-hosted app that requires Postgres, Redis, and a worker container will not get installed. Keep the deployment to `docker run` with one volume.

```
┌──────────────────────── Container ────────────────────────┐
│                                                            │
│   Next.js 16 (App Router, React 19)                        │
│   ├── UI (RSC + client islands)                            │
│   ├── Route handlers  /api/*                               │
│   └── Server actions (mutations)                           │
│                                                            │
│   Scheduler (in-process, single instance)                  │
│   ├── ingest job     → tofa watch history                  │
│   ├── sync job       → Trakt sync/history                  │
│   ├── enrich job     → TMDB metadata + providers           │
│   └── token refresh  → tofa + Trakt                        │
│                                                            │
│   SQLite (WAL) at /data/watchlog.db                        │
│   Encrypted secrets at rest                                │
└────────────────────────────────────────────────────────────┘
        │                    │                   │
     tofa API           Trakt API            TMDB API
   (LAN or relay)     api.trakt.tv       api.themoviedb.org
```

**All third-party calls happen server-side.** No API key, token, or secret ever reaches the browser. This is non-negotiable and constrains the whole design: the client talks only to this app's own API.

### 4.2 Stack

Verify current versions at build time rather than trusting these pins; the ecosystem moves.

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19.2 | Current LTS line. Server Components keep secrets server-side by construction. |
| Language | TypeScript, `strict: true`, no `any` | |
| Styling | Tailwind CSS v4, CSS-first `@theme` config | Tokens live in CSS, matching §3. |
| Components | Headless primitives (Radix / Base UI) + your own layer | Don't adopt a component library whose look fights the design images. |
| Database | SQLite in WAL mode, `better-sqlite3` or libSQL | Zero-config, single file, trivial backup. |
| ORM/migrations | Drizzle ORM + drizzle-kit | Migrations run automatically on container start. |
| Validation | Zod at every boundary (env, API responses, forms) | Third-party responses are untrusted input. |
| Client state | TanStack Query for polled data; RSC for the rest | |
| Charts | A headless-friendly chart lib you can theme with tokens (Recharts or Visx) | Must respect the design palette. |
| Jobs | Own scheduler over a SQLite `jobs` table | No Redis. |
| Testing | Vitest (unit), Playwright (e2e), MSW or fixtures for third-party APIs | |
| Lint/format | Biome, or ESLint flat config + Prettier | Pick one, enforce in CI. |
| Logging | Structured JSON (pino), redaction of secrets enforced in the logger | |

### 4.3 Non-negotiable engineering constraints

- **Idempotency everywhere.** Every ingest and every sync must be safe to run twice. This is the property that makes the app trustworthy.
- **No destructive operation without preview.** Backfill, reset, and delete all require a dry-run summary and explicit confirmation.
- **Timezone-correct.** Store every timestamp in UTC. Compute every user-facing boundary (day, month, year) in the user's configured timezone. A play at 11 pm on January 31 in `America/New_York` belongs to January.
- **Degrade, don't crash.** If TMDB is down, statistics still render without artwork and provider data. If Trakt is down, ingestion continues and the sync queue grows. If tofa is unreachable, the app still shows history.
- **Every failure is legible.** The user must always be able to answer "why is this item not on Trakt?" from the UI, without reading logs.

---

## 5. Integrations

### 5.1 tofa (source of truth for plays)

The full reference is in `docs/tofa-api.md`. Key facts:

- Base path `/api/v1`. Auth via `Authorization: Bearer <token>`.
- Two ways to authenticate:
  - **API key** (server 0.9.34+): the user creates one in tofa under Server → Settings → API keys and pastes it in. Acts as that admin, works only on a direct connection to the server. Simplest path, and the right default for this app.
  - **Device flow** via `https://api.tofa.tv`: `GET /api/v1/auth/status` on the server for `server_id` and `connect_url`, `POST /device/code`, poll `POST /device/token` at the returned `interval`, then refresh with `POST /servers/{id}/device-token/refresh`. Refresh tokens rotate and reusing a retired one revokes the whole session family, so persist the new pair before discarding the old.
- Support both. Offer API key as the recommended option and device flow for non-admin users or remote deployments.
- **Feature-detect.** `GET /api/v1/system/info` reports `api_version` and `capabilities`. Check capabilities before using an endpoint; never gate on a version string. The API is in beta and additive changes land in any release.
- Remote reachability: `GET /servers/{id}/connection-info` on the cloud returns ordered `candidates` (`lan-direct`, `wan-direct`, `relay`) with `stagger_ms`. Race them in order, settle on the first that answers, skip unknown types. The relay path forwards the API only, and returns 503 `server_relay_not_connected` until the channel is up, which clears on its own — retry rather than failing.

**Endpoints this app uses:**

| Purpose | Endpoint |
|---|---|
| Server identity, pre-auth | `GET /api/v1/auth/status` |
| Capability detection | `GET /api/v1/system/info` |
| Liveness | `GET /api/v1/health` |
| Current user | `GET /api/v1/users/me` |
| **Primary ingest source** | `GET /api/v1/watch/history` |
| Server-wide history (admin, optional multi-user) | `GET /api/v1/system/watch-history` |
| Media detail (runtime, genres, ids) | `GET /api/v1/media/{id}` |
| Batch media hydration | `POST /api/v1/media/batch` |
| TMDB id lookup | `GET /api/v1/media/by-tmdb/{tmdb_id}`, `POST /api/v1/media/by-tmdb/batch` |
| Incremental change detection | `GET /api/v1/media/changes` |
| Artwork (with image token) | `GET /api/v1/auth/image-token`, `GET /api/v1/artwork/{media_id}/{kind}` |
| Live sessions (optional "now playing") | `GET /api/v1/system/playback/sessions` (admin) |

#### Phase 1 deliverable: `docs/DISCOVERY.md`

Before building the ingest pipeline, write a throwaway script that authenticates and dumps real (redacted) responses for at least: `/system/info`, `/users/me`, `/watch/history` (first page, and a page deep in the history), `/media/{id}` for one movie and one episode, and `/artwork/{id}/{kind}`. Record in `docs/DISCOVERY.md`:

1. **Pagination**: parameters, page size limits, ordering, whether a stable cursor exists.
2. **Filtering**: can history be filtered by date (`since`/`after`)? This determines whether incremental ingest is cheap or expensive.
3. **Per-event fields**: is there a stable id per history row? A `watched_at`? A duration or progress? A device or client name? Does it distinguish completed from partial?
4. **Media linkage**: does a history row carry the TMDB id directly, or only a tofa media id requiring a second call?
5. **Episode shape**: how are show, season, and episode expressed? Are show-level TMDB ids present?
6. **Rewatches**: does history contain one row per play, or one row per item with a play count?

Answer 3 and 6 before anything else. **If tofa exposes one row per play with a stable id, use that id as the dedupe key.** If it does not, fall back to a deterministic fingerprint: `sha256(tofa_media_id + ':' + watched_at_truncated_to_minute)`. Store the chosen strategy in a column so a future change doesn't corrupt existing rows.

Then update this section of `app-instructions.md` with what you found, and correct any assumption in this brief that turned out to be wrong.

### 5.2 Trakt (sync target)

`https://api.trakt.tv`. Every request carries:

```
Content-Type: application/json
trakt-api-version: 2
trakt-api-key: <client_id>
Authorization: Bearer <access_token>     (authenticated endpoints)
```

**Auth: device flow.** The user creates an app at trakt.tv/oauth/applications and pastes `client_id` and `client_secret` into Settings. Then `POST /oauth/device/code`, show the user code and verification URL, poll `POST /oauth/device/token` at the returned interval (polling faster returns `slow_down`), store the token pair, and refresh via `POST /oauth/token` with `grant_type=refresh_token` before expiry. Refresh proactively at 75% of lifetime, not on 401.

**Endpoints:**

| Purpose | Endpoint |
|---|---|
| Add plays | `POST /sync/history` |
| Read existing history (reconciliation) | `GET /sync/history/{type}?start_at=&end_at=&page=&limit=` |
| Remove a play (undo) | `POST /sync/history/remove` |
| Ratings | `GET /sync/ratings/{type}` |
| Watched summary | `GET /sync/watched/{type}` |
| Id resolution fallback | `GET /search/{id_type}/{id}?type=movie|episode` |
| Token check | `GET /users/settings` |

**Request body shape** for `POST /sync/history`:

```jsonc
{
  "movies":   [ { "ids": { "tmdb": 27205 }, "watched_at": "2026-09-04T02:31:00.000Z" } ],
  "episodes": [ { "ids": { "tmdb": 4170850 }, "watched_at": "2026-09-04T03:12:00.000Z" } ]
}
```

For episodes, prefer a direct episode-level `tmdb`/`tvdb`/`imdb` id when tofa provides one. When it doesn't, send the show plus explicit season and episode numbers rather than guessing an episode id:

```jsonc
{
  "shows": [{
    "ids": { "tmdb": 218589 },
    "seasons": [{ "number": 1, "episodes": [{ "number": 1, "watched_at": "..." }] }]
  }]
}
```

**Rate limits** (per user):

- `POST`/`PUT`/`DELETE`: **1 call per second**
- `GET`: 500 calls per 5 minutes

Implement a shared token-bucket limiter that all Trakt calls pass through, with separate buckets per verb class. On `429`, honor `Retry-After` and back off exponentially with jitter. Never parallelize Trakt writes.

**Batching.** `POST /sync/history` accepts arrays. Send up to 100 items per request rather than one item per request. A 4,000-item backfill is then ~40 requests over ~40 seconds, not 4,000 requests over an hour.

**Response handling.** The response reports `added`, `updated`, and `not_found` per type. Treat `not_found` entries as **unmatched**, not failed: they need an id fix, not a retry. Parse this carefully; it's how you learn which items in a batch actually landed.

**Account limits.** Free Trakt accounts have a history cap (on the order of 100k items) and other per-account limits. A very large backfill can hit it. Surface the error clearly rather than retrying into a wall.

**Trakt does not deduplicate for you.** Posting the same movie twice with different timestamps creates two plays. Duplicate prevention is entirely this app's responsibility. See §6.4.

### 5.3 TMDB (metadata, artwork, providers)

`https://api.themoviedb.org/3`. User supplies an API key or v4 read access token in Settings. Optional but strongly recommended: without it, genre and streaming-service breakdowns are unavailable, and the app must say so rather than showing empty charts.

| Purpose | Endpoint |
|---|---|
| Movie details (runtime, genres) | `/movie/{id}` |
| TV details | `/tv/{id}`, `/tv/{id}/season/{n}` |
| Genre lists | `/genre/movie/list`, `/genre/tv/list` |
| **Streaming providers** | `/movie/{id}/watch/providers`, `/tv/{id}/watch/providers` |
| Artwork base config | `/configuration` |

Cache aggressively; this data barely changes. Respect TMDB's attribution requirement: include "This product uses the TMDB API but is not endorsed or certified by TMDB" plus the logo in the About section of Settings.

**Prefer tofa artwork over TMDB artwork** where available. tofa serves it locally, which is faster and works offline.

---

## 6. The sync engine

This is the heart of the app. Build it first, build it carefully, and make it observable.

### 6.1 Pipeline

```
  tofa /watch/history
        │
        ▼
  ┌──────────┐   dedupe key   ┌────────────────┐
  │ INGEST   │───────────────▶│  watch_events  │
  └──────────┘                └────────────────┘
                                      │
                              eligibility rules
                                      ▼
                              ┌────────────────┐
                              │  sync_records  │  (pending)
                              └────────────────┘
                                      │
                            reconcile w/ Trakt history
                                      ▼
                              batch ≤100, ≤1 POST/sec
                                      ▼
                              POST /sync/history
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
                 synced           not_found          failure
                                 (unmatched)      (retry w/ backoff)
```

### 6.2 Ingestion

Runs on a schedule (default every 5 minutes, configurable 1–60).

1. Read the ingest watermark (`last_watched_at_seen`, plus a page cursor if the API supports one).
2. Page through `/api/v1/watch/history`, newest first, until reaching already-known events. Overlap by a safety margin (re-read the last 24 hours each run) because late-arriving or edited rows are common in media servers.
3. Compute the dedupe key per §5.1. `INSERT ... ON CONFLICT DO UPDATE` on that key so re-ingest is a no-op.
4. Hydrate unknown media items: batch-fetch from tofa, then enrich from TMDB (runtime, genres, providers) in a separate job so ingest never blocks on TMDB.
5. Create a `sync_record` in `pending` or `skipped` per §6.3.
6. Update the watermark only after the page is committed.

Full backfill uses the same code path with the watermark unset and a progress counter, so there is one ingestion implementation, not two.

### 6.3 Eligibility rules

An ingested watch event becomes `pending` only if all of these hold. Otherwise it gets a `skipped` record with a machine-readable reason that the UI renders as plain English.

| Rule | Default | Skip reason if failed |
|---|---|---|
| Completion threshold met | ≥ 90% movies, ≥ 85% episodes | `below_threshold` |
| Within sync mode window | mode-dependent (§6.6) | `before_cutoff` |
| Has a resolvable external id | TMDB or IMDb or TVDB | `unmatched` |
| Not manually ignored by user | — | `user_ignored` |
| Library not excluded in settings | all included | `library_excluded` |
| Not already present on Trakt | — | `already_on_trakt` |

Thresholds are configurable, and the UI must explain what changing them does. If tofa doesn't report a completion percentage, fall back to `duration_watched / runtime`, and if neither exists, treat any history row as a completed play and say so in the settings help text.

### 6.4 Duplicate prevention (read this twice)

Three layers, all required:

1. **Local ledger.** One `sync_record` per watch event with a unique constraint. An event that has a `synced` record is never sent again, period.
2. **Pre-flight reconciliation.** Before the first backfill, and again on demand, pull the user's existing Trakt history (`GET /sync/history/movies` and `/episodes`, paginated, using `start_at`/`end_at` to window it) into a local `trakt_history_snapshot` table. Match candidates against it on `(external_id, watched_at within ±N minutes)`, default N = 30. Matches get `already_on_trakt` and are marked synced without a write.
3. **Post-write confirmation.** Record the Trakt response per batch. Items reported `added` become `synced`; items in `not_found` become `unmatched`; anything unaccounted for stays `pending` for the next run rather than being optimistically marked done.

The reconciliation window matters because tofa and Trakt may disagree on whether a play is timestamped at start or completion. Make N configurable and default it generously.

### 6.5 Timestamp semantics

Trakt's `watched_at` is conventionally **when the play finished**. Decide explicitly and expose it:

- If tofa gives a completion time, use it.
- If tofa gives only a start time, use `start + min(duration_watched, runtime)`.
- If neither, use whatever timestamp the history row carries.

Always emit ISO 8601 UTC with milliseconds and a `Z` suffix. Add a Settings toggle "Timestamp plays at start / at completion" defaulting to completion, and record which convention produced each stored timestamp so a later change doesn't silently mix conventions.

Never send a future `watched_at`. Clamp to now and log a warning if clock skew produces one.

### 6.6 Sync modes

Set in Settings, changeable at any time:

- **Sync everything (backfill).** All history, past and future. On first activation, run reconciliation, then show a preview: total items, date range, estimated duration at 1 request/sec, count already on Trakt, count unmatched. Require explicit confirmation. Backfill runs as a resumable job with a progress bar, pausable and cancelable, oldest-first so a partial run leaves a contiguous history.
- **Sync newly watched only (forward-only).** Sets `cutoff = now` at activation. Events with `watched_at < cutoff` get `before_cutoff` and are visible in history with a "not synced" state and a per-item "sync anyway" action.
- **Manual only.** Nothing syncs automatically. Every pending item waits for a user action. Useful for auditing before trusting the app.

Switching from forward-only to backfill later must work cleanly: it clears `before_cutoff` skips and requeues them.

### 6.7 Retries and failure handling

- Retry on `429`, `5xx`, and network errors. Do not retry on `4xx` other than 429.
- Exponential backoff with full jitter: 30 s, 2 m, 8 m, 30 m, 2 h, capped at 6 h.
- After 6 attempts, move to `failed` with the last error preserved. Failed items appear in a "Needs attention" area with a manual retry.
- A `401` triggers one token refresh and one retry; if that fails, mark the connection as needing re-auth and surface a banner. Do not silently spin.
- Circuit breaker: after 5 consecutive failures against a provider, pause that job for 15 minutes and show the paused state in the UI.

### 6.8 Manual actions

Every watch event supports: **Sync now**, **Retry**, **Ignore** (never sync), **Unignore**, **Fix match** (enter a TMDB/IMDb id manually to resolve `unmatched`), and **Remove from Trakt** (calls `/sync/history/remove` and reverts the record to pending). Bulk versions of these operate on a filtered selection in the History view.

---

## 7. The interface

Five surfaces. Mobile-first responsive, with real desktop layouts rather than stretched mobile ones. WCAG 2.2 AA throughout: keyboard reachable, visible focus, 4.5:1 text contrast, semantic landmarks, no meaning conveyed by color alone (each sync state gets an icon and a label, not just a hue).

### 7.1 Home

The page that answers "is everything working, and what did I just watch?"

- **Status strip** at the top: connection health for tofa / Trakt / TMDB, count of pending items, count needing attention, time of last successful sync. This is the first thing the eye lands on.
- **Recently watched**: a feed of the most recent watch events, richest treatment for the newest few, poster-forward, each showing title, episode identity (`S02E07 · Episode Title`) where relevant, relative time ("2 hours ago") with the absolute time on hover, and a sync state badge.
- **Now playing** (optional, if the admin session endpoint is available): live playback with progress.
- **This month so far**: a compact preview of the current month's numbers linking through to the full review.
- **Needs attention**: only rendered when non-empty. Failed and unmatched items with one-tap actions.

Poll for updates at a sane interval (30–60 s) and update in place. Don't full-page-refresh under the user.

### 7.2 History

The complete ledger. Virtualized list grouped by day, with day headers showing that day's totals.

Filters: date range, movies/TV, sync state, library, genre, free-text search. Filters are URL state so views can be bookmarked and shared.

Each row: artwork thumb, title and episode identity, watched-at time, duration, sync badge, overflow menu with the §6.8 actions. Multi-select enables bulk actions with a confirmation showing the exact count.

### 7.3 Sync state design

Five states. Each needs a distinct color, a distinct icon, a label, and a one-sentence explanation on hover or tap. Do not ship a bare dot.

| State | Meaning | User action offered |
|---|---|---|
| **Synced** | On Trakt, with Trakt's play id recorded | View on Trakt, remove from Trakt |
| **Pending** | Queued, will sync on next run | Sync now |
| **Not synced** | Deliberately excluded (below threshold, before cutoff, ignored, library excluded) | Sync anyway |
| **Failed** | Attempted and errored, with the reason | Retry, view error |
| **Unmatched** | No usable external id; Trakt can't identify it | Fix match |

The distinction between "not synced" and "failed" is the one users care about most. "Not synced" means the app decided not to. "Failed" means the app tried and couldn't. Never merge them.

### 7.4 Monthly review

A month picker (with a compact year strip for jumping) over the following sections. Every number is computed in the user's timezone.

- **Headline**: total plays, total hours watched, movies vs episodes split, days with any activity, comparison against the previous month (delta and direction).
- **First play of the month**: date, time, title, artwork, with a small "how the month opened" treatment. This is a signature moment of the app; give it design weight.
- **Streaming service breakdown**: which services the month's viewing belongs to. See the caveat below.
- **Genre breakdown**: separate charts for movies and TV. Each genre shows play count and hours watched. Support toggling the metric between plays and hours.
- **Movies vs TV**: plays, hours, and average session length for each.
- **Ratings**: average rating of everything rated this month, distribution, and the list of rated items. Ratings come from Trakt (`/sync/ratings`) and/or tofa if it exposes them; label the source. If no rating source is connected, hide the section rather than showing zeros.
- **Top titles**: most-played show by episodes and hours, longest single day, longest binge run.
- **Calendar heatmap**: hours per day across the month.
- **Empty state**: a month with no plays gets a designed empty state, not a grid of zeros.

Everything is exportable as JSON and CSV.

#### The streaming service caveat (important)

TMDB's watch-providers endpoint tells you where a title is **available to stream today in a given region**. It does not know where the user actually watched it, and tofa plays local files. So this breakdown is an inference, and the app must be honest about it:

- Label the section "Where this is available" or "Service breakdown (estimated)", never "Where you watched it".
- **Snapshot providers at ingest time**, not at report time, and store the snapshot. Availability churns; a review of January 2025 rendered in 2027 should reflect what was true in January 2025, not today.
- Region comes from a Settings field, defaulting to the user's locale.
- Bucket flatrate (subscription) separately from rent and buy, and weight flatrate first when a title appears on multiple.
- Titles on no service get their own bucket: "Not currently streaming".
- Allow a per-title manual override, stored permanently, for the cases the user knows better.

#### Statistics definitions (implement exactly)

Ambiguity here produces numbers users can't trust. Pin these down and document them in an info popover on the review page.

- **Plays** = count of watch events in the period. Rewatches count separately. Partial plays below the threshold are excluded by default, with a Settings toggle to include them.
- **Hours watched** = `SUM(COALESCE(event.duration_watched_seconds, media.runtime_seconds))`. State which method each number used; if any event fell back to runtime, footnote the figure.
- **First play** = minimum `watched_at` within the period in the user's timezone.
- **Genre attribution**: a title contributes fully to each of its genres, so genre percentages sum above 100%. Say this in the tooltip. Do not fractionally split; it produces numbers nobody can reconcile against a play count.
- **Movies vs TV**: an episode is TV, a movie is a movie. Never merge a show's episodes into a single "play".
- **Period boundaries**: `[first day 00:00:00, last day 23:59:59.999]` in the user's timezone, converted to UTC for querying.

### 7.5 Year in review

Available for any completed year, and as a live preview of the current year.

Twelve-month totals and per-month sparklines, top genres, top services, top shows and movies, total hours expressed in something human ("the equivalent of 14 full days"), busiest month, busiest day, longest binge, first and last play of the year, new-vs-rewatch split, and a month-by-month scroll narrative.

Include an export: a single shareable image and a JSON dump. Build the shareable card server-side so it renders identically everywhere.

### 7.6 Settings

Four tabs.

**Connections**
- *tofa*: server URL with a "Test connection" button that calls `/auth/status` and reports server id and version. Auth method chooser (API key or device flow). Device flow shows the user code, the link, and a QR code, and polls at the returned interval. Show connection state, token expiry, and a re-auth button. Never display a stored secret after saving; show `••••••••` and a Replace action.
- *Trakt*: client id and secret fields with a link to trakt.tv/oauth/applications and a short explainer for why the user must create their own app. Device flow with user code and link. Show connected username and token expiry.
- *TMDB*: API key with a test button. Region selector for provider data. Clear explanation of what breaks without it.

**Sync**
- Mode: sync everything / newly watched only / manual (§6.6), with the backfill preview and confirmation flow.
- Completion thresholds for movies and episodes.
- Ingest and reconciliation schedules (off, or every N minutes). Ingest pulls tofa; reconciliation downloads Trakt history. Neither posts plays.
- Timestamp convention (start vs completion).
- Reconciliation window (±minutes).
- Library include/exclude list, fetched live from tofa.
- User selection when the server is multi-user and the token is an admin token.
- "Run sync now" and "Re-run reconciliation" buttons with live job status.

**Data**
- Statistics preferences: timezone, week start, whether partial plays count.
- Export history (JSON, CSV).
- Import from a previous export.
- Danger zone: clear sync records but keep history, clear all local data, forget a connection. Each requires typed confirmation and states precisely what it does and does not touch on Trakt.

**About**
- Version, build hash, uptime, database size, event counts.
- Diagnostics panel: last job runs with durations and outcomes, recent errors, rate-limit state, tofa `system/info` capabilities dump. Make this copy-pasteable for bug reports.
- TMDB and Trakt attribution.

---

## 8. Data model

Drizzle schema, SQLite. Indicative shape; adjust field names to whatever discovery (§5.1) reveals, but keep the table boundaries.

```ts
// connections — one row per provider
id, provider ('tofa'|'trakt'|'tmdb'), status, base_url, server_id,
auth_method, access_token_enc, refresh_token_enc, expires_at,
account_label, capabilities_json, last_verified_at, last_error

// media_items
id, kind ('movie'|'episode'), tofa_media_id (unique, nullable),
tmdb_id, imdb_id, tvdb_id, trakt_id,
title, sort_title, year, runtime_seconds,
show_tmdb_id, show_title, season_number, episode_number,
artwork_url, tofa_library_id, metadata_synced_at

// media_genres  (many-to-many)
media_item_id, genre_id
// genres: id, tmdb_id, name, kind

// watch_events  ← the atomic unit
id, dedupe_key (UNIQUE), dedupe_strategy,
media_item_id, tofa_history_id, tofa_user_id,
watched_at_utc, timestamp_convention,
duration_watched_seconds, completion_percent, is_complete,
device_name, ingested_at, raw_json

// sync_records
id, watch_event_id (UNIQUE), target ('trakt'),
status ('pending'|'syncing'|'synced'|'skipped'|'failed'|'unmatched'),
skip_reason, remote_id, attempts, last_attempt_at,
last_error_code, last_error_message, next_attempt_at, synced_at

// trakt_history_snapshot  (for reconciliation)
id, trakt_history_id, kind, tmdb_id, imdb_id, tvdb_id,
season_number, episode_number, watched_at_utc, action, fetched_at

// provider_snapshots  (streaming availability at ingest time)
id, media_item_id, region, provider_id, provider_name, logo_path,
monetization_type ('flatrate'|'rent'|'buy'|'ads'|'free'),
captured_at, is_manual_override

// ratings
id, media_item_id, source ('trakt'|'tofa'), rating, rated_at

// jobs / job_runs
id, type, status, scheduled_for, started_at, finished_at,
cursor_json, stats_json, error, items_processed, items_total

// settings — typed key/value singleton
key, value_json, updated_at

// audit_log
id, at, actor ('system'|'user'), action, subject_type, subject_id, detail_json
```

**Indexes that matter:** `watch_events(watched_at_utc)`, `watch_events(media_item_id)`, `sync_records(status, next_attempt_at)`, `trakt_history_snapshot(tmdb_id, watched_at_utc)`.

**Statistics queries** run against `watch_events` joined to `media_items` and `media_genres`. Compute on demand first; only add a materialized monthly rollup table if a realistic dataset (say 20,000 events) measurably lags. Measure before optimizing, and seed a large fixture dataset so you can measure.

---

## 9. Security

The app holds credentials that grant access to a media server and a Trakt account. Treat it accordingly.

- **App-level auth is required, not optional.** Ship a first-run setup that creates a single admin account with a password (Argon2id), session cookies that are `HttpOnly`, `Secure` when served over HTTPS, and `SameSite=Lax`. An unauthenticated app on a LAN is a credential leak waiting to happen. Support disabling auth only behind an explicit `AUTH_DISABLED=true` env var, with a persistent warning banner in the UI when set.
- **Encrypt secrets at rest.** AES-256-GCM with a key from `APP_ENCRYPTION_KEY`. If unset, generate one on first run, write it to `/data/.key` with mode 0600, and warn loudly that losing it means re-authenticating every connection.
- **Never send secrets to the client.** Not in props, not in RSC payloads, not in error messages. Add a test that asserts no rendered payload contains a stored token.
- **Redact in logs.** Enforce this in the logger itself, not by remembering at call sites.
- **Validate every third-party response** with Zod before it touches the database.
- **CSRF protection** on all mutations.
- **Rate-limit** the login endpoint.
- **SSRF guard** on the tofa base URL field: it's user-supplied and used server-side. Restrict schemes to http/https and block metadata endpoints.
- **Egress only to configured hosts.** No analytics, no telemetry, no phoning home. Self-hosted users care about this, and one outbound request to an unexpected domain destroys trust.

---

## 10. Docker

The primary distribution channel. Getting this right matters as much as the app.

**Image**
- Multi-stage build: `node:22-alpine` builder → minimal runtime.
- Next.js `output: 'standalone'`.
- Multi-arch via buildx: `linux/amd64` and `linux/arm64` (Raspberry Pi and Apple Silicon users are a large share of self-hosters).
- Runs as non-root (uid 1000), with optional `PUID`/`PGID` for NAS volume permissions.
- `HEALTHCHECK` hitting `/api/health`, which verifies the database opens and returns connection states.
- `tini` or equivalent as PID 1 so signals propagate and shutdown is graceful.
- Migrations run automatically at startup, before the server accepts traffic.
- Target under 300 MB. Publish to GHCR with `latest`, `x.y.z`, and `x.y` tags plus SBOM and provenance attestation.

**Volumes**
- `/data` — the SQLite database, the encryption key, cached artwork. The only volume needed.

**Environment**

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `9477` | HTTP port |
| `TZ` | `UTC` | Container timezone; app timezone is a separate setting |
| `APP_ENCRYPTION_KEY` | generated | Secret encryption key |
| `AUTH_DISABLED` | `false` | Disable app login (not recommended) |
| `LOG_LEVEL` | `info` | |
| `DATABASE_PATH` | `/data/watchlog.db` | |
| `BASE_URL` | — | Public URL, for correct links behind a reverse proxy |

Everything else is configured in the UI. Do not require a config file. Optionally accept `TOFA_URL`, `TOFA_API_KEY`, `TRAKT_CLIENT_ID`, `TRAKT_CLIENT_SECRET`, and `TMDB_API_KEY` as env seeds for people who prefer declarative deployment, treating UI values as authoritative once set.

**Ship a `docker-compose.yml`** that works with nothing but a volume mount, and document reverse-proxy setup for Traefik, Caddy, and nginx, including the `X-Forwarded-*` headers the app needs to build correct URLs.

**Reaching tofa from inside the container.** tofa's own documented compose file uses `network_mode: host` and listens on `33333`. A bridged Watchlog container therefore cannot reach it at `localhost:33333` — it needs the host's LAN IP, or `host.docker.internal` where that resolves. This is the single most likely first-run failure, so the tofa connection field should detect a loopback address, test it, and if the test fails say plainly that tofa usually needs the host's LAN address rather than returning a bare connection error.

---

## 11. Build order

Ship each phase working before starting the next. Do not build the UI against imaginary data.

| Phase | Deliverable | Done when |
|---|---|---|
| **0. Design** | `design/TOKENS.md`, Tailwind theme, base component primitives | A styleguide page renders every token and primitive and matches the reference images |
| **1. Discovery** | `docs/DISCOVERY.md`, corrected brief assumptions | Real tofa responses are documented and the dedupe strategy is chosen |
| **2. Foundation** | Next.js app, SQLite, Drizzle, migrations, app auth, Docker image | `docker compose up` reaches a login screen and `/api/health` is green |
| **3. Connections** | tofa API key + device flow, Trakt device flow, TMDB key, Settings → Connections | All three connect, tokens persist encrypted, refresh works, test buttons report accurately |
| **4. Ingestion** | Ingest job, media hydration, TMDB enrichment, History view | Watch events appear in History and re-running ingest creates zero duplicates |
| **5. Sync** | Eligibility, reconciliation, batching, rate limiting, retries, sync states | A backfill of real history lands on Trakt with correct timestamps and no duplicate plays |
| **6. Home** | Status strip, recent feed, needs-attention, now playing | Someone can tell at a glance whether the app is healthy |
| **7. Statistics** | Monthly review, all breakdowns, exports | Numbers reconcile against a hand-counted fixture month |
| **8. Year in review** | Yearly page, shareable export | |
| **9. Polish** | Empty states, error states, loading skeletons, a11y audit, mobile pass, PWA manifest and installability, docs, screenshots | The monthly review is comfortable to read on a phone, since that is where it will actually be read |

**Phase 5 is the whole app.** If ingestion and sync are correct and idempotent, everything else is presentation. Give it disproportionate time and test coverage.

---

## 12. Testing

- **Unit**: dedupe key generation, eligibility rules, timestamp conversion (including DST transitions and month boundaries across timezones), statistics aggregation, rate limiter.
- **Integration**: full ingest → sync pipeline against recorded fixtures for tofa, Trakt, and TMDB. Include a fixture for a Trakt response with a partial `not_found` list, a fixture for a 429 with `Retry-After`, and a fixture for a token expiry mid-batch.
- **Property test**: for any sequence of ingest and sync runs in any order with any interruptions, no watch event is ever sent to Trakt twice. This is the invariant the app lives or dies by.
- **E2E** (Playwright): first-run setup, connecting all three services with mocked flows, running a sync, viewing a monthly review, changing sync mode.
- **Accessibility**: axe checks in CI on every page, plus one manual keyboard-only pass per surface.
- **Timezone matrix**: run the statistics suite under at least `UTC`, `America/New_York`, `Asia/Kolkata` (half-hour offset), and `Pacific/Auckland` (southern DST).

---

## 13. Definition of done

- A user with a tofa server, a Trakt account, and Docker can go from zero to synced history in under ten minutes without reading source code.
- Re-running any job at any time changes nothing that shouldn't change.
- Every unsynced item in the UI explains itself in one sentence.
- Every number in the monthly review can be traced back to specific watch events.
- The app survives all three upstream services being down and recovers on its own when they return.
- No secret appears in any client payload, log line, or error message.
- The UI is recognizably the design in `design/`, not a generic dashboard.

---

## 14. Known unknowns

Track these in the repo and resolve them as you learn:

1. Exact shape and pagination of tofa's `/watch/history`, and whether rewatches are separate rows (§5.1).
2. Whether tofa exposes user ratings anywhere; if not, ratings statistics come from Trakt only.
3. Whether tofa's history distinguishes completed from partial plays, and with what field.
4. Whether episode-level TMDB ids are available from tofa, or only show-level ids plus season/episode numbers.
5. Whether `GET /api/v1/media/changes` is efficient enough to replace polling history.
6. Current Trakt free-account history limits, which have changed over time and should be checked at build time.
