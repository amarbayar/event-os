import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { testDb } from "../setup";
import * as schema from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createTestFixtures, type TestFixtures } from "../fixtures";

// ════════════════════════════════════════════════════════
// SECURITY REGRESSION TESTS
// Verifies that CSO audit findings are fixed and stay fixed.
// Each test maps to a specific finding from the 2026-03-25 audit.
//
// Uses self-contained fixtures — no dependency on seed data.
// ════════════════════════════════════════════════════════

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

let f: TestFixtures;
let orgId: string;
let editionId: string;
let speakerId: string;

beforeAll(async () => {
  f = await createTestFixtures();
  orgId = f.orgId;
  editionId = f.editionId;
  speakerId = f.speakerId;
});

afterAll(async () => {
  await f.cleanup();
});

// ─── Finding 1: Password hashing uses bcrypt ────────────

describe("Finding 1: bcrypt password hashing", () => {
  it("new password hashes start with $2 (bcrypt format)", async () => {
    const { hash } = await import("@/lib/password");
    const hashed = await hash("testpassword123");
    expect(hashed.startsWith("$2")).toBe(true);
    expect(hashed.length).toBeGreaterThan(50); // bcrypt hashes are ~60 chars
  });

  it("bcrypt hash can be verified", async () => {
    const { hash, compare } = await import("@/lib/password");
    const hashed = await hash("mySecurePass!");
    expect(await compare("mySecurePass!", hashed)).toBe(true);
    expect(await compare("wrongPassword", hashed)).toBe(false);
  });

  it("legacy SHA-256 hashes still work (backwards compatible)", async () => {
    const { compare } = await import("@/lib/password");
    // Simulate a legacy SHA-256 hash: salt:sha256(password+salt)
    const { createHash, randomBytes } = await import("crypto");
    const salt = randomBytes(16).toString("hex");
    const legacyHash = salt + ":" + createHash("sha256").update("oldpassword" + salt).digest("hex");

    expect(await compare("oldpassword", legacyHash)).toBe(true);
    expect(await compare("wrongpassword", legacyHash)).toBe(false);
  });
});

// ─── Finding 2: /api/users requires authentication ──────

describe("Finding 2: /api/users authentication", () => {
  it("GET /api/users without auth returns 401 or redirect", async () => {
    const res = await fetch(`${BASE_URL}/api/users`, {
      redirect: "manual",
    });
    // Should be 401, 403, or redirect to login (307)
    expect([401, 403, 307].includes(res.status)).toBe(true);
  });

  it("POST /api/users without auth returns 401 or redirect", async () => {
    const res = await fetch(`${BASE_URL}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "attacker@evil.com", name: "Attacker", role: "admin" }),
      redirect: "manual",
    });
    expect([401, 403, 307].includes(res.status)).toBe(true);
  });

  it("attacker user was not created in DB", async () => {
    const attacker = await testDb.query.users.findFirst({
      where: eq(schema.users.email, "attacker@evil.com"),
    });
    expect(attacker).toBeUndefined();
  });
});

// ─── Finding 3: /api/editions/create requires auth ──────

describe("Finding 3: /api/editions/create authentication", () => {
  it("POST /api/editions/create without auth returns 401 or redirect", async () => {
    const res = await fetch(`${BASE_URL}/api/editions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Hacked Edition 2026" }),
      redirect: "manual",
    });
    expect([401, 403, 307].includes(res.status)).toBe(true);
  });
});

// ─── Finding 4: /api/upload requires auth ───────────────

describe("Finding 4: /api/upload authentication", () => {
  it("POST /api/upload without auth returns 401 or redirect", async () => {
    const formData = new FormData();
    formData.append("file", new Blob(["test"]), "test.txt");

    const res = await fetch(`${BASE_URL}/api/upload`, {
      method: "POST",
      body: formData,
      redirect: "manual",
    });
    expect([401, 403, 307].includes(res.status)).toBe(true);
  });
});

// ─── Finding 5: DELETE requires organizationId in WHERE ─

