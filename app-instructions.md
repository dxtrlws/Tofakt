# Watchlog — Build Brief

A self-hosted web app that watches your **tofa** media server, records everything you play, syncs those plays to **Trakt** with accurate timestamps, and turns the accumulated history into monthly and yearly reviews.

This document is the single source of truth for an AI coding agent working on the app. Read it end to end before changing code. Agents should cite **`app-instructions.md`**, not `README.md`.

Package version: **0.3.1**. Image: `ghcr.io/dxtrlws/watchlog`.

---

## Changelog

### 0.3.1 — 2026-09-13

**Changed**

- Yearly Top 10 watched shows and movies use the same headline style as other year-in-review sections.

### 0.3.0 — 2026-09-13

**Added**

- History multi-select so several plays can be synced to Trakt at once.
- Settings → About compares the running version to the latest GitHub release (`WATCHLOG_GITHUB_TOKEN` for the private repo).
- `next dev` serves the LAN Network URL (`WATCHLOG_DEV_ORIGINS` / NIC addresses).

**Changed**

- Ingest and reconcile actions are **Import from Tofa** / **Import from Trakt**. Unused backfill and bulk undo paths were removed.

### As-built rewrite

**Added**

- As-built stack pins from `package.json` (Next.js 16.3.4, React 19.2.8, Zod 4, Biome, better-sqlite3).
- App auth tables (`users`, `sessions`) and `connections.extra_enc` / `extra_json`.
- Discovery-locked tofa ingest rules from [`docs/DISCOVERY.md`](docs/DISCOVERY.md) (dedupe, pagination, timestamps, episode TMDB).
- Settings → **Logs** tab; server-action mutation model; limited HTTP routes.
- Scheduler vs on-demand sync distinction; Trakt-primary monthly/year reviews.
- Explicit “not implemented” callouts for gaps that still appear in product copy.
- Live **`/styleguide`** route (token + primitive samples; linked from Settings → About).

**Modified**

- §0 repo map (source tree exists); §3 design marked complete with styleguide; §4 architecture diagram and stack.
- §5.1 tofa rewritten from live discovery; §6 eligibility/timestamps/sync modes aligned with code.
- §7 Home / History / Monthly / Settings rewritten to match routes and data sources; `/styleguide` listed.
- §8 schema aligned to [`lib/db/schema.ts`](lib/db/schema.ts); §9 security as implemented; §10 env vars.
- §11 converted from build-order phases to a status matrix; §12–§14 updated against CI and [`docs/DEFINITION-OF-DONE.md`](docs/DEFINITION-OF-DONE.md).

**Deleted**

- Greenfield “create the source tree” / Phase 0–1 kickoff as unfinished work.
- Assumed TanStack Query, Radix/Base UI, Recharts/Visx dependencies.
- Required automatic Trakt sync job and separate enrich / token-refresh scheduler jobs.
- Unresolved discovery TODOs that [`docs/DISCOVERY.md`](docs/DISCOVERY.md) already answered.
- Placeholder product rename note as an open Phase 2 task (name remains Watchlog in code and packaging).
- Open “whether `/styleguide` is desired” verification — route is shipped.

---

## 0. How to use this repository

```
/
├── app-instructions.md    ← this file (the build brief)
├── README.md              ← how to run Watchlog
├── app/                   ← Next.js App Router (pages, layouts, few route handlers)
├── components/            ← UI components
├── lib/                   ← domain logic (auth, connections, ingest, sync, stats, …)
├── drizzle/               ← SQL migrations + meta
├── design/
│   └── TOKENS.md          ← extracted design tokens (live samples at /styleguide)
├── docs/
│   ├── tofa-api.md        ← tofa public API reference
│   ├── DISCOVERY.md       ← resolved tofa response shapes (Phase 1 complete)
│   ├── DEPLOY.md          ← Docker / reverse-proxy
│   ├── DEFINITION-OF-DONE.md
│   └── screenshots/
├── e2e/                   ← Playwright
└── …
```

**Agent rules:**

1. **Do not invent API response shapes.** Prefer [`docs/DISCOVERY.md`](docs/DISCOVERY.md) and Zod schemas under `lib/tofa`, `lib/trakt`, and `lib/tmdb`. Where this brief still hedges, treat it as a hypothesis against the live server.
2. **Do not invent visual design.** Tokens live in [`design/TOKENS.md`](design/TOKENS.md) and are implemented as CSS custom properties in [`app/globals.css`](app/globals.css). Browse live samples at `/styleguide`. Reference Paper Design PNGs are not checked into git.
3. **Cite this file**, not `README.md`, when reasoning about product requirements.

---

## 1. What the app is

