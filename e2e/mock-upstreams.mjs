#!/usr/bin/env node
/**
 * Local stand-in for tofa, Trakt, and TMDB. Used only by Playwright.
 * Never pointed at a real account. Listens on 127.0.0.1.
 */
import { appendFileSync } from "node:fs";
import http from "node:http";

const PORT = Number(process.env.WATCHLOG_MOCK_PORT ?? 8099);
const HOST = "127.0.0.1";

const watchedAt = new Date();
watchedAt.setUTCDate(4);
watchedAt.setUTCHours(2, 0, 0, 0);

const PLAY = {
  id: "e2e-play-1",
  media_id: "e2e-media-1",
  title: "Inception",
  media_type: "movie",
  progress_percent: 100,
  seconds_watched: 8880,
  started_at: new Date(watchedAt.getTime() - 8880 * 1000).toISOString(),
  ended_at: watchedAt.toISOString(),
  device_name: "E2E",
};

const MEDIA = {
  id: "e2e-media-1",
  library_id: "movies",
  media_type: "movie",
  title: "Inception",
  sort_title: "Inception",
  runtime_minutes: 148,
  tmdb_id: 27205,
  imdb_id: "tt1375666",
  year: 2010,
  genres: ["science-fiction", "action"],
};

const TRAKT_MOVIE = {
  id: 9001,
  watched_at: watchedAt.toISOString(),
  action: "watch",
  type: "movie",
  movie: {
    title: "Inception",
    year: 2010,
    runtime: 148,
    genres: ["science-fiction", "action"],
    ids: {
      trakt: 16662,
      tmdb: 27205,
      imdb: "tt1375666",
      slug: "inception-2010",
    },
  },
};

function send(res, status, body, extra = {}) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "x-pagination-page-count": "1",
    ...extra,
  });
  res.end(json);
}

function notFound(res) {
  send(res, 404, { error: "not found" });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
  const path = url.pathname;
  const method = req.method ?? "GET";
  if (process.env.WATCHLOG_MOCK_LOG === "1") {
    const line = `${method} ${path}\n`;
    process.stdout.write(line);
    try {
      appendFileSync("/tmp/watchlog-e2e-mock.log", line);
    } catch {
      // logging must not fail the mock
    }
  }

  if (path === "/healthz") {
    send(res, 200, { ok: true });
    return;
  }

  if (path === "/api/v1/auth/status") {
    send(res, 200, {
      claimed: true,
      connect_url: `http://${HOST}:${PORT}`,
      server_id: "e2e-server",
    });
    return;
  }
  if (path === "/api/v1/health") {
    send(res, 200, {
      status: "ok",
      version: "0.9.36",
      server_id: "e2e-server",
    });
    return;
  }
  if (path === "/api/v1/system/info") {
    send(res, 200, {
      version: "0.9.36",
      api_version: 49,
      capabilities: ["auth.api_keys"],
      server_id: "e2e-server",
      connection_type: "direct",
    });
    return;
  }
  if (path === "/api/v1/users/me") {
    send(res, 200, { id: "e2e-user", username: "e2eadmin", is_admin: true });
    return;
  }
  if (
    path === "/api/v1/watch/history" ||
    path === "/api/v1/system/watch-history"
  ) {
    send(res, 200, { items: [PLAY], has_more: false });
    return;
  }
  if (path === "/api/v1/media/batch" && method === "POST") {
    await readBody(req);
    send(res, 200, [MEDIA]);
    return;
  }
  if (path.startsWith("/api/v1/media/")) {
    send(res, 200, MEDIA);
    return;
  }

  if (path === "/oauth/device/code" && method === "POST") {
    send(res, 200, {
      device_code: "e2e-device",
      user_code: "E2E-OK",
      verification_url: `http://${HOST}:${PORT}/device`,
      expires_in: 600,
      interval: 1,
    });
    return;
  }
  if (path === "/oauth/device/token" && method === "POST") {
    send(res, 200, {
      access_token: "e2e-access",
      refresh_token: "e2e-refresh",
      expires_in: 7200,
      token_type: "Bearer",
    });
    return;
  }
  if (path === "/oauth/token" && method === "POST") {
    send(res, 200, {
      access_token: "e2e-access-2",
      refresh_token: "e2e-refresh-2",
      expires_in: 7200,
    });
    return;
  }
  if (path === "/users/settings") {
    send(res, 200, { user: { username: "e2euser", name: "E2E" } });
    return;
  }
  if (path === "/users/me/history") {
    send(res, 200, [TRAKT_MOVIE]);
    return;
  }
  if (path.startsWith("/sync/history/movies")) {
    send(res, 200, [TRAKT_MOVIE]);
    return;
  }
  if (path.startsWith("/sync/history/episodes")) {
    send(res, 200, []);
    return;
  }
  if (path === "/sync/history" && method === "POST") {
    await readBody(req);
    send(res, 200, {
      added: { movies: 1, episodes: 0 },
      not_found: { movies: [], episodes: [], shows: [] },
    });
    return;
  }
  if (path.startsWith("/calendars/my/shows")) {
    send(res, 200, []);
    return;
  }

  if (path === "/3/authentication") {
    send(res, 200, { success: true });
    return;
  }

  notFound(res);
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`watchlog mock upstreams on http://${HOST}:${PORT}\n`);
});
