import Database from "better-sqlite3";
import path from "path";
import { expect, test } from "@playwright/test";

const BASE_URL = "http://localhost:3100";
const SERVICE_TOKEN = "test-token";
const SQLITE_PATH = path.resolve(process.cwd(), "playwright-e2e.db");
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9p7Jf5QAAAAASUVORK5CYII=",
  "base64"
);

function getSeedSpeaker() {
  const db = new Database(SQLITE_PATH, { readonly: true });
  try {
    const row = db
      .prepare(
        `
          select
            o.id as orgId,
            s.id as speakerId,
            s.email as email,
            s.stage as stage
          from speaker_applications s
          join organizations o on o.id = s.organization_id
          order by s.created_at asc
          limit 1
        `
      )
      .get() as
      | {
          orgId: string;
          speakerId: string;
          email: string;
          stage: string | null;
        }
      | undefined;

    if (!row) {
      throw new Error("No seeded speaker available for portal e2e test");
    }

    return row;
  } finally {
    db.close();
  }
}

function getHeadshotData(speakerId: string) {
  const db = new Database(SQLITE_PATH, { readonly: true });
  try {
    return db
      .prepare(
        `
          select
            s.headshot_url as headshotUrl,
            c.value as checklistValue,
            c.status as checklistStatus
          from speaker_applications s
          left join checklist_items c
            on c.entity_id = s.id
          left join checklist_templates t
            on t.id = c.template_id
          where s.id = ?
            and t.field_key = 'headshotUrl'
          limit 1
        `
      )
      .get(speakerId) as
      | {
          headshotUrl: string | null;
          checklistValue: string | null;
          checklistStatus: string | null;
        }
      | undefined;
  } finally {
    db.close();
  }
}

function getUserAuthState(email: string) {
  const db = new Database(SQLITE_PATH, { readonly: true });
  try {
    return db
      .prepare(
        `
          select
            force_password_change as forcePasswordChange,
            password_hash as passwordHash
          from users
          where email = ?
          limit 1
        `
      )
      .get(email) as
      | {
          forcePasswordChange: number;
          passwordHash: string | null;
        }
      | undefined;
  } finally {
    db.close();
  }
}

async function apiCall(
  orgId: string,
  pathname: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
  } = {}
) {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${SERVICE_TOKEN}`,
      "x-organization-id": orgId,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const json = await res.json();
  return { status: res.status, json };
}

test("speaker portal invite flow forces password change and persists uploaded checklist data", async ({
  page,
}) => {
  const seed = getSeedSpeaker();

  if (seed.stage !== "confirmed") {
    const stageUpdate = await apiCall(seed.orgId, `/api/speakers/${seed.speakerId}`, {
      method: "PATCH",
      body: { stage: "confirmed" },
    });
    expect(stageUpdate.status).toBe(200);
  }

  const invite = await apiCall(seed.orgId, "/api/portal/invite", {
    method: "POST",
    body: { entityType: "speaker", entityId: seed.speakerId },
  });
  expect(invite.status).toBe(201);

  const tempPassword = invite.json.data.tempPassword as string;
  expect(tempPassword).toBeTruthy();

  await page.goto("/login?callbackUrl=%2Fportal");
  await page.getByRole("textbox", { name: /email/i }).fill(seed.email);
  await page.getByRole("textbox", { name: /password/i }).fill(tempPassword);
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/change-password/);
  await page.getByLabel(/current \(temporary\) password/i).fill(tempPassword);
  await page.getByLabel(/^New password$/i).fill("speaker1234");
  await page.getByLabel(/confirm new password/i).fill("speaker1234");
  await page.getByRole("button", { name: /change password/i }).click();

  await expect(page).toHaveURL(/\/login\?passwordChanged=1/);

  const authState = getUserAuthState(seed.email);
  expect(authState?.forcePasswordChange).toBe(0);
  expect(authState?.passwordHash).toBeTruthy();

  await page.getByRole("textbox", { name: /email/i }).fill(seed.email);
  await page.getByRole("textbox", { name: /password/i }).fill("speaker1234");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/portal/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();

  await page.locator('input[type="file"]').first().setInputFiles({
    name: "headshot.png",
    mimeType: "image/png",
    buffer: TINY_PNG,
  });
  await page.getByRole("button", { name: /^Submit$/ }).first().click();

  await expect(page.getByRole("link", { name: /\/uploads\// })).toBeVisible({
    timeout: 10_000,
  });

  const stored = getHeadshotData(seed.speakerId);
  expect(stored?.checklistStatus).toBe("submitted");
  expect(stored?.checklistValue).toMatch(/^\/uploads\/speaker\//);
  expect(stored?.headshotUrl).toBe(stored?.checklistValue);
});
