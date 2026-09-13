import { expect, test } from "@playwright/test";

test("first-run setup, mocked connections, sync, monthly, and mode", async ({
  page,
}) => {
  await test.step("create the local admin", async () => {
    await page.goto("/setup");
    await page.getByLabel("Username").fill("e2eadmin");
    await page.getByLabel("Password", { exact: true }).fill("e2e-pass-ok");
    await page.getByLabel("Confirm password").fill("e2e-pass-ok");
    await page.getByRole("button", { name: "Create admin" }).click();
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("banner").getByRole("link", { name: "Settings" }),
    ).toBeVisible();
  });

  await test.step("connect tofa, Trakt, and TMDB against mocks", async () => {
    await page.goto("/settings/connections");
    const tofa = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "tofa" }) });
    await tofa.getByLabel("tofa server URL").fill("http://127.0.0.1:8099");
    await tofa.getByRole("button", { name: "Save URL" }).click();
    await expect(tofa.getByLabel("tofa API key")).toBeVisible();
    await expect(tofa.getByLabel("tofa server URL")).toHaveValue(
      "http://127.0.0.1:8099",
    );

    if (await tofa.getByRole("button", { name: "Replace key" }).isVisible()) {
      await tofa.getByRole("button", { name: "Replace key" }).click();
    }
    await tofa.getByLabel("tofa API key").fill("e2e-tofa-key");
    await tofa.getByRole("button", { name: "Save key" }).click();
    await expect(tofa.getByText("Connected", { exact: false })).toBeVisible();

    const trakt = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Trakt" }) });
    await trakt.getByLabel("Trakt client ID").fill("e2e-client-id");
    await trakt.getByLabel("Trakt client secret").fill("e2e-client-secret");
    await trakt.getByRole("button", { name: "Save app" }).click();
    await expect(trakt.getByText("App saved", { exact: true })).toBeVisible();
    await trakt.getByRole("button", { name: "Connect account" }).click();
    await expect(trakt.getByText("Connected · e2euser")).toBeVisible();

    const tmdb = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "TMDB" }) });
    await tmdb.getByLabel("TMDB API key").fill("e2e-tmdb-key");
    await tmdb.getByRole("button", { name: "Save" }).click();
    await expect(tmdb.getByText("Connected")).toBeVisible();
  });

  await test.step("change sync mode then restore manual", async () => {
    await page.goto("/settings/sync");
    const notices = page.getByRole("region", { name: "Notifications" }).first();
    await page.getByRole("radio", { name: /^Newly watched only/ }).click();
    await expect(
      notices.getByText(/Only plays that finish after now will queue/),
    ).toBeVisible();
    await expect(notices).toHaveAttribute("data-hydrated", "true");
    await page
      .getByRole("banner")
      .getByRole("link", { name: "History" })
      .click();
    await expect(page).toHaveURL("/history");
    await expect(
      notices.getByText(/Only plays that finish after now will queue/),
    ).toBeVisible();
    await page.goto("/settings/sync");
    await page.getByRole("radio", { name: /^Manual/ }).click();
    await expect(notices.getByText(/Manual mode/)).toBeVisible();
  });

  await test.step("ingest, run sync, open monthly review", async () => {
    await page.goto("/history");
    await page
      .getByRole("button", { name: "Import from Tofa", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: /Importing from Tofa/ }),
    ).toBeVisible();
    await expect(page.getByText("Inception")).toBeVisible({ timeout: 30_000 });

    await page.goto("/settings/sync");
    await page.getByRole("button", { name: "Run sync now" }).click();
    await expect(page.getByRole("button", { name: /Working/ })).toBeVisible();
    const notices = page.getByRole("region", { name: "Notifications" }).first();
    await expect(notices.getByText(/Syncing plays|Synced /)).toBeVisible({
      timeout: 30_000,
    });
    // Stay on Settings until the job finishes so the busy→ok toast is not
    // stranded on an unmounted form (Home still works once sync has completed).
    await expect(notices.getByText(/Synced /)).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("banner").getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL("/");

    await page.goto("/monthly");
    await expect(
      page.getByRole("heading", { name: "Inception" }).first(),
    ).toBeVisible();
  });
});
