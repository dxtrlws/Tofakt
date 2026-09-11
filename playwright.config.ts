import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const dataDir = mkdtempSync(join(tmpdir(), "watchlog-e2e-"));
const mock = "http://127.0.0.1:8099";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8081",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "WATCHLOG_MOCK_LOG=1 node e2e/mock-upstreams.mjs",
      url: "http://127.0.0.1:8099/healthz",
      reuseExistingServer: false,
    },
    {
      command:
        "rm -rf .next/standalone/.next/static .next/standalone/public && cp -a .next/static .next/standalone/.next/static && mkdir -p .next/standalone/public && cp -a public/. .next/standalone/public/ && node .next/standalone/server.js",
      url: "http://127.0.0.1:8081/setup",
      timeout: 60_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        PORT: "8081",
        HOSTNAME: "127.0.0.1",
        DATABASE_PATH: join(dataDir, "watchlog.db"),
        TRAKT_API_URL: mock,
        TMDB_API_URL: mock,
        TOFA_URL: "",
        TOFA_API_KEY: "",
        TRAKT_CLIENT_ID: "",
        TRAKT_CLIENT_SECRET: "",
        TMDB_API_KEY: "",
        LOG_LEVEL: "error",
        APP_ENCRYPTION_KEY: "watchlog-e2e-encryption-key",
        WATCHLOG_DISABLE_SCHEDULER: "1",
        BASE_URL: "http://127.0.0.1:8081",
      },
    },
  ],
});
