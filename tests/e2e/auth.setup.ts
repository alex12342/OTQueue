import { test as setup, expect } from "@playwright/test";

// The default admin account is seeded by entrypoint.sh (default password
// Admin@123!). Override with E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD if the
// deployment uses a local admin with a different password.
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@otqueue.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Admin@123!";

setup("log in as admin and persist session", async ({ page, context }) => {
  await page.goto("/login");
  await page.getByLabel("Email Address").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);

  const responsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/auth/login") && res.request().method() === "POST"
  );
  await page.getByRole("button", { name: /sign in/i }).click();

  const response = await responsePromise;
  let body = "";
  try {
    body = await response.text();
  } catch {
    body = "(response body no longer available)";
  }
  expect(response.status(), `login failed: ${body}`).toBe(200);

  await page.waitForURL(/\/$/);
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem("otqueue_token")), { timeout: 5000 })
    .not.toBeNull();

  await context.storageState({ path: "tests/e2e/.auth/state.json" });
});
