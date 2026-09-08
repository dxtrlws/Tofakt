# Watchlog

Self-hosted companion that records plays from **tofa**, syncs them to **Trakt**, and builds monthly and yearly reviews.

![Home: recently watched and upcoming](docs/screenshots/home.png)

![History: each unsynced play explains itself](docs/screenshots/history.png)

![Monthly review](docs/screenshots/monthly.png)

## Run it

Docker is how you host Watchlog. It builds the production app and serves it on port 9477. This is not a development server.

```bash
docker compose up
```

Then open http://localhost:9477 and create the local admin. Connect tofa, Trakt, and TMDB under Settings.

The published image is `ghcr.io/dxtrlws/watchlog`. See `docs/DEPLOY.md` for pulling that image, the `/data` volume, and reverse proxies.

## Work on the source

`npm run dev` is only for editing the app. It runs Next.js in development, with hot reload. Do not use it as the way to host Watchlog.

```bash
cp .env.example .env
npm install
npm run dev
```

The build brief for agents is `app-instructions.md`.