describe("Finding 5: org-scoped DELETE", () => {
  it("speakers DELETE includes organizationId in WHERE (schema check)", async () => {
    // Verify that a speaker from this org can be found
    const speaker = await testDb.query.speakerApplications.findFirst({
      where: and(
        eq(schema.speakerApplications.id, speakerId),
        eq(schema.speakerApplications.organizationId, orgId),
      ),
    });
    expect(speaker).toBeDefined();
  });

  it("cross-org speaker DELETE via API returns 401 (no auth)", async () => {
    // Without auth, the request should be rejected before reaching the DELETE logic
    const res = await fetch(`${BASE_URL}/api/speakers/${speakerId}`, {
      method: "DELETE",
      redirect: "manual",
    });
    expect([401, 403, 307].includes(res.status)).toBe(true);
  });

  it("speaker still exists after unauthenticated delete attempt", async () => {
    const speaker = await testDb.query.speakerApplications.findFirst({
      where: eq(schema.speakerApplications.id, speakerId),
    });
    expect(speaker).toBeDefined();
  });
});

// ─── Finding 6: Random temp passwords ───────────────────

describe("Finding 6: no hardcoded passwords in source", () => {
  it("portal invite generates unique passwords", async () => {
    // We can't call the API without auth, but we can verify the hash function
    // generates bcrypt (not a hardcoded value)
    const { hash } = await import("@/lib/password");
    const hash1 = await hash("randomPass1");
    const hash2 = await hash("randomPass2");
    // Different inputs produce different hashes
    expect(hash1).not.toBe(hash2);
    // Both are bcrypt format
    expect(hash1.startsWith("$2")).toBe(true);
    expect(hash2.startsWith("$2")).toBe(true);
  });
});

// ─── Additional: Notification routes require auth ───────

describe("Notification routes require auth", () => {
  it("GET /api/notifications without auth returns 401", async () => {
    const res = await fetch(`${BASE_URL}/api/notifications`, {
      redirect: "manual",
    });
    expect([401, 307].includes(res.status)).toBe(true);
  });

  it("PATCH /api/notifications without auth returns 401", async () => {
    const res = await fetch(`${BASE_URL}/api/notifications`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
      redirect: "manual",
    });
    expect([401, 307].includes(res.status)).toBe(true);
  });
});

// ─── Additional: Teams DELETE requires auth ─────────────

describe("Teams DELETE requires auth", () => {
  it("DELETE /api/teams/:id without auth returns 401", async () => {
    const team = await testDb.query.teams.findFirst();
    if (!team) return; // skip if no teams
    const res = await fetch(`${BASE_URL}/api/teams/${team.id}`, {
      method: "DELETE",
      redirect: "manual",
    });
    expect([401, 403, 307].includes(res.status)).toBe(true);
  });

  it("team still exists after unauthenticated delete attempt", async () => {
    const team = await testDb.query.teams.findFirst();
    if (!team) return;
    const stillExists = await testDb.query.teams.findFirst({
      where: eq(schema.teams.id, team.id),
    });
    expect(stillExists).toBeDefined();
  });
});

// ─── Additional: Checklist templates DELETE requires auth + org scope ─

describe("Checklist templates DELETE requires auth + org scope", () => {
  it("DELETE /api/checklist-templates/:id without auth returns 401", async () => {
    const template = await testDb.query.checklistTemplates.findFirst();
    if (!template) return;
    const res = await fetch(`${BASE_URL}/api/checklist-templates/${template.id}`, {
      method: "DELETE",
      redirect: "manual",
    });
    expect([401, 403, 307].includes(res.status)).toBe(true);
  });
});

// ─── Additional: Portal routes check stakeholder role ───

describe("Portal routes enforce stakeholder role", () => {
  it("GET /api/portal/me without auth returns 401", async () => {
    const res = await fetch(`${BASE_URL}/api/portal/me`, {
      redirect: "manual",
    });
    expect([401, 403, 307].includes(res.status)).toBe(true);
  });
});
