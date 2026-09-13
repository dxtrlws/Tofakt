# Deploying Watchlog

`docker compose up` is the supported install. The only volume is `/data` (SQLite, encryption key, later artwork).

The published image is `ghcr.io/dxtrlws/watchlog`. Compose still builds from this repo when you do not pull. To use the registry image instead:

```bash
docker compose pull
docker compose up -d --no-build
```

Version tags are `x.y.z` and `x.y`. `latest` tracks the newest version tag. Each publish includes an SBOM and provenance attestation.

Settings → About compares the running version to the latest GitHub release. The repo and GHCR package are private, so set `WATCHLOG_GITHUB_TOKEN` to a GitHub token that can read the repo (the same `read:packages` + `repo` token used to pull the image). Without it, About still lists the installed version and notes that the repo is private. The check runs only when someone opens About, then caches the GitHub response for several hours.

Set `BASE_URL` to the public origin when you put the app behind a reverse proxy so session cookies and links stay on the right host. Forward `X-Forwarded-Proto`, `X-Forwarded-Host`, and `X-Forwarded-For`.

Optional `PUID` / `PGID` (default `1000`) fix NAS volume ownership. The container starts as root only long enough to `chown /data`, then drops to that user.

## Caddy

```caddy
watchlog.example.com {
  reverse_proxy watchlog:9477
}
```

Caddy sets forwarded headers by default.

## nginx

```nginx
server {
  listen 443 ssl;
  server_name watchlog.example.com;

  location / {
    proxy_pass http://127.0.0.1:9477;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

## Traefik

Label the compose service:

```yaml
labels:
  - traefik.enable=true
  - traefik.http.routers.watchlog.rule=Host(`watchlog.example.com`)
  - traefik.http.routers.watchlog.entrypoints=websecure
  - traefik.http.routers.watchlog.tls=true
  - traefik.http.services.watchlog.loadbalancer.server.port=9477
```

Then set `BASE_URL=https://watchlog.example.com`.
