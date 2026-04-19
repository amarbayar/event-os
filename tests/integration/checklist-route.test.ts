import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { testDb } from "../setup";
import * as schema from "@/db/schema";
import { createTestFixtures, type TestFixtures } from "../fixtures";

const requirePermissionMock = vi.fn();
const notifyMock = vi.fn();

vi.mock("@/lib/rbac", () => ({
  requirePermission: (...args: unknown[]) => requirePermissionMock(...args),
  isRbacError: (value: unknown) => value instanceof Response,
}));

vi.mock("@/lib/notify", () => ({
  notify: (...args: unknown[]) => notifyMock(...args),
}));

let f: TestFixtures;

function buildCtx(linkedEntityId: string) {
  return {
    user: {
      id: f.users.TestStakeholder.id,
      role: "stakeholder",
      name: "Test Stakeholder",
      email: "stakeholder@test.local",
      linkedEntityType: "speaker",
      linkedEntityId,
    },
    orgId: f.orgId,
    editionId: f.editionId,
    source: "web" as const,
  };
}

async function getHeadshotItemId() {
  const template = await testDb.query.checklistTemplates.findFirst({
    where: and(
      eq(schema.checklistTemplates.organizationId, f.orgId),
      eq(schema.checklistTemplates.entityType, "speaker"),
      eq(schema.checklistTemplates.fieldKey, "headshotUrl")
    ),
    columns: { id: true },
  });

  const item = await testDb.query.checklistItems.findFirst({
    where: and(
      eq(schema.checklistItems.entityId, f.speakerId),
      eq(schema.checklistItems.templateId, template!.id)
    ),
    columns: { id: true },
  });

  return item!.id;
}

function buildPatchRequest(id: string, body: Record<string, unknown>) {
  return {
    req: new NextRequest(`http://localhost/api/checklist-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    ctx: { params: Promise.resolve({ id }) },
  };
}

describe("checklist item route", () => {
  beforeAll(async () => {
    f = await createTestFixtures();
  });

  afterAll(async () => {
    await f.cleanup();
  });

  beforeEach(async () => {
    requirePermissionMock.mockReset();
    notifyMock.mockReset();

    await testDb
      .delete(schema.checklistItems)
      .where(
        and(
          eq(schema.checklistItems.entityType, "speaker"),
          eq(schema.checklistItems.entityId, f.speakerId)
        )
      );

    const { generateChecklistItems } = await import("@/lib/checklist");
    await generateChecklistItems("speaker", f.speakerId, f.editionId, f.orgId);
  });

  it("lets a stakeholder submit their own checklist item and syncs the field value to the speaker record", async () => {
    requirePermissionMock.mockResolvedValue(buildCtx(f.speakerId));
    const { PATCH } = await import("@/app/api/checklist-items/[id]/route");
    const itemId = await getHeadshotItemId();

    const { req, ctx } = buildPatchRequest(itemId, {
      status: "submitted",
      value: "https://example.com/headshot.jpg",
    });

    const res = await PATCH(req, ctx);
    expect(res.status).toBe(200);

    const item = await testDb.query.checklistItems.findFirst({
      where: eq(schema.checklistItems.id, itemId),
      columns: { status: true, value: true },
    });
    expect(item?.status).toBe("submitted");
    expect(item?.value).toBe("https://example.com/headshot.jpg");

    const speaker = await testDb.query.speakerApplications.findFirst({
      where: eq(schema.speakerApplications.id, f.speakerId),
      columns: { headshotUrl: true },
    });
    expect(speaker?.headshotUrl).toBe("https://example.com/headshot.jpg");
  });

  it("blocks stakeholders from approving checklist items", async () => {
    requirePermissionMock.mockResolvedValue(buildCtx(f.speakerId));
    const { PATCH } = await import("@/app/api/checklist-items/[id]/route");
    const itemId = await getHeadshotItemId();

    const { req, ctx } = buildPatchRequest(itemId, {
      status: "approved",
    });

    const res = await PATCH(req, ctx);
    expect(res.status).toBe(403);
  });

  it("blocks stakeholders from modifying checklist items that belong to another entity", async () => {
    requirePermissionMock.mockResolvedValue(buildCtx("another-speaker-id"));
    const { PATCH } = await import("@/app/api/checklist-items/[id]/route");
    const itemId = await getHeadshotItemId();

    const { req, ctx } = buildPatchRequest(itemId, {
      status: "submitted",
      value: "https://example.com/forbidden.jpg",
    });

    const res = await PATCH(req, ctx);
    expect(res.status).toBe(403);
  });
});
