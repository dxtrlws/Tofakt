# Definition of done

Checklist for `app-instructions.md` §13. This is a verification list against a running Watchlog, not a new feature set. Do not wipe `/data`, forget connections, change live sync mode, or POST to Trakt while checking the already-connected app.

Checked against the local app on 2026-09-08 unless a row says otherwise.

## Ten-minute first run

A person with tofa, a Trakt account, and Docker should reach synced history without reading source code.

- [x] `docker compose up` is the install path, with a single `/data` volume (`docs/DEPLOY.md`).
- [x] Reverse-proxy notes for Caddy, nginx, and Traefik, including `X-Forwarded-*` and `BASE_URL`.
- [x] First-run creates a local admin, then Settings → Connections for tofa, Trakt, and TMDB (`README.md`).
- [x] tofa loopback failure says to use the host LAN address, not a bare connection error.
- [ ] Clean-machine walkthrough, timed under ten minutes. Not re-run here: the live app already has data, and a fresh volume would be a wipe.

## Jobs are safe to repeat

- [x] Ingest → sync fixtures refuse a second POST for the same play (`lib/sync/pipeline.test.ts`, `lib/sync/never-twice.test.ts`).
- [ ] Re-click Run ingest and Run sync now on a copy of the live database and confirm the pending count and Trakt history stay still. Not done against the live Trakt account.

## Unsynced rows explain themselves

- [x] History badges carry a one-sentence reason (`components/history/sync-badge.tsx`).
- [x] Live History (`/history?state=all`) shows “ignored” and “older than Newly watched only” on rows that were not sent.

## Monthly numbers trace to plays

- [x] September 2026 review on the live app shows 16 plays, 13.6 hours, first play Reacher S04E06, last play Office Romance.
- [ ] Hand-count those 16 History rows against the review. The page is populated; the count was not audited by hand in this pass.

## Upstream outages

The app should stay up if tofa, Trakt, or TMDB is down, and pick up again when they return. Do not unplug the live services to prove this.

- [x] `/api/health` stays successful when the database opens. Connection fields report `ok`, `warn`, or `down`; a down upstream does not by itself fail the health check.
- [x] Connection tests store `lastError` and status `down` instead of crashing (`lib/connections/service.ts`).
- [x] Sync treats HTTP 429 as a later retry, and 401 as a refresh, without marking the play sent (`lib/sync/run.ts`).
- [x] Live Home showed tofa Connected, Trakt dxtrlws, TMDB Connected, Pending 0, Needs attention 0, last successful sync a few minutes earlier.
- [ ] Induce an outage (wrong URL or blocked host on a throwaway database) and confirm the UI names the failure, then recovers after the host returns.

## Secrets stay off the client

- [x] Public connection DTO test rejects stored token blobs (`lib/connections/public.test.ts`).
- [x] Live Settings screenshots were not taken, so connection keys are not in `docs/screenshots/`.

## The UI is the design

- [x] README screenshots: Home, History, monthly review (`docs/screenshots/`).