**Problem.** tofa records what you watch. Trakt is where your permanent, portable viewing history lives. Nothing connects the two, and manually marking things watched loses the timestamps that make history worth keeping.

**Solution.** An always-on companion service that:

- Polls tofa for new watch events
- Maps each play to a Trakt movie or episode
- Posts it to Trakt with the correct `watched_at` timestamp (on demand; see §6)
- Keeps a local ledger of what has and hasn't been synced, and why
- Surfaces statistics from Trakt history (with local artwork / provider overlays)

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
| **Watch event** | One play of one thing at one time, ingested from tofa. Rewatches are separate watch events. This is the atomic unit of the local ledger. |
| **Media item** | A movie or an episode, with its external IDs (TMDB/IMDb/TVDB), runtime, genres, artwork. Cached locally. |
| **Sync record** | The state of one watch event with respect to Trakt: pending, synced, failed, skipped, unmatched. |
| **Ingestion** | Pulling watch events from tofa into the local database. Independent of syncing. |
| **Sync** | Pushing a watch event to Trakt. Runs on demand (`Run sync now` / per-item Sync now), not on a background timer. |
| **Backfill** | A one-time sync of watch events that predate the app's installation (sync mode `backfill`, requires preview + confirm). |
| **Forward-only** | Sync mode where only events after the activation timestamp are eligible. |
| **Cutoff** | The activation timestamp used by forward-only mode. |
| **Qualifying play** | A watch event that met the completion threshold and is therefore eligible for sync. |
| **Reconciliation** | Comparing local watch events against Trakt's existing history to avoid creating duplicate plays. |

**Ingestion and sync are separate concerns.** Everything tofa reports gets ingested and shows in History. Only qualifying, eligible events get sync records in `pending` (or skipped). Keep these decoupled; conflating them is the most common way this kind of app goes wrong.

---

## 3. Design language

Phase 0 is **complete**. Tokens are documented in [`design/TOKENS.md`](design/TOKENS.md) and consumed via Tailwind v4 `@theme` in [`app/globals.css`](app/globals.css). Live samples: [`/styleguide`](app/styleguide/page.tsx) (session required; linked from Settings → About).

- **Mood:** nocturnal teal (deep water / mint phosphor), not purple Trakt branding.
- **Elevation:** border + tinted fill; not drop shadows.
- **Typography:** Inter (body) + Outfit (display/headline), loaded in [`app/layout.tsx`](app/layout.tsx).
- **Components:** custom layer only — no Radix / Base UI / chart library dependency.
- **Charts:** CSS / SVG bars themed with design tokens.
- **Styleguide page:** `/styleguide` — principles, color, type, radius, spacing, buttons, fields, sync badges, surfaces, empty state, motion, focus.

Every component should consume tokens. No hard-coded hex values in the component tree.

---

## 4. Architecture

### 4.1 Shape

A single Node process serving both the UI and the API, plus an in-process background scheduler, backed by an embedded database. One container. No external services required.

```
┌──────────────────────── Container ────────────────────────┐
│                                                            │
│   Next.js 16.3 (App Router, React 19.2)                    │
│   ├── UI (RSC + client islands)                            │
│   ├── Route handlers (health, artwork proxy, exports)      │
│   └── Server actions (mutations)                           │
│                                                            │
│   Scheduler (in-process, 15s tick)                         │
│   ├── ingest job     → tofa watch history (+ TMDB enrich)  │
│   └── reconcile job  → Trakt history snapshot (no status)  │
│   (no automatic sync job — pending waits for user action)  │
│                                                            │
│   SQLite (WAL) at /data/watchlog.db                        │
│   Encrypted secrets at rest                                │
└────────────────────────────────────────────────────────────┘
        │                    │                   │
     tofa API           Trakt API            TMDB API
   (LAN or relay)     api.trakt.tv       api.themoviedb.org
```

**All third-party calls happen server-side.** No API key, token, or secret ever reaches the browser. The client talks only to this app's own UI and a small set of first-party routes.

### 4.2 Stack

Pins from `package.json` (verify at upgrade time; the ecosystem moves).

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js **16.3.4** (App Router), React **19.2.8** | `output: 'standalone'` |
| Language | TypeScript, `strict: true` | |
| Styling | Tailwind CSS v4, CSS-first `@theme` | Tokens in `app/globals.css` |
| Components | Custom | No Radix / Base UI |
| Database | SQLite WAL via **better-sqlite3** | Path from `DATABASE_PATH` |
| ORM/migrations | Drizzle ORM **^0.44.7** + drizzle-kit | Migrations at startup via `instrumentation.ts` |
| Validation | Zod **^4.5.4** at env, forms, upstream responses | |
| Client refresh | `router.refresh()` poller (~45s on Home) | No TanStack Query |
| Charts | Custom CSS/SVG | No Recharts / Visx |
| Jobs | Own scheduler over SQLite `jobs` / `job_runs` | No Redis |
| Testing | Vitest (unit), Playwright (e2e), axe script | Fixtures under `lib/sync/fixtures/` |
| Lint/format | **Biome 2.4.2** | |
| Logging | Structured JSON (**pino**) with redaction | |

