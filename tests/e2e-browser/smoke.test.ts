import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Smoke tests", () => {
  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Event OS" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /password/i })).toBeVisible();
  });

  test("unauthenticated visit redirects to login", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/login**");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login with valid credentials", async ({ page }) => {
    await login(page);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("textbox", { name: /email/i }).fill("admin@devsummit.mn");
    await page.getByRole("textbox", { name: /password/i }).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByText("Invalid email or password")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("public agenda page loads without auth", async ({ page }) => {
    await page.goto("/agenda/dev-summit-2026");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /dev summit/i })).toBeVisible();
  });

  test("public CFP form loads without auth", async ({ page }) => {
    await page.goto("/apply/dev-summit-2026");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: /submit/i })).toBeVisible();
  });
});

test.describe("Authenticated dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("sidebar navigation is visible", async ({ page }) => {
    await expect(page.locator("aside")).toBeVisible();
  });

  test("speakers page loads with data", async ({ page }) => {
    await page.goto("/speakers");
    await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
  });

  test("can navigate to sponsors page", async ({ page }) => {
    await page.goto("/sponsors");
    await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
  });
});
