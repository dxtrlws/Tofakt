# tofa Media Server API

**Version documented:** v0.9.35 · **Status:** beta · **Scope:** the supported public subset

Reference for building third-party clients, add-ons, and scripts against a tofa media server. This file is the working reference for this project; the authoritative schemas live in the OpenAPI documents linked below.

| Resource | URL |
| --- | --- |
| Media server OpenAPI 3.1 | `https://docs.tofa.tv/api-spec.json` |
| Cloud sign-in OpenAPI 3.1 | `https://docs.tofa.tv/cloud-api-spec.json` |
| Cloud base URL | `https://api.tofa.tv` |
| Media server default port | `33333` |
| Per-server live reference | Server → Settings → API (generated from the running version, with copyable curl examples) |

---

## Contents

1. [Core concepts](#core-concepts)
2. [Authentication guide](#authentication-guide)
3. [API keys (admin shortcut)](#api-keys-admin-shortcut)
4. [Reaching a server from anywhere](#reaching-a-server-from-anywhere)
5. [Cloud endpoint reference](#cloud-endpoint-reference)
6. [Media server endpoint reference](#media-server-endpoint-reference)
7. [Client rules](#client-rules)
8. [Complete Python example](#complete-python-example)
9. [Notes for this project](#notes-for-this-project)

---

## Core concepts

### Authentication model

User endpoints take a bearer token:

```
Authorization: Bearer <JWT>
```

Streaming URLs — playlists, segments, subtitles, images — are fetched by media elements that cannot set headers. Those authenticate with a short-lived scoped session token passed in the `st` query parameter instead. Get those tokens from `GET /api/v1/auth/media-token` and `GET /api/v1/auth/image-token`. You generally do not build these URLs by hand: `GET /api/v1/stream/{id}/info` negotiates playback and returns ready-to-use URLs.

Your code never handles a tofa password. Sign-in happens on tofa's own site through the OAuth device flow; your application only ever holds tokens.

### Two token types

| | Cloud token | Media-server token |
| --- | --- | --- |
| Audience | The cloud API itself | One specific server |
| Lifetime | 15 minutes | 30 days |
| Obtained by | Device flow started **without** `server_id` | Device flow started **with** `server_id`, or exchange via `POST /servers/{id}/server-session` |
| Refreshed by | `POST /auth/token/refresh` | `POST /servers/{id}/device-token/refresh` |

**Account-first sign-in** is the path native clients use, and it minimizes cloud round-trips:

1. Run the device flow without a `server_id` → cloud token.
2. `GET /servers` → list the user's servers.
3. `POST /servers/{id}/server-session` for the chosen server → durable 30-day media-server token plus a 90-day server refresh token.
4. Talk to the server directly from then on.

A client signed in this way touches the cloud for auth roughly once a month rather than every 15 minutes.

### Authorization scopes

Most endpoints act on the signed-in user's own account and sessions. Endpoints marked **admin** act server-wide — all users' sessions, watch history, libraries, and accounts — and return `403` for non-admin tokens. There is no separate admin token type; sign in with an account holding the admin role on that server.

### Feature detection

tofa is in beta. Additive changes can land in any release and the served surface varies with server version. Call `GET /api/v1/system/info` and branch on the reported `api_version` and `capabilities` list rather than assuming a fixed surface or matching on version numbers.

---

## Authentication guide

### Step 1 — Find the server and its id

Every server answers one endpoint without authentication:

```bash
curl http://192.168.1.50:33333/api/v1/auth/status
```

```json
{
  "claimed": true,
  "server_id": "8b1f6a2e-4c3d-4f7a-9e0b-2d5c8a913f44",
  "connect_url": "https://api.tofa.tv"
}
```

Both fields matter: `server_id` scopes the token you are about to request, and `connect_url` is where sign-in happens.

Use whatever address reaches the server today — LAN IP and port, or a custom access URL. The API is identical on all of them.

### Step 2 — Request a device code

Pass the `server_id` from step 1 and a client name so the approval screen can say what is asking:

```bash
curl -X POST https://api.tofa.tv/device/code \
  -H "Content-Type: application/json" \
  -d '{"server_id": "8b1f6a2e-...", "client_name": "My watched-sync script", "client_type": "script"}'
```

```json
{
  "device_code": "kf93k...40 characters...",
  "user_code": "ABCD-EFGH",
  "verification_uri": "https://app.tofa.tv/link",
  "verification_uri_complete": "https://app.tofa.tv/link?code=ABCDEFGH",
  "expires_in": 600,
  "interval": 5
}
```

Show the user the `user_code` and the link. The response also carries `qr_code_svg` if a QR code suits the UI better. The code is valid for ten minutes.

### Step 3 — Poll for the token

Standard OAuth device flow, so the poll is a form post rather than JSON:

```bash
curl -X POST https://api.tofa.tv/device/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=urn:ietf:params:oauth:grant-type:device_code&device_code=kf93k..."
```

Until the user approves you get `authorization_pending`. Poll every `interval` seconds; polling faster returns `slow_down`. On approval:

```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "d41d8cd98f...",
  "token_type": "Bearer",
  "expires_in": 2592000
}
```

Store both tokens. The access token lasts 30 days.

### Step 4 — Call the server

```bash
curl http://192.168.1.50:33333/api/v1/users/me/continue \
  -H "Authorization: Bearer eyJhbGciOi..."
```

Every endpoint works this way, with the streaming/image URL exception described under [Authentication model](#authentication-model).

### Step 5 — Refresh before expiry

```bash
curl -X POST https://api.tofa.tv/servers/8b1f6a2e-.../device-token/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "d41d8cd98f..."}'
```

Refresh tokens rotate: each refresh returns a new pair and retires the old one. Reusing a retired token revokes the entire session family as a safety measure, so **persist the new pair before discarding the old one** — an interrupted write here logs the user out.

---

## API keys (admin shortcut)

Since server 0.9.34, a server admin can skip the device flow for scripts that only talk to their own server. Create a key under **Server → Settings → API keys**, with an optional expiry. It is shown once — copy it then. Send it exactly like a token:

```
Authorization: Bearer <key>
```

Constraints worth designing around:

- A key acts as the admin who created it. Treat it like that admin's password: secrets store or environment variable, never a repository. Revocation from the same settings page is immediate.
- Keys work **only on a direct connection to your own server** — on your network, or through your own domain or tunnel.
- Keys are **not** accepted by the accounts service or the remote access path it provides. A script that runs away from home, needs to discover servers, or acts on behalf of an ordinary member must use the device flow.

---

## Reaching a server from anywhere

When your code runs off the LAN, or the server sits behind a network you cannot open, ask the connect service how to reach it. Any account token works, owner or invited user:

```bash
curl https://api.tofa.tv/servers/8b1f6a2e-.../connection-info \
  -H "Authorization: Bearer eyJhbGciOi..."
```

```json
{
  "connection_type": "direct",
  "online": true,
  "connect_url": "https://8b1f6a2e....direct.tofa.tv:33333",
  "proxy_url": null,
  "proxy_available": false,
  "candidates": [
    { "type": "lan-direct", "url": "https://192-168-1-50.8b1f6a2e....lan.tofa.tv:33333", "stagger_ms": 0 },
    { "type": "wan-direct", "url": "https://8b1f6a2e....direct.tofa.tv:33333", "stagger_ms": 100 },
    { "type": "relay", "url": "https://api.tofa.tv/servers/8b1f6a2e-.../relay", "stagger_ms": 200, "available": true }
  ]
}
```

`candidates` is the list to use. Try them in order — the `stagger_ms` offsets are what tofa's own apps use to race them — and settle on the first that answers. Unknown types may appear in future releases, so skip entries you do not recognize rather than failing.

| Type | What it is |
| --- | --- |
| `lan-direct` | The server on its own network, under a hostname covered by tofa's wildcard certificate, so TLS validates normally. |
| `wan-direct` | A port-forwarded or tunneled path from the internet. Operator-configured custom access URLs appear as additional `wan-direct` entries. |
| `relay` | The same API proxied through tofa at `https://api.tofa.tv/servers/{id}/relay`. Append the normal API path: `.../relay/api/v1/users/me/continue`. |

Two things about the relay: it forwards the **API only**, so the server's web interface is not there and the root returns 404 — anything scraped from the server's front page will not be found on this route. And until the server's relay channel is up you get `503` with error `server_relay_not_connected`. That clears on its own, so retry rather than giving up.

`proxy_url` is the older, pre-`candidates` form of the relay entry and is non-null only when the server has no direct path at all. New code should read `candidates` and treat `proxy_url` as legacy.

---

## Cloud endpoint reference

Base URL `https://api.tofa.tv`. The cloud surface exists to sign a user in and keep the session fresh; everything else happens against the user's own media server.

### Device flow and sessions

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/device/code` | Start the device flow |
| `POST` | `/device/token` | Poll for the token grant |
| `GET` | `/servers` | List the caller's media servers |
| `POST` | `/servers/{id}/server-session` | Exchange a cloud session for a durable server-scoped token pair |
| `POST` | `/servers/{id}/device-token/refresh` | Refresh a media-server access token |
| `POST` | `/auth/token/refresh` | Refresh a cloud (non-scoped) access token |
| `GET` | `/servers/{id}/connection-info` | Get connection candidates for a server |

### Account deletion

| Method | Path | Purpose |
| --- | --- | --- |
| `DELETE` | `/v1/me` | Schedule deletion of the caller's account |
| `GET` | `/v1/me/deletion` | Return a pending deletion so signed-in devices can warn the owner and offer cancellation |
| `DELETE` | `/v1/me/deletion` | Cancel a pending deletion from a signed-in session |
| `POST` | `/auth/account-deletion/status` | Inspect a deletion request using the secret from the security email |
| `POST` | `/auth/account-deletion/cancel` | Cancel a deletion request from its security email |

---

## Media server endpoint reference

All paths below are relative to the server root, e.g. `http://192.168.1.50:33333/api/v1/...`.

### Auth

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/auth/status` | Get auth status — **unauthenticated**, returns `server_id` and `connect_url` |
| `POST` | `/api/v1/auth/session` | Create browser session |
| `POST` | `/api/v1/auth/session/refresh` | Refresh browser session |
| `POST` | `/api/v1/auth/session/logout` | Log out browser session |
| `GET` | `/api/v1/auth/api-keys` | List my API keys |
| `POST` | `/api/v1/auth/api-keys` | Create an API key |
| `DELETE` | `/api/v1/auth/api-keys/{id}` | Revoke an API key |
| `GET` | `/api/v1/auth/media-token` | Get media token (for `st` query parameter) |
| `GET` | `/api/v1/auth/image-token` | Get image token (for `st` query parameter) |
| `GET` | `/api/v1/auth/download-token/{media_file_id}` | Get download token |

### System and health

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Health check |
| `GET` | `/api/v1/system/info` | System info — `api_version` and `capabilities` |
| `GET` | `/api/v1/system/tasks` | List background tasks |
| `GET` | `/api/v1/system/playback/sessions` | List active playback sessions — **admin** |
| `DELETE` | `/api/v1/system/playback/sessions/{id}` | Stop a playback session — **admin** |

### Watch history

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/watch/history` | List my history |
| `DELETE` | `/api/v1/watch/history` | Delete all my history |
| `DELETE` | `/api/v1/watch/history/{id}` | Delete one history item |
| `POST` | `/api/v1/watch/status/reset` | Reset watch status |
| `GET` | `/api/v1/system/watch-history` | List server-wide watch history — **admin** |

### Users and watch state

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/users` | List users |
| `GET` | `/api/v1/users/list` | List users (profile switcher) |
| `GET` | `/api/v1/users/me` | Get current user |
| `PUT` | `/api/v1/users/me` | Update current user |
| `GET` | `/api/v1/users/me/profile` | Get my profile |
| `PUT` | `/api/v1/users/me/preferences` | Update my preferences |
| `PUT` | `/api/v1/users/me/avatar` | Update my avatar |
| `POST` | `/api/v1/users/me/avatar/image` | Update my avatar image |
| `GET` | `/api/v1/users/me/continue` | Get continue watching |
| `GET` | `/api/v1/users/me/suggested` | Get suggested |
| `GET` | `/api/v1/users/me/watchlist` | Get watchlist |
| `POST` | `/api/v1/users/me/watchlist/{media_id}` | Add to watchlist |
| `DELETE` | `/api/v1/users/me/watchlist/{media_id}` | Remove from watchlist |
| `POST` | `/api/v1/users/me/watchlist/content/{media_type}/{tmdb_id}` | Add to watchlist by TMDB id |
| `DELETE` | `/api/v1/users/me/watchlist/content/{media_type}/{tmdb_id}` | Remove from watchlist by TMDB id |
| `POST` | `/api/v1/users/me/dismiss/{media_id}` | Dismiss media |
| `DELETE` | `/api/v1/users/me/dismiss/{media_id}` | Undismiss media |
| `PUT` | `/api/v1/users/me/watch-history-sync` | Update watch history sync |
| `DELETE` | `/api/v1/users/me/cloud-watch-history` | Delete cloud watch history |
| `PUT` | `/api/v1/users/{id}/role` | Change a user's role — **admin** |
| `PUT` | `/api/v1/users/{id}/disabled` | Enable or disable a user — **admin** |
| `GET` | `/api/v1/media/{id}/progress` | Get progress |
| `PUT` | `/api/v1/media/{id}/progress` | Update progress |
| `POST` | `/api/v1/media/progress/batch` | Get media progress in batch |
| `PUT` | `/api/v1/media/{id}/watched` | Update watched |
| `PUT` | `/api/v1/seasons/{season_id}/watched` | Update season watched |

### Media

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/media` | Get media |
| `POST` | `/api/v1/media/batch` | Batch get media |
| `GET` | `/api/v1/media/{id}` | Get media detail |
| `GET` | `/api/v1/media/changes` | Get media changes |
| `GET` | `/api/v1/media/facets` | Get media facets |
| `GET` | `/api/v1/media/genres` | List genres |
| `POST` | `/api/v1/media/latest-episodes` | Latest episodes |
| `GET` | `/api/v1/media/by-tmdb/{tmdb_id}` | Look up media by TMDB id |
| `POST` | `/api/v1/media/by-tmdb/batch` | Look up media by TMDB ids (batch) |
| `GET` | `/api/v1/media/{id}/versions` | Get media versions |
| `GET` | `/api/v1/media/{id}/similar` | Get similar |
| `GET` | `/api/v1/artwork/{media_id}/{kind}` | Get artwork |
| `GET` | `/api/v1/media/{id}/artwork/reactions` | List artwork reactions |
| `POST` | `/api/v1/media/{id}/artwork/reactions` | Set artwork reaction |
| `POST` | `/api/v1/media/{id}/refresh` | Refresh item metadata |
| `GET` | `/api/v1/media/{id}/refresh-status` | Get metadata refresh status |
| `POST` | `/api/v1/media/{id}/match` | Set item match |
| `GET` | `/api/v1/media/{id}/match/search` | Search match candidates |
| `POST` | `/api/v1/media/{id}/rematch` | Re-run matching |
| `POST` | `/api/v1/media/{id}/unmatch` | Unmatch item |
| `POST` | `/api/v1/media/bulk-metadata` | Bulk edit media metadata |

#### Bulk actions

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/media/bulk-actions` | List bulk media action jobs |
| `POST` | `/api/v1/media/bulk-actions` | Run bulk media action |
| `POST` | `/api/v1/media/bulk-actions/preview` | Preview bulk media action |
| `GET` | `/api/v1/media/bulk-actions/{job_id}` | Get job |
| `DELETE` | `/api/v1/media/bulk-actions/{job_id}` | Cancel job |
| `POST` | `/api/v1/media/bulk-actions/{job_id}/confirm` | Confirm action |
| `POST` | `/api/v1/media/bulk-actions/{job_id}/retry` | Retry job |
| `POST` | `/api/v1/media/bulk-actions/{job_id}/abandon` | Abandon job |

### Search and discovery

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/search` | Search |
| `GET` | `/api/v1/discovery/board` | Get discovery board |
| `GET` | `/api/v1/discovery/page` | Get discovery page |
| `GET` | `/api/v1/discovery/radar` | Get discovery radar |
| `GET` | `/api/v1/discovery/genres` | Get discovery genres |
| `GET` | `/api/v1/discovery/lists` | Get discovery lists |
| `GET` | `/api/v1/discovery/list/{list_type}` | Get discovery list |
| `GET` | `/api/v1/discovery/shelf/{key}` | Get discovery shelf |
| `GET` | `/api/v1/discovery/detail/{media_type}/{tmdb_id}` | Get discovery detail |
| `GET` | `/api/v1/discovery/season/{tmdb_id}/{season_number}` | Get discovery season |
| `GET` | `/api/v1/discovery/person` | Get person filmography |

### Collections

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/collections` | Get collections |
| `GET` | `/api/v1/collections/{collection_id}` | Get collection |
| `GET` | `/api/v1/collections/custom` | List custom collections |
| `POST` | `/api/v1/collections/custom` | Create custom collection |
| `GET` | `/api/v1/collections/custom/{collection_id}` | Get custom collection |
| `DELETE` | `/api/v1/collections/{collection_id}/artwork/{kind}` | Delete collection artwork |

### Libraries

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/libraries/health` | Get library health overview |
| `POST` | `/api/v1/libraries/{id}/scan` | Start library scan |
| `POST` | `/api/v1/libraries/{id}/scan/scoped` | Start scoped library scan |
| `GET` | `/api/v1/libraries/{id}/scan/status` | Get library scan status |
| `POST` | `/api/v1/libraries/{id}/scan/cancel` | Cancel library scan |
| `POST` | `/api/v1/libraries/{id}/refresh-metadata` | Refresh library metadata |
| `GET` | `/api/v1/libraries/{id}/quickview/settings` | QuickView settings |

### Profiles

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/profiles` | List profiles |
| `POST` | `/api/v1/profiles` | Create profile |
| `PUT` | `/api/v1/profiles/{id}` | Update profile |
| `DELETE` | `/api/v1/profiles/{id}` | Delete profile |
| `POST` | `/api/v1/profiles/{id}/pin` | Set profile PIN |
| `DELETE` | `/api/v1/profiles/{id}/pin` | Remove profile PIN |
| `POST` | `/api/v1/profiles/{id}/verify-pin` | Verify profile PIN |
| `GET` | `/api/v1/profiles/avatars` | List preset avatars |
| `GET` | `/api/v1/profiles/avatars/{file}` | Get preset avatar |

### Streaming

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/stream/{id}/info` | Get playback info — negotiates playback, returns ready-to-use URLs |
| `GET` | `/api/v1/stream/{id}/direct` | Direct stream |
| `GET` | `/api/v1/stream/{id}/download` | Download media file |
| `GET` | `/api/v1/stream/{id}/subtitles` | List subtitles |
| `GET` | `/api/v1/stream/{id}/subtitles/{index}` | Get subtitle |
| `POST` | `/api/v1/stream/s/{session_id}/progress` | Report playback progress |
| `POST` | `/api/v1/stream/s/{session_id}/stopped` | Report playback stopped |
| `POST` | `/api/v1/stream/s/{session_id}/seek` | Seek playback stream |
| `POST` | `/api/v1/stream/s/{session_id}/audio` | Set playback audio track |
| `POST` | `/api/v1/stream/s/{session_id}/quality` | Change playback quality |
| `POST` | `/api/v1/stream/s/{session_id}/telemetry` | Report telemetry |
| `DELETE` | `/api/v1/stream/s/{session_id}` | End playback session |
| `GET` | `/api/v1/stream/s/{session_id}/{segment}` | Session segment |
| `GET` | `/api/v1/stream/s/{session_id}/fonts/{index}` | Session font file |

Session subtitle delivery: `/api/v1/stream/s/{session_id}/subtitles/{index}/` followed by `playlist.m3u8` (HLS), `segment.vtt`, `segment.sup`, or the full-track forms `full.vtt`, `full.ass`, `full.sup`, `full.idx`, `full.sub`.

### QuickView

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/media/{media_file_id}/quickview` | QuickView data |
| `GET` | `/api/v1/media/{media_file_id}/quickview/status` | QuickView status |
| `GET` | `/api/v1/media/{media_file_id}/quickview/segments` | QuickView segments |
| `GET` | `/api/v1/media/{media_file_id}/quickview/chapters/{chapter_index}` | QuickView chapter image |
| `GET` | `/api/v1/media/{media_file_id}/quickview/tiles/{width}/playlist.m3u8` | QuickView tiles playlist |
| `GET` | `/api/v1/media/{media_file_id}/quickview/tiles/{width}/{index}` | QuickView tile image |
| `GET` | `/api/v1/seasons/{season_id}/analysis/status` | Get season analysis status |

### Offline downloads

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/download/register` | Register download |
| `DELETE` | `/api/v1/download/{download_id}` | Unregister download |
| `GET` | `/api/v1/download/prepare/{request_id}` | Get download preparation status |
| `DELETE` | `/api/v1/download/prepare/{request_id}` | Cancel download preparation |
| `POST` | `/api/v1/playback/offlineProgress` | Report offline progress |

### Lifecycle

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/lifecycle/report` | Get lifecycle report |
| `POST` | `/api/v1/lifecycle/evaluate` | Evaluate lifecycle |
| `GET` | `/api/v1/lifecycle/leaving-soon` | List items leaving soon |
| `POST` | `/api/v1/lifecycle/remove` | Remove items |
| `PUT` | `/api/v1/lifecycle/keep/{media_id}` | Keep media |
| `DELETE` | `/api/v1/lifecycle/keep/{media_id}` | Unkeep media |
| `POST` | `/api/v1/lifecycle/candidates/{candidate_id}/postpone` | Postpone candidate |
| `DELETE` | `/api/v1/lifecycle/candidates/{candidate_id}/postpone` | Unpostpone candidate |
| `GET` | `/api/v1/lifecycle/rules` | List rules |
| `POST` | `/api/v1/lifecycle/rules` | Create rule |
| `PUT` | `/api/v1/lifecycle/rules/{rule_id}` | Update rule |
| `DELETE` | `/api/v1/lifecycle/rules/{rule_id}` | Delete rule |
| `POST` | `/api/v1/lifecycle/rules/{rule_id}/test` | Test rule |

---

## Client rules

- **One pairing per install.** Pair once, store the tokens, refresh. Do not run the device flow on every start.
- **Respect the poll interval** in step 3 — the endpoint enforces it and returns `slow_down` otherwise.
- **Feature-detect, don't version-match.** Read `api_version` and `capabilities` from `GET /api/v1/system/info` and check for the capability you need. Servers update on their own schedule.
- **Persist rotated refresh tokens before discarding the old pair.** Reuse of a retired token revokes the whole session family.
- **Pin expectations to the reference, not to observed behavior.** The API is in beta; additive changes land in any release.

---

## Complete Python example

Sign-in through first call, no dependencies:

```python
import json, time, urllib.request, urllib.parse

SERVER = "http://192.168.1.50:33333"

def post_json(url, data):
    req = urllib.request.Request(url, json.dumps(data).encode(),
                                 {"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req))

# 1. who is this server?
status = json.load(urllib.request.urlopen(f"{SERVER}/api/v1/auth/status"))
connect, server_id = status["connect_url"], status["server_id"]

# 2. request a device code
code = post_json(f"{connect}/device/code",
                 {"server_id": server_id, "client_name": "example script"})
print(f"Go to {code['verification_uri']} and enter {code['user_code']}")

# 3. poll until approved
while True:
    time.sleep(code["interval"])
    form = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
        "device_code": code["device_code"],
    }).encode()
    req = urllib.request.Request(f"{connect}/device/token", form,
        {"Content-Type": "application/x-www-form-urlencoded"})
    try:
        tokens = json.load(urllib.request.urlopen(req))
        break
    except urllib.error.HTTPError as e:
        if json.load(e).get("error") != "authorization_pending":
            raise

# 4. call the server
req = urllib.request.Request(f"{SERVER}/api/v1/users/me/continue",
    headers={"Authorization": f"Bearer {tokens['access_token']}"})
for item in json.load(urllib.request.urlopen(req)):
    print(item["title"], f"{item['progress_percent']}%")
```

---

## Notes for this project

Guidance for the Trakt sync app, not part of tofa's documentation.

**Endpoints this app depends on**

| Need | Endpoint |
| --- | --- |
| Watched events to sync | `GET /api/v1/watch/history` (per-user), `GET /api/v1/system/watch-history` (admin, all users) |
| Incremental polling | `GET /api/v1/media/changes` |
| Titles, genres, runtimes, TMDB ids | `GET /api/v1/media/{id}`, `POST /api/v1/media/batch` |
| Reverse lookup from a Trakt/TMDB id | `GET /api/v1/media/by-tmdb/{tmdb_id}`, `POST /api/v1/media/by-tmdb/batch` |
| Home page "recently watched" | `GET /api/v1/watch/history`, `GET /api/v1/users/me/continue` |
| Writing Trakt watched state back into tofa (optional, two-way) | `PUT /api/v1/media/{id}/watched`, `PUT /api/v1/seasons/{season_id}/watched` |
| Artwork | `GET /api/v1/artwork/{media_id}/{kind}` plus `GET /api/v1/auth/image-token` |
| Capability gating | `GET /api/v1/system/info` |

**Decisions to settle before writing the sync engine**

Settled against a live 0.9.36 server in `docs/DISCOVERY.md`. Remaining: Trakt account limits; whether `seconds_watched` is ever trustworthy; episode TVDB/IMDb ids.

- **Auth path.** An admin API key is the simplest option for a self-hosted, single-household deployment. It worked against a custom HTTPS access URL on this install. Device flow remains required for relay/non-admin. Supporting both is still the plan.
- **History:** one `PlaySessionListItem` per play, UUID `id` as dedupe key. Page with `limit` + exclusive `before` datetime. No `after`. TV `media_id` is the show; episode TMDB is nested `tmdb_episode_id`.
- **Pagination.** Full backfill walks `before=<oldest started_at>` until `has_more` is false. Go-forward re-reads newest pages with a 24h overlap. `media/changes` is a library revision log, not a play cursor.
- **Multi-user.** Per-token history by default. Admin `system/watch-history` adds `user_id` and device fields. One tofa user → one Trakt account unless settings later map several.
- **Beta churn.** Feature-detect via `capabilities`. Live spec: `GET /api/v1/openapi.json` (auth required).