### 4.3 HTTP surface vs server actions

**Route handlers**

| Route | Auth | Role |
|---|---|---|
| `GET /api/health` | None (Docker HEALTHCHECK) | DB open + connection statuses |
| `GET /api/artwork/[mediaId]/[kind]` | Session | Proxied tofa artwork |
| `GET /monthly/export`, `GET /year/export`, `GET /settings/data/export` | Session | JSON / CSV / PNG exports |

**Mutations** are almost entirely `"use server"` actions under `lib/auth`, `lib/connections`, `lib/ingest`, `lib/sync`, and `lib/data`.

### 4.4 Non-negotiable engineering constraints

- **Idempotency everywhere.** Every ingest and every sync must be safe to run twice.
- **No destructive operation without preview.** Backfill, reset, and delete require dry-run / typed confirmation.
- **Timezone-correct.** Store timestamps in UTC. Compute user-facing day/month/year boundaries in the configured timezone.
- **Degrade, don't crash.** If TMDB is down, statistics still render without artwork and provider data. If Trakt is down, ingestion continues and the sync queue grows. If tofa is unreachable, the app still shows history.
- **Every failure is legible.** The user must always be able to answer "why is this item not on Trakt?" from the UI, without reading logs.

---

## 5. Integrations

### 5.1 tofa (source of truth for plays)

Full reference: [`docs/tofa-api.md`](docs/tofa-api.md). Live shapes: [`docs/DISCOVERY.md`](docs/DISCOVERY.md) (probed against tofa **0.9.36**, `api_version` **49**).

- Base path `/api/v1`. Auth via `Authorization: Bearer <token>`.
- Two auth methods (both shipped):
  - **API key** (server 0.9.34+): recommended default for direct connections.
  - **Device flow** via `https://api.tofa.tv`: status → device code → token → refresh (rotating refresh tokens).
- **Feature-detect** via `GET /api/v1/system/info` `capabilities[]`. Never gate solely on a version string.
- Remote reachability races `lan-direct` / `wan-direct` / `relay` candidates when using the cloud connection-info flow.

**Endpoints this app uses:**

| Purpose | Endpoint |
|---|---|
| Server identity, pre-auth | `GET /api/v1/auth/status` |
| Capability detection | `GET /api/v1/system/info` |
| Liveness | `GET /api/v1/health` |
| Current user | `GET /api/v1/users/me` |
| **Primary ingest source** | `GET /api/v1/watch/history` |
| Server-wide history (admin, optional) | `GET /api/v1/system/watch-history` |
| Media detail | `GET /api/v1/media/{id}` |
| Batch media hydration | `POST /api/v1/media/batch` |
| Libraries (include/exclude) | `GET /api/v1/libraries` |
| Artwork | `GET /api/v1/auth/image-token`, `GET /api/v1/artwork/{media_id}/{kind}` |
| OpenAPI (discovery aid) | `GET /api/v1/openapi.json` (authenticated) |

`GET /api/v1/media/changes` exists but is **library/metadata revisions only** — it does **not** replace watch-history polling.

`GET /api/v1/system/playback/sessions` (now playing) is **not implemented** in the UI.

#### Discovery locks (do not regress)

| Decision | Value |
|---|---|
| Pagination | Envelope `{ items, has_more }`. Params: `limit` (default 50; app uses **200**) + exclusive `before` ISO datetime. Newest `started_at` first. No `page` / `offset` / `cursor` / `after` / `since`. |
| Dedupe | One row per play; stable UUID `id`. `dedupe_key` = history `id`, strategy `tofa_history_id`. Fingerprint fallback exists in code but is unused while `id` is present. |
| Qualifying play | Prefer `progress_percent` vs thresholds; `end_reason` as extra signal. **Never** trust `seconds_watched` alone (often `0` on completed plays). |
| `watched_at` | Prefer `ended_at` when set; else `started_at`. Honor Settings timestamp convention (`completion` default / `start`). |
| Hours watched | `seconds_watched` if > 0, else `position_ms/1000`, else `duration_ms/1000`. |
| External ids | History rows have **no** TMDB/IMDb/TVDB. Hydrate `GET /media/{media_id}` (show/movie id — never `episode_id`, which 404s). Episode TMDB: nested `tmdb_episode_id`. |
| Rewatches | Separate rows with different `id`s. Do not collapse by media id. |
| Device name | Not on user history; only on admin `PlaySessionAdminItem`. |
| Artwork | Image token + query `st=` + **`Accept: image/*`** (otherwise **406**). Proxy; never send `st` to the browser. |
| User ratings | `GET /users/me/ratings` and `/watch/ratings` returned **404** on the probed server. Ratings UI is Trakt-oriented; the local `ratings` table currently has **no write path**. |

