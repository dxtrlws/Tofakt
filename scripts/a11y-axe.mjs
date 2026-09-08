#!/usr/bin/env node
/**
 * WCAG 2.2 AA axe pass against a running Watchlog instance.
 *
 *   npm run a11y
 *
 * Defaults to http://localhost:9477. Sign in with WATCHLOG_A11Y_USER and
 * WATCHLOG_A11Y_PASSWORD, or reuse a session via WATCHLOG_A11Y_COOKIE.
 * Never logs those values.
 */

import { createRequire } from "node:module";
import process from "node:process";

const require = createRequire(import.meta.url);

function load(name) {
  try {
    return require(name);
  } catch {
    console.error(
      `Missing ${name}. Install it with: npm install -D axe-core puppeteer-core`,
    );
    process.exit(1);
  }
}

const axeSource = load("axe-core").source;
const puppeteer = load("puppeteer-core");

const BASE = (process.env.WATCHLOG_BASE_URL ?? "http://localhost:9477").replace(
  /\/$/,
  "",
);
const USER = process.env.WATCHLOG_A11Y_USER ?? "";
const PASSWORD = process.env.WATCHLOG_A11Y_PASSWORD ?? "";
const COOKIE = process.env.WATCHLOG_A11Y_COOKIE ?? "";
const CHROME =
  process.env.CHROME_PATH ??
  process.env.PUPPETEER_EXECUTABLE_PATH ??
  "/usr/bin/chromium";

const PATHS = [
  "/",
  "/history?state=all",
  "/monthly",
  "/year",
  "/settings/connections",
  "/settings/sync",
  "/settings/data",
  "/settings/about",
  "/settings/logs",
];

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function login(page) {
  if (COOKIE) {
    await page.setCookie({
      name: "watchlog_session",
      value: COOKIE,
      url: BASE,
    });
    return;
  }
  if (!USER || !PASSWORD) {
    throw new Error(
      "Set WATCHLOG_A11Y_USER and WATCHLOG_A11Y_PASSWORD, or WATCHLOG_A11Y_COOKIE.",
    );
  }
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
  if (!page.url().includes("/login") && !page.url().includes("/setup")) {
    return;
  }
  if (page.url().includes("/setup")) {
    throw new Error("Instance still needs first-run setup; axe login skipped.");
  }
  await page.type('input[name="username"]', USER);
  await page.type('input[name="password"]', PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle0" }),
    page.click('button[type="submit"]'),
  ]);
}

async function audit(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
  await page.waitForSelector("#main-content", { timeout: 15000 });
  await new Promise((resolve) => setTimeout(resolve, 800));
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async (tags) => {
    const result = await window.axe.run(document, {
      runOnly: { type: "tag", values: tags },
    });
    return {
      url: location.href,
      violations: result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.length,
      })),
    };
  }, TAGS);
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  const failures = [];
  try {
    await login(page);
    for (const path of PATHS) {
      const result = await audit(page, path);
      if (result.violations.length === 0) {
        console.log(`ok  ${path}`);
      } else {
        console.log(`FAIL ${path}`);
        for (const v of result.violations) {
          console.log(`  ${v.id} (${v.impact}) ×${v.nodes} — ${v.help}`);
        }
        failures.push(result);
      }
    }
  } finally {
    await browser.close();
  }
  if (failures.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
