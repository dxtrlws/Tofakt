# Watchlog

Self-hosted companion that records plays from **tofa**, syncs them to **Trakt**, and builds monthly and yearly reviews.

Image: `ghcr.io/dxtrlws/watchlog`

The package is private. Portainer and other hosts need a GitHub token with `read:packages` and `repo` before they can pull it. The same token can be passed into the container as `WATCHLOG_GITHUB_TOKEN` so Settings → About can see whether a newer GitHub release exists. Registry URL: `ghcr.io`. Username: the GitHub login that owns the package.

## Compose

```yaml
services:
  watchlog:
    image: ghcr.io/dxtrlws/watchlog:latest
    ports:
      - "9477:9477"
    environment:
      TZ: UTC
      DATABASE_PATH: /data/watchlog.db
      WATCHLOG_GITHUB_TOKEN: ${WATCHLOG_GITHUB_TOKEN:-}
    volumes:
      - watchlog-data:/data
    restart: unless-stopped

volumes:
  watchlog-data:
```

```bash
docker compose up -d
```

Then open http://localhost:9477 and create the local admin. Connect tofa, Trakt, and TMDB under Settings.

`/data` holds the SQLite database and encryption key. Set `BASE_URL` to the public origin when you put Watchlog behind a reverse proxy. Optional `PUID` and `PGID` (default `1000`) own that volume.

Source and reverse-proxy examples: [github.com/dxtrlws/Tofakt-](https://github.com/dxtrlws/Tofakt-/blob/main/docs/DEPLOY.md)