### 5.2 Trakt (sync target)

`https://api.trakt.tv` (override with `TRAKT_API_URL` for tests). Every request carries:

```
Content-Type: application/json
trakt-api-version: 2
trakt-api-key: <client_id>
Authorization: Bearer <access_token>     (authenticated endpoints)
```

**Auth: device flow.** User creates an app at trakt.tv/oauth/applications, pastes `client_id` / `client_secret`, then `POST /oauth/device/code` → poll `POST /oauth/device/token` → refresh via `POST /oauth/token`. Refresh proactively before expiry.

**Endpoints used in code:**

| Purpose | Endpoint |
|---|---|
| Add plays | `POST /sync/history` |
| Read history (reconcile + reviews + Home) | `GET /sync/history/{type}` |
| Remove a play | `POST /sync/history/remove` |
| Token / account check | `GET /users/settings` |
| Upcoming (Home) | `GET /calendars/my/shows/{start}/{days}` |

⚠️ `[NEEDS VERIFICATION]` — brief historically listed `GET /sync/ratings/{type}`, `GET /sync/watched/{type}`, and `GET /search/{id_type}/{id}`; those are **not** referenced under `lib/trakt` today. Ratings sections read the empty local `ratings` table.

**Request body shape** for `POST /sync/history`:

```jsonc
{
  "movies":   [ { "ids": { "tmdb": 27205 }, "watched_at": "2026-09-04T02:31:00.000Z" } ],
  "episodes": [ { "ids": { "tmdb": 4170850 }, "watched_at": "2026-09-04T03:12:00.000Z" } ]
}
```

Prefer episode-level `tmdb` when tofa provides `tmdb_episode_id`. Otherwise send show + season + episode numbers:

```jsonc
{
  "shows": [{
    "ids": { "tmdb": 218589 },
    "seasons": [{ "number": 1, "episodes": [{ "number": 1, "watched_at": "..." }] }]
  }]
}
```

**Rate limits** (per user): POST/PUT/DELETE ≈ **1 call per second**; GET higher. Shared limiter in `lib/trakt/rate-limit.ts`. On `429`, honor `Retry-After`. Never parallelize Trakt writes. Batch `POST /sync/history` up to **100** items.

**Response handling.** Parse `added` / `updated` / `not_found`. Treat `not_found` as **unmatched**, not failed.

**Trakt does not deduplicate for you.** Duplicate prevention is entirely this app's responsibility (§6.4).

⚠️ `[NEEDS VERIFICATION]` — current Trakt free-account history caps (order-of-magnitude ~100k historically); re-check at build/ops time.

### 5.3 TMDB (metadata, artwork, providers)

`https://api.themoviedb.org/3` (override with `TMDB_API_URL`). User supplies an API key in Settings. Optional but strongly recommended.

| Purpose | Endpoint used |
|---|---|
| Movie / TV details | `/movie/{id}`, `/tv/{id}` |
| Streaming providers | `/movie/{id}/watch/providers`, `/tv/{id}/watch/providers` |

Provider snapshots are captured **during ingest** into `provider_snapshots`. Prefer tofa artwork (proxied) over TMDB. Respect TMDB attribution in Settings → About.

⚠️ `[NEEDS VERIFICATION]` — `/configuration` and genre-list endpoints are not clearly called from `lib/tmdb` today; genres arrive primarily via tofa media hydration / local joins.

---

## 6. The sync engine

This is the heart of the app. Keep it observable and idempotent.

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
                              │  sync_records  │  (pending / skipped / …)
                              └────────────────┘
                                      │
                         (on demand: Run sync now / Sync now)
                            reconcile w/ Trakt snapshot
                                      ▼
                              batch ≤100, rate-limited POST
                                      ▼
                              POST /sync/history
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
                 synced           not_found          failure
                                 (unmatched)      (retry w/ backoff)
