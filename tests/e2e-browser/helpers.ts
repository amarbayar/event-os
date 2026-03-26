import { expect, type Page } from "@playwright/test";

export async function login(
  page: Page,
  email = "admin@devsummit.mn",
  password = "admin123"
) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.getByRole("textbox", { name: /password/i }).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(
    page.getByRole("heading", { name: "Dashboard" })
  ).toBeVisible({ timeout: 10_000 });
}
