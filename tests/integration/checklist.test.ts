import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { testDb } from "../setup";
import * as schema from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createTestFixtures, type TestFixtures } from "../fixtures";

// ════════════════════════════════════════════════════════
// CHECKLIST TESTS
// Tests the post-confirmation checklist system:
//   Templates → auto-generate items on confirm → progress tracking
//
// Uses self-contained fixtures — no dependency on seed data.
// ════════════════════════════════════════════════════════

let f: TestFixtures;

beforeAll(async () => {
  f = await createTestFixtures();
});

afterAll(async () => {
  await f.cleanup();
});

// ─── Checklist Templates ────────────────────────────────

describe("Checklist templates", () => {
  it("has speaker templates", async () => {
    const templates = await testDb.query.checklistTemplates.findMany({
      where: and(
        eq(schema.checklistTemplates.editionId, f.editionId),
        eq(schema.checklistTemplates.entityType, "speaker")
      ),
    });
    expect(templates.length).toBeGreaterThan(0);
  });

  it("has sponsor templates", async () => {
    const templates = await testDb.query.checklistTemplates.findMany({
      where: and(
        eq(schema.checklistTemplates.editionId, f.editionId),
        eq(schema.checklistTemplates.entityType, "sponsor")
      ),
    });
    expect(templates.length).toBeGreaterThan(0);
  });

  it("has venue templates", async () => {
    const templates = await testDb.query.checklistTemplates.findMany({
      where: and(
        eq(schema.checklistTemplates.editionId, f.editionId),
        eq(schema.checklistTemplates.entityType, "venue")
      ),
    });
    expect(templates.length).toBeGreaterThan(0);
  });

  it("has booth templates", async () => {
    const templates = await testDb.query.checklistTemplates.findMany({
      where: and(
        eq(schema.checklistTemplates.editionId, f.editionId),
        eq(schema.checklistTemplates.entityType, "booth")
      ),
    });
    expect(templates.length).toBeGreaterThan(0);
  });

  it("has volunteer templates", async () => {
    const templates = await testDb.query.checklistTemplates.findMany({
      where: and(
        eq(schema.checklistTemplates.editionId, f.editionId),
        eq(schema.checklistTemplates.entityType, "volunteer")
      ),
    });
    expect(templates.length).toBeGreaterThan(0);
  });

  it("has media templates", async () => {
    const templates = await testDb.query.checklistTemplates.findMany({
      where: and(
        eq(schema.checklistTemplates.editionId, f.editionId),
        eq(schema.checklistTemplates.entityType, "media")
      ),
    });
    expect(templates.length).toBeGreaterThan(0);
  });

  it("templates have correct fields", async () => {
    const template = await testDb.query.checklistTemplates.findFirst({
      where: and(
        eq(schema.checklistTemplates.editionId, f.editionId),
        eq(schema.checklistTemplates.entityType, "speaker"),
        eq(schema.checklistTemplates.sortOrder, 0)
      ),
    });
    expect(template).toBeDefined();
    expect(template!.name).toBe("Upload headshot photo");
    expect(template!.itemType).toBe("file_upload");
    expect(template!.fieldKey).toBe("headshotUrl");
    expect(template!.required).toBe(true);
    expect(template!.dueOffsetDays).toBe(-21);
  });

  it("total templates across all entity types", async () => {
    const all = await testDb.query.checklistTemplates.findMany({
      where: eq(schema.checklistTemplates.editionId, f.editionId),
    });
    expect(all.length).toBe(f.templateCount);
    const entityTypes = new Set(all.map((t: { entityType: string }) => t.entityType));
    expect(entityTypes.size).toBeGreaterThanOrEqual(3);
  });
});

// ─── Checklist Item Generation ──────────────────────────

describe("Checklist item generation", () => {
  it("generates items when generateChecklistItems is called", async () => {
    const { generateChecklistItems } = await import("@/lib/checklist");

    // Clean up any existing items for this speaker
    await testDb.delete(schema.checklistItems).where(
      and(
        eq(schema.checklistItems.entityType, "speaker"),
        eq(schema.checklistItems.entityId, f.speakerId)
      )
    );

    const speakerTemplates = await testDb.query.checklistTemplates.findMany({
      where: and(
        eq(schema.checklistTemplates.editionId, f.editionId),
        eq(schema.checklistTemplates.entityType, "speaker")
      ),
    });

    const count = await generateChecklistItems("speaker", f.speakerId, f.editionId, f.orgId);
    expect(count).toBe(speakerTemplates.length);

    const items = await testDb.query.checklistItems.findMany({
      where: and(
        eq(schema.checklistItems.entityType, "speaker"),
        eq(schema.checklistItems.entityId, f.speakerId)
      ),
    });
    expect(items.length).toBe(speakerTemplates.length);
    expect(items.every((i: { status: string }) => i.status === "pending")).toBe(true);
  });

  it("skips generation if items already exist (no duplicates)", async () => {
    const { generateChecklistItems } = await import("@/lib/checklist");

    const before = await testDb.query.checklistItems.findMany({
      where: and(
        eq(schema.checklistItems.entityType, "speaker"),
        eq(schema.checklistItems.entityId, f.speakerId)
      ),
    });

    const count = await generateChecklistItems("speaker", f.speakerId, f.editionId, f.orgId);
    expect(count).toBe(0);

    const after = await testDb.query.checklistItems.findMany({
      where: and(
        eq(schema.checklistItems.entityType, "speaker"),
        eq(schema.checklistItems.entityId, f.speakerId)
      ),
    });
    expect(after.length).toBe(before.length);
  });

  it("returns 0 for entity type with no templates", async () => {
    const { generateChecklistItems } = await import("@/lib/checklist");
    const count = await generateChecklistItems("nonexistent", "fake-id", f.editionId, f.orgId);
    expect(count).toBe(0);
  });
});