```

### 6.2 Ingestion

Scheduled when enabled (default **every 5 minutes**, range 1–60; `ingestEnabled` defaults true). Also triggerable from History / Settings.

1. Read ingest watermark (`last_started_at_seen` / related settings).
2. Page `/api/v1/watch/history` with `limit=200` and exclusive `before=<last.started_at>`, newest first, until known events / watermark − 24h overlap.
3. Dedupe on `tofa_history_id`. Upsert so re-ingest is a no-op for known ids.
4. Hydrate unknown media via tofa batch/detail; enrich TMDB watch-providers in the **same ingest pass** (no separate enrich job).
5. Create / update `sync_record` per eligibility (§6.3).
6. Advance watermark only after the page commits.

Full backfill of local history uses the same ingest path with an unset watermark.

### 6.3 Eligibility rules

An ingested watch event becomes `pending` only if all of these hold. Otherwise it gets a `skipped` record with a machine-readable reason.

| Rule | Default | Skip reason if failed |
|---|---|---|
| Completion threshold met | ≥ 90% movies, ≥ 85% episodes (`progress_percent`) | `below_threshold` |
| Within sync mode window | mode-dependent (§6.6) | `before_cutoff` |
| Has a resolvable external id | TMDB or IMDb or TVDB | `unmatched` |
| Not manually ignored by user | — | `user_ignored` |
| Library not excluded in settings | all included | `library_excluded` |
| Not already present on Trakt | — | `already_on_trakt` |

Thresholds are configurable. Duration fallbacks follow discovery rules when computing hours watched for stats.

### 6.4 Duplicate prevention

Three layers, all required:

1. **Local ledger.** One `sync_record` per watch event with a unique constraint. A `synced` event is never sent again.
2. **Pre-flight reconciliation.** Pull Trakt history into `trakt_history_snapshot` (scheduled when enabled, default off / every 60 minutes; also on demand). Match on `(external_id, watched_at within ±N minutes)`, default N = 30. Snapshot pulls alone do **not** change local sync status — matching pending/failed rows to `already_on_trakt` happens during user-initiated sync (`Run sync now` / Sync now).
3. **Post-write confirmation.** Items `added` → `synced`; `not_found` → `unmatched`; unaccounted stay `pending`.

### 6.5 Timestamp semantics

Trakt `watched_at` is conventionally when the play finished:

- Prefer tofa `ended_at` under the default **completion** convention.
- **Start** convention uses `started_at`.
- Always emit ISO 8601 UTC. Never send a future `watched_at` (clamp + warn).

### 6.6 Sync modes

Default mode: **`manual`**.

- **Manual only.** Nothing syncs automatically. Pending items wait for `Run sync now` or per-item Sync now.
- **Sync newly watched only (`forward`).** Sets `cutoff = now` at activation. Older events get `before_cutoff` with a path to sync anyway via Sync now.
- **Sync everything (`backfill`).** Requires reconciliation + preview (counts, date range, estimate) + explicit confirm. Resumable via the sync runner.

There is **no background job that POSTs plays**. The scheduler comment in [`lib/scheduler.ts`](lib/scheduler.ts) is authoritative: pending plays wait for user-initiated sync.

Switching from forward-only to backfill clears `before_cutoff` skips and requeues them (via reclassify).

### 6.7 Retries and failure handling

- Retry on `429`, `5xx`, and network errors (`status === 0`). Do not retry other `4xx`.
- Full-jitter backoff caps: 30s, 2m, 8m, 30m, 2h, 6h (`lib/sync/backoff.ts`). Max **6** attempts → `failed`.
- `401` → refresh + one retry; then mark connection needing re-auth.
- Circuit breaker: after consecutive provider failures, pause (~15 minutes) and surface paused state.

### 6.8 Manual actions

**Shipped** on History rows: **Sync now**, **Retry**, **Ignore**, **Unignore**, **Remove from Trakt**.

**Remove from Trakt.** If the play cannot be found on Trakt (no resolvable history id, or Trakt reports not found), clear the local `synced` status back to `pending` (or `skipped` / `before_cutoff` under forward mode) so the user can sync it again. Do not leave a stuck Synced row.

**Not implemented** (do not claim otherwise in UI without building them):

- **Fix match** — Home attention copy still says “Fix match”; there is no action to enter a TMDB/IMDb id.
- **Bulk** Sync / Ignore / Remove on a multi-select History selection.
- Per-title **provider manual override** UI (`provider_snapshots.is_manual_override` column exists unused by UI).

---

## 7. The interface

Mobile-first responsive, with real desktop layouts. WCAG 2.2 AA goals: keyboard reachable, visible focus, semantic landmarks, sync state = color + icon + label.

### App routes

| Path | Role |
|---|---|
| `/` | Home |
| `/login`, `/setup` | Auth |
| `/history` | Local ledger |
| `/monthly`, `/monthly/export` | Monthly review + export |
| `/year`, `/year/export` | Year in review + export (incl. PNG card) |
| `/settings` → `/settings/connections` | Connections |
| `/settings/sync` | Sync / ingest prefs |
| `/settings/data` | Prefs, import/export, danger zone |
| `/settings/logs` | Jobs + audit log |
| `/settings/about` | Version, diagnostics, attribution |
| `/styleguide` | Live design tokens + UI primitives (not in primary nav) |

Nav shell: Home, History, Monthly, Year, Settings. PWA manifest present.

### 7.1 Home

Answers “is everything working, and what did I just watch?”

- **Status strip:** tofa / Trakt / TMDB health, pending count, needs attention, last successful sync.
- **Pending** carousel from the **local** ledger.
- **Recently watched / upcoming / month preview:** primarily **Trakt-sourced** (history + show calendar), with local artwork overlays when available.
- **Needs attention:** failed / unmatched from the local ledger (links into History).
- **Now playing:** not shipped.

Poll ~45s via `HomePoller` → `router.refresh()` (Trakt calendar/history may stay on SQLite cache).

### 7.2 History

Complete **local** ledger. Grouped by day.

**Shipped filters:** kind (movies/TV), sync state, free-text search (URL state).

**Not shipped vs older brief:** date-range / library / genre filters; list virtualization; multi-select bulk actions.

Each row: artwork thumb, title / episode identity, watched-at, sync badge + reason, overflow menu (§6.8).

### 7.3 Sync state design

| State | Meaning | User action offered |
|---|---|---|
| **Synced** | On Trakt | Remove from Trakt |
| **Pending** | Queued for a sync run | Sync now |
| **Not synced** | Skipped (threshold, cutoff, ignored, library, already on Trakt) | Sync now / Unignore as applicable |
| **Failed** | Attempted and errored | Retry |
| **Unmatched** | No usable external id | *(Fix match not implemented)* |

Never merge “not synced” and “failed.”

### 7.4 Monthly review

Month picker over headline stats, first play, service breakdown (estimated availability — see caveat), genres, movies vs TV, ratings section, top titles, calendar heatmap, empty states, JSON/CSV export.

**Data source:** computed primarily from **live / cached Trakt history** (`lib/stats/month.ts`), joined to local `media_items` / `provider_snapshots` for artwork and service inference — **not** solely from local `watch_events`.

#### Streaming service caveat

TMDB providers are “where available today in a region,” not where the user watched. Label honestly (“Where this is available” / estimated). Snapshot at ingest time. Region from Settings. Flatrate weighted first. “Not currently streaming” bucket. Manual override UI not shipped.

#### Statistics definitions

- **Plays** = count of plays in the period (Trakt-sourced for the review pages).
- **Hours watched** = sum of available duration fields with documented fallbacks.
- **First play** = minimum `watched_at` in the user timezone.
- **Genre attribution:** a title contributes fully to each genre (percentages can exceed 100%).
- **Period boundaries:** `[first day 00:00:00, last day 23:59:59.999]` in the user timezone, converted to UTC for querying.

### 7.5 Year in review

Completed years + live current-year preview. Totals, sparklines, top lists, binge signals, shareable PNG (`next/og`) + JSON. Same Trakt-primary data approach as monthly.

### 7.6 Settings

**Five** tabs:

**Connections** — tofa (URL test, API key or device flow + QR), Trakt (client id/secret + device flow), TMDB (API key + region). Secrets never re-displayed after save.

**Sync** — mode (manual / forward / backfill + preview), thresholds, ingest schedule, reconcile schedule, timestamp convention, reconciliation window, library exclude list, Run sync now / Re-run reconciliation.

**Data** — timezone, week start, partial-play prefs; export/import; danger zone with typed confirmation.

**Logs** — job runs, audit log / diagnostics.

**About** — version / `WATCHLOG_BUILD`, GitHub update check, uptime, DB size, counts, rate-limit / circuit state, TMDB + Trakt attribution; link to `/styleguide`.

---

## 8. Data model

Drizzle schema in [`lib/db/schema.ts`](lib/db/schema.ts). SQLite.

```ts
// users / sessions — app auth
users: id, username, password_hash, created_at
sessions: id (sha256 of cookie token), user_id, expires_at, created_at

