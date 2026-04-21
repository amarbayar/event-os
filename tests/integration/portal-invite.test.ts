import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { testDb } from "../setup";
import * as schema from "@/db/schema";
import { createTestFixtures, type TestFixtures } from "../fixtures";

const mailMock = vi.fn();
const requirePermissionMock = vi.fn();

vi.mock("@/lib/mail", () => ({
  mail: (...args: unknown[]) => mailMock(...args),
}));

vi.mock("@/lib/rbac", () => ({
  requirePermission: (...args: unknown[]) => requirePermissionMock(...args),
  isRbacError: (value: unknown) => value instanceof Response,
}));

let f: TestFixtures;

function buildInviteRequest(body: Record<string, unknown>) {
  return new NextRequest("https://events.example.com/api/portal/invite", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function getSpeakerEmail(speakerId: string) {
  const speaker = await testDb.query.speakerApplications.findFirst({
    where: eq(schema.speakerApplications.id, speakerId),
    columns: { email: true },
  });
  return speaker?.email || "";
}

describe("portal invite route", () => {
  beforeAll(async () => {
    f = await createTestFixtures();
  });

  afterAll(async () => {
    await f.cleanup();
  });

  beforeEach(async () => {
    mailMock.mockReset().mockResolvedValue({ success: true, messageId: "mail-test-id" });
    requirePermissionMock.mockReset().mockResolvedValue({
      user: {
        id: f.users.TestAdmin.id,
        role: "admin",
        name: "Test Admin",
        email: "admin@test.local",
      },
      orgId: f.orgId,
      editionId: f.editionId,
      source: "api" as const,
    });
    process.env.NEXTAUTH_URL = "https://events.example.com";
    delete process.env.NEXT_PUBLIC_APP_URL;

    const speakerEmail = await getSpeakerEmail(f.speakerId);
    await testDb
      .delete(schema.userOrganizations)
      .where(
        and(
          eq(schema.userOrganizations.organizationId, f.orgId),
          eq(schema.userOrganizations.linkedEntityType, "speaker"),
          eq(schema.userOrganizations.linkedEntityId, f.speakerId)
        )
      );
    if (speakerEmail) {
      await testDb.delete(schema.users).where(eq(schema.users.email, speakerEmail));
    }
  });

  it("creates a stakeholder account with forcePasswordChange and an absolute portal sign-in URL", async () => {
    process.env.MAIL_DRIVER = "postmark";
    const { POST } = await import("@/app/api/portal/invite/route");

    const res = await POST(
      buildInviteRequest({
        entityType: "speaker",
        entityId: f.speakerId,
      })
    );

    expect(res.status).toBe(201);
    const payload = await res.json();
    expect(payload.data.portalUrl).toBe("https://events.example.com/login?callbackUrl=%2Fportal");
    expect(payload.data.tempPassword).toBeUndefined();

    const speakerEmail = await getSpeakerEmail(f.speakerId);
    const user = await testDb.query.users.findFirst({
      where: eq(schema.users.email, speakerEmail),
    });
    expect(user?.forcePasswordChange).toBe(true);

    const membership = await testDb.query.userOrganizations.findFirst({
      where: and(
        eq(schema.userOrganizations.userId, user!.id),
        eq(schema.userOrganizations.organizationId, f.orgId),
        eq(schema.userOrganizations.role, "stakeholder"),
        eq(schema.userOrganizations.linkedEntityType, "speaker"),
        eq(schema.userOrganizations.linkedEntityId, f.speakerId)
      ),
    });
    expect(membership).toBeDefined();
    expect(mailMock).toHaveBeenCalledTimes(1);
  });

  it("resends a fresh temporary password when the invited stakeholder still must change it", async () => {
    process.env.MAIL_DRIVER = "log";
    const { POST } = await import("@/app/api/portal/invite/route");

    const initial = await POST(
      buildInviteRequest({
        entityType: "speaker",
        entityId: f.speakerId,
      })
    );
    expect(initial.status).toBe(201);

    const resend = await POST(
      buildInviteRequest({
        entityType: "speaker",
        entityId: f.speakerId,
        resend: true,
      })
    );

    expect(resend.status).toBe(200);
    const payload = await resend.json();
    expect(payload.data.alreadyInvited).toBe(true);
    expect(payload.data.resent).toBe(true);
    expect(payload.data.portalUrl).toBe("https://events.example.com/login?callbackUrl=%2Fportal");
    expect(typeof payload.data.tempPassword).toBe("string");
    expect(payload.data.tempPassword.length).toBeGreaterThan(0);

    const secondCallOptions = mailMock.mock.calls[1]?.[2];
    expect(secondCallOptions?.disableDeduplication).toBe(true);
  });
});