// ─── Checklist Item Archival ────────────────────────────

describe("Checklist item archival", () => {
  it("archives items when archiveChecklistItems is called", async () => {
    const { archiveChecklistItems } = await import("@/lib/checklist");

    const count = await archiveChecklistItems("speaker", f.speakerId);
    expect(count).toBeGreaterThan(0);

    const items = await testDb.query.checklistItems.findMany({
      where: and(
        eq(schema.checklistItems.entityType, "speaker"),
        eq(schema.checklistItems.entityId, f.speakerId)
      ),
    });
    expect(items.every((i: { status: string }) => i.status === "archived")).toBe(true);
  });

  it("is idempotent — archiving already archived items is a no-op", async () => {
    const { archiveChecklistItems } = await import("@/lib/checklist");
    const count = await archiveChecklistItems("speaker", f.speakerId);
    expect(count).toBe(0);
  });

  it("returns 0 when entity has no items", async () => {
    const { archiveChecklistItems } = await import("@/lib/checklist");
    const count = await archiveChecklistItems("speaker", "nonexistent-id");
    expect(count).toBe(0);
  });
});

// ─── Re-confirmation (restore archived items) ──────────

describe("Re-confirmation restore", () => {
  it("restores archived items on re-confirmation", async () => {
    const { generateChecklistItems } = await import("@/lib/checklist");

    const count = await generateChecklistItems("speaker", f.speakerId, f.editionId, f.orgId);
    expect(count).toBeGreaterThan(0);

    const items = await testDb.query.checklistItems.findMany({
      where: and(
        eq(schema.checklistItems.entityType, "speaker"),
        eq(schema.checklistItems.entityId, f.speakerId)
      ),
    });
    const restored = items.filter((i: { status: string }) => i.status !== "archived");
    expect(restored.length).toBeGreaterThan(0);
    expect(restored.every((i: { status: string }) => i.status === "pending")).toBe(true);
  });

  it("restores submitted items with submitted status", async () => {
    const { archiveChecklistItems, generateChecklistItems } = await import("@/lib/checklist");

    const items = await testDb.query.checklistItems.findMany({
      where: and(
        eq(schema.checklistItems.entityType, "speaker"),
        eq(schema.checklistItems.entityId, f.speakerId)
      ),
    });

    await testDb
      .update(schema.checklistItems)
      .set({ value: "https://example.com/photo.jpg", status: "submitted" })
      .where(eq(schema.checklistItems.id, items[0].id));

    await archiveChecklistItems("speaker", f.speakerId);
    await generateChecklistItems("speaker", f.speakerId, f.editionId, f.orgId);

    const restored = await testDb.query.checklistItems.findMany({
      where: and(
        eq(schema.checklistItems.entityType, "speaker"),
        eq(schema.checklistItems.entityId, f.speakerId),
      ),
    });

    const active = restored.filter((i: { status: string }) => i.status !== "archived");
    const withValue = active.find((i: { value: string | null }) => i.value === "https://example.com/photo.jpg");
    expect(withValue).toBeDefined();
    expect(withValue!.status).toBe("submitted");
  });
});

// ─── Schema Conventions ─────────────────────────────────

describe("Checklist schema conventions", () => {
  it("checklist_items has version column", async () => {
    const items = await testDb.query.checklistItems.findMany({
      where: eq(schema.checklistItems.organizationId, f.orgId),
      limit: 1,
    });
    if (items.length > 0) {
      expect("version" in items[0]).toBe(true);
      expect(items[0].version).toBe(1);
    }
  });

  it("checklist_templates has version column", async () => {
    const templates = await testDb.query.checklistTemplates.findMany({
      where: eq(schema.checklistTemplates.organizationId, f.orgId),
      limit: 1,
    });
    if (templates.length > 0) {
      expect("version" in templates[0]).toBe(true);
    }
  });
});