// connections — one row per provider (unique on provider)
id, provider ('tofa'|'trakt'|'tmdb'), status, base_url, server_id,
auth_method, access_token_enc, refresh_token_enc, extra_enc, extra_json,
expires_at, account_label, capabilities_json, last_verified_at, last_error

// media_items
id, kind ('movie'|'episode'), tofa_media_id (unique, nullable),
tmdb_id, imdb_id, tvdb_id, trakt_id,
title, sort_title, year, runtime_seconds,
show_tmdb_id, show_title, season_number, episode_number,
artwork_url, tofa_library_id, metadata_synced_at

// media_genres / genres
// watch_events — atomic unit; dedupe_key UNIQUE; default strategy tofa_history_id
// sync_records — watch_event_id UNIQUE; status pending|syncing|synced|skipped|failed|unmatched
// trakt_history_snapshot — reconciliation + review support
// provider_snapshots — streaming availability at ingest; is_manual_override unused by UI
// ratings — schema present; no insert path today → review ratings sections stay empty
// jobs / job_runs — scheduler observability
// settings — typed key/value JSON
// audit_log — system|user actions
```

**Indexes that matter:** `watch_events(watched_at_utc)`, `watch_events(media_item_id)`, `sync_records(status, next_attempt_at)`, `trakt_history_snapshot(tmdb_id, watched_at_utc)`.

Statistics for monthly/year pages query Trakt history (and snapshot cache) joined to local media/providers. History UI queries `watch_events`.

---

## 9. Security

The app holds credentials that grant access to a media server and a Trakt account.

- **App-level auth is required.** First-run `/setup` creates a single admin (Argon2id). Session cookie `watchlog_session`: raw token hashed SHA-256 in DB, 30-day TTL, `HttpOnly`, `SameSite=Lax`, `Secure` when HTTPS / `BASE_URL` implies HTTPS. Gate via per-page `requireUser()` / `getSessionUser()` — **no `middleware.ts`**.
- **`AUTH_DISABLED=true`** yields a synthetic user + persistent UI warning banner.
- **Encrypt secrets at rest.** AES-256-GCM with `APP_ENCRYPTION_KEY`, or generate to `/data/.key` mode 0600 on first run.
- **Never send secrets to the client.** Public connection DTOs strip tokens (`lib/connections/public.ts` + tests).
- **Redact in logs** via pino config.
- **Validate** third-party responses with Zod before DB writes.
- **CSRF:** same-origin / Host / `X-Forwarded-*` / `BASE_URL` checks on mutations — **no separate CSRF token cookie**.
- **Rate-limit login** in-process (IP + username buckets).
- **SSRF guard** on tofa base URL (`lib/net/ssrf.ts`); loopback Docker hint in the connection UI.
- **Egress only to configured hosts.** No analytics / telemetry / background phone-home. Settings → About may query GitHub for the latest release when opened (cached; optional `WATCHLOG_GITHUB_TOKEN` because the repo is private).
- **`GET /api/health`** is intentionally unauthenticated for container health checks.

---

## 10. Docker

Primary distribution channel.

**Image**

- Multi-stage: `node:22-alpine` → standalone runtime.
- Multi-arch publish via CI (`linux/amd64`, `linux/arm64` — see publish workflow).
- Non-root via entrypoint `PUID`/`PGID` (default 1000), `tini` as PID 1.
- `HEALTHCHECK` → `/api/health`.
- Migrations run at startup before traffic.
- Publish to GHCR: `ghcr.io/dxtrlws/watchlog` with version tags.

**Volumes:** `/data` — SQLite DB, encryption key, cached artwork.

**Environment**

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `9477` | HTTP port |
| `HOSTNAME` | `0.0.0.0` (image) | Bind address |
| `TZ` | `UTC` | Container TZ; app TZ is a Settings value |
| `APP_ENCRYPTION_KEY` | generated | Secret encryption key |
| `AUTH_DISABLED` | `false` | Disable app login |
| `LOG_LEVEL` | `info` | |
| `DATABASE_PATH` | `/data/watchlog.db` (image) / `./data/watchlog.db` (local) | |
| `BASE_URL` | — | Public URL behind reverse proxy |
| `TOFA_URL`, `TOFA_API_KEY` | — | Optional seeds (UI wins once set) |
| `TRAKT_CLIENT_ID`, `TRAKT_CLIENT_SECRET` | — | Optional seeds |
| `TRAKT_API_URL`, `TMDB_API_URL` | Trakt/TMDB defaults | Test / mock bases |
| `TMDB_API_KEY` | — | Optional seed |
| `WATCHLOG_BUILD` | `dev` / git SHA | About panel build id |
| `WATCHLOG_VERSION` | `package.json` / git tag | About panel version (baked into the image) |
| `WATCHLOG_GITHUB_TOKEN` | — | PAT with `repo` so About can see private GitHub releases |
| `WATCHLOG_GITHUB_REPO` | `dxtrlws/Tofakt-` | `owner/repo` for the update check |
| `WATCHLOG_GITHUB_API_URL` | `https://api.github.com` | Test / mock GitHub API base |
| `WATCHLOG_DISABLE_UPDATE_CHECK` | — | Set `1` to skip the About GitHub lookup |
| `WATCHLOG_DISABLE_SCHEDULER` | — | Set `1` to disable scheduler (e2e) |
| `WATCHLOG_DEV_ORIGINS` | NIC addresses | Extra hostnames for `next dev` `allowedDevOrigins` (tunnels); ignored in production |
| `PUID` / `PGID` | `1000` | Docker volume ownership |
| `NEXT_TELEMETRY_DISABLED` | `1` in image | |

Ship [`docker-compose.yml`](docker-compose.yml) with a single volume. Reverse-proxy notes (Caddy, nginx, Traefik + `X-Forwarded-*`) live in [`docs/DEPLOY.md`](docs/DEPLOY.md).

**Reaching tofa from inside the container.** Bridged containers cannot use `localhost:33333` for a host-network tofa. Prefer LAN IP or `host.docker.internal`. Connection UI detects loopback failure and says so plainly.

---

## 11. Status matrix

Former “build phases,” updated to shipped reality.

| Area | Status | Notes |
|---|---|---|
| Design tokens + CSS theme | **Shipped** | `/styleguide` + `design/TOKENS.md` |
| tofa discovery | **Shipped** | `docs/DISCOVERY.md` |
| Foundation (Next, SQLite, auth, Docker) | **Shipped** | |
| Connections (tofa / Trakt / TMDB) | **Shipped** | |
| Ingestion + History | **Shipped** | Enrich inside ingest |
| Sync (eligibility, reconcile, batch, backoff) | **Shipped** | On-demand only; default mode `manual` |
| Home | **Partial** | No now playing; Trakt-primary recent/upcoming |
| Monthly / Year reviews | **Partial** | Trakt-primary; ratings empty without writes; no provider override UI |
| Settings | **Shipped** | Five tabs including Logs |
| Fix match / bulk History actions | **Missing** | |
| Polish (PWA, screenshots, a11y script) | **Mostly shipped** | See §13 for live verification gaps |

---

## 12. Testing

**In CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)): Biome, Vitest, `next build`, Playwright e2e.

**Covered / present**

- Unit: dedupe, eligibility, timestamps, backoff, rate limiter, stats helpers, connection public DTO.
- Integration-style: ingest → sync pipeline fixtures, including partial `not_found` and `429` + `Retry-After`.
- Property-style: `never-twice` — a watch event must not be POSTed to Trakt twice.
- E2E: setup/login paths, settings interactions, core navigation (see `e2e/`).
- A11y: `npm run a11y` (axe via `scripts/a11y-axe.mjs`).

⚠️ `[NEEDS VERIFICATION]` — full timezone matrix (`UTC`, `America/New_York`, `Asia/Kolkata`, `Pacific/Auckland`) as a dedicated CI job; axe-on-every-page in CI.

---

## 13. Definition of done

Operational checklist lives in [`docs/DEFINITION-OF-DONE.md`](docs/DEFINITION-OF-DONE.md). Summary:

- Docker compose + first-run admin + Connections path documented and implemented.
- Re-running ingest/sync is idempotent in automated tests.
- Unsynced History rows explain themselves in one sentence.
- Monthly review populates from Trakt + local overlays.
- `/api/health` stays up when upstreams are down; connection errors are stored, not fatal.
- Secrets do not appear in public DTOs or client payloads (tested).
- UI matches nocturnal-teal tokens / screenshots in `docs/screenshots/`.

Still open on the live checklist (do not invent completion):

- ⚠️ `[NEEDS VERIFICATION]` Clean-machine timed walkthrough under ten minutes.
- ⚠️ `[NEEDS VERIFICATION]` Re-click ingest/sync against a copy of a live DB without changing Trakt.
- ⚠️ `[NEEDS VERIFICATION]` Hand-count of a live monthly review against History rows.
- ⚠️ `[NEEDS VERIFICATION]` Induced outage + recovery on a throwaway database.

---

## 14. Known unknowns / resolved

| Item | Status |
|---|---|
| tofa `/watch/history` pagination + rewatch rows | **Resolved** — `limit` + `before`; one row per play (`docs/DISCOVERY.md`) |
| tofa user ratings | **Resolved** — not exposed on probed endpoints; use Trakt / local table (empty today) |
| Completed vs partial | **Resolved** — `progress_percent`, `end_reason`; do not trust `seconds_watched` alone |
| Episode-level TMDB | **Resolved** — nested `tmdb_episode_id` on show media detail |
| `media/changes` vs history polling | **Resolved** — keep polling history |
| Trakt free-account history limits | ⚠️ `[NEEDS VERIFICATION]` — re-check when operating large backfills |
| Whether Fix match / bulk actions remain product requirements | ⚠️ `[NEEDS VERIFICATION]` — not implemented; attention copy still mentions Fix match |
| Styleguide route | **Resolved** — `/styleguide` (auth required; linked from About) |
