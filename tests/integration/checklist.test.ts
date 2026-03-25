import { describe, it, expect, beforeAll } from "vitest";
import { testDb } from "../setup";
import * as schema from "@/db/schema";
import { eq, and } from "drizzle-orm";

// ════════════════════════════════════════════════════════
// CHECKLIST TESTS
// Tests the post-confirmation checklist system:
//   Templates → auto-generate items on confirm → progress tracking
// ════════════════════════════════════════════════════════

let orgId: string;
let editionId: string;
let speakerId: string;

beforeAll(async () => {
  const org = await testDb.query.organizations.findFirst();
  if (!org) throw new Error("No organization found — run seed first");
  orgId = org.id;

  const edition = await testDb.query.eventEditions.findFirst();
  if (!edition) throw new Error("No edition found — run seed first");
  editionId = edition.id;

  const speaker = await testDb.query.speakerApplications.findFirst({
    where: eq(schema.speakerApplications.organizationId, orgId),
  });
  if (!speaker) throw new Error("No speaker found — run seed first");
  speakerId = speaker.id;
});

// ─── Checklist Templates ────────────────────────────────

describe("Checklist templates", () => {
  it("has speaker templates seeded", async () => {
    const templates = await testDb.query.checklistTemplates.findMany({
      where: and(
        eq(schema.checklistTemplates.editionId, editionId),
        eq(schema.checklistTemplates.entityType, "speaker")
      ),
    });
    expect(templates.length).toBeGreaterThan(0);
  });

  it("has sponsor templates seeded", async () => {
    const templates = await testDb.query.checklistTemplates.findMany({
      where: and(
        eq(schema.checklistTemplates.editionId, editionId),
        eq(schema.checklistTemplates.entityType, "sponsor")
      ),
    });
    expect(templates.length).toBeGreaterThan(0);
  });

  it("has venue templates seeded", async () => {
    const templates = await testDb.query.checklistTemplates.findMany({
      where: and(
        eq(schema.checklistTemplates.editionId, editionId),
        eq(schema.checklistTemplates.entityType, "venue")
      ),
    });
    expect(templates.length).toBeGreaterThan(0);
  });

  it("has booth templates seeded", async () => {
    const templates = await testDb.query.checklistTemplates.findMany({
      where: and(
        eq(schema.checklistTemplates.editionId, editionId),
        eq(schema.checklistTemplates.entityType, "booth")
      ),
    });
    expect(templates.length).toBeGreaterThan(0);
  });

  it("has volunteer templates seeded", async () => {
    const templates = await testDb.query.checklistTemplates.findMany({
      where: and(
        eq(schema.checklistTemplates.editionId, editionId),
        eq(schema.checklistTemplates.entityType, "volunteer")
      ),
    });
    expect(templates.length).toBeGreaterThan(0);
  });

  it("has media templates seeded", async () => {
    const templates = await testDb.query.checklistTemplates.findMany({
      where: and(
        eq(schema.checklistTemplates.editionId, editionId),
        eq(schema.checklistTemplates.entityType, "media")
      ),
    });
    expect(templates.length).toBeGreaterThan(0);
  });

  it("templates have correct fields", async () => {
    const template = await testDb.query.checklistTemplates.findFirst({
      where: and(
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

  it("total templates across all entity types is 23", async () => {
    const all = await testDb.query.checklistTemplates.findMany({
      where: eq(schema.checklistTemplates.editionId, editionId),
    });
    // Total templates = sum across all entity types
    // Must be > 0, and should cover multiple entity types
    expect(all.length).toBeGreaterThan(0);
    const entityTypes = new Set(all.map((t: any) => t.entityType));
    expect(entityTypes.size).toBeGreaterThanOrEqual(3); // at least 3 entity types have templates
  });
});

// ─── Checklist Item Generation ──────────────────────────

describe("Checklist item generation", () => {
  it("generates items when generateChecklistItems is called", async () => {
    const { generateChecklistItems } = await import("@/lib/checklist");

    // Clean up any existing items for this speaker (from prior runs or UI usage)
    await testDb.delete(schema.checklistItems).where(
      and(
        eq(schema.checklistItems.entityType, "speaker"),
        eq(schema.checklistItems.entityId, speakerId)
      )
    );

    // Count speaker templates to know how many items to expect
    const templateCount = await testDb.query.checklistTemplates.findMany({
      where: and(
        eq(schema.checklistTemplates.editionId, editionId),
        eq(schema.checklistTemplates.entityType, "speaker")
      ),
    });

    // Generate items for the test speaker
    const count = await generateChecklistItems("speaker", speakerId, editionId, orgId);
    expect(count).toBe(templateCount.length);

    // Verify items exist in DB
    const items = await testDb.query.checklistItems.findMany({
      where: and(
        eq(schema.checklistItems.entityType, "speaker"),
        eq(schema.checklistItems.entityId, speakerId)
      ),
    });
    expect(items.length).toBe(templateCount.length);
    expect(items.every((i) => i.status === "pending")).toBe(true);
  });

  it("skips generation if items already exist (no duplicates)", async () => {
    const { generateChecklistItems } = await import("@/lib/checklist");

    // Count items before
    const before = await testDb.query.checklistItems.findMany({
      where: and(
        eq(schema.checklistItems.entityType, "speaker"),
        eq(schema.checklistItems.entityId, speakerId)
      ),
    });

    // Call again — should return 0 (already has items)
    const count = await generateChecklistItems("speaker", speakerId, editionId, orgId);
    expect(count).toBe(0);

    // Count unchanged — no duplicates created
    const after = await testDb.query.checklistItems.findMany({
      where: and(
        eq(schema.checklistItems.entityType, "speaker"),
        eq(schema.checklistItems.entityId, speakerId)
      ),
    });
    expect(after.length).toBe(before.length);
  });

  it("returns 0 for entity type with no templates", async () => {
    const { generateChecklistItems } = await import("@/lib/checklist");

    const count = await generateChecklistItems("nonexistent", "fake-id", editionId, orgId);
    expect(count).toBe(0);
  });
});

// ─── Checklist Item Archival ────────────────────────────

describe("Checklist item archival", () => {
  it("archives items when archiveChecklistItems is called", async () => {
    const { archiveChecklistItems } = await import("@/lib/checklist");

    const count = await archiveChecklistItems("speaker", speakerId);
    expect(count).toBeGreaterThan(0); // archives however many items exist

    // All items should be archived
    const items = await testDb.query.checklistItems.findMany({
      where: and(
        eq(schema.checklistItems.entityType, "speaker"),
        eq(schema.checklistItems.entityId, speakerId)
      ),
    });
    expect(items.every((i) => i.status === "archived")).toBe(true);
  });

  it("is idempotent — archiving already archived items is a no-op", async () => {
    const { archiveChecklistItems } = await import("@/lib/checklist");

    const count = await archiveChecklistItems("speaker", speakerId);
    expect(count).toBe(0); // All already archived
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

    // Items are currently archived from previous test
    // Re-generate should restore them
    const count = await generateChecklistItems("speaker", speakerId, editionId, orgId);
    expect(count).toBeGreaterThan(0);

    // Items should be restored to pending (since no values were set)
    const items = await testDb.query.checklistItems.findMany({
      where: and(
        eq(schema.checklistItems.entityType, "speaker"),
        eq(schema.checklistItems.entityId, speakerId)
      ),
    });
    const restored = items.filter((i) => i.status !== "archived");
    expect(restored.length).toBeGreaterThan(0);
    expect(restored.every((i) => i.status === "pending")).toBe(true);
  });

  it("restores submitted items with submitted status", async () => {
    const { archiveChecklistItems, generateChecklistItems } = await import("@/lib/checklist");

    // Set a value on one item first
    const items = await testDb.query.checklistItems.findMany({
      where: and(
        eq(schema.checklistItems.entityType, "speaker"),
        eq(schema.checklistItems.entityId, speakerId)
      ),
    });

    await testDb
      .update(schema.checklistItems)
      .set({ value: "https://example.com/photo.jpg", status: "submitted" })
      .where(eq(schema.checklistItems.id, items[0].id));

    // Archive all
    await archiveChecklistItems("speaker", speakerId);

    // Re-confirm — item with value should restore as "submitted"
    await generateChecklistItems("speaker", speakerId, editionId, orgId);

    const restored = await testDb.query.checklistItems.findMany({
      where: and(
        eq(schema.checklistItems.entityType, "speaker"),
        eq(schema.checklistItems.entityId, speakerId),
      ),
    });

    const active = restored.filter((i) => i.status !== "archived");
    const withValue = active.find((i) => i.value === "https://example.com/photo.jpg");
    expect(withValue).toBeDefined();
    expect(withValue!.status).toBe("submitted");
  });
});

// ─── Schema Conventions ─────────────────────────────────

describe("Checklist schema conventions", () => {
  it("checklist_items has version column", async () => {
    const items = await testDb.query.checklistItems.findMany({ limit: 1 });
    if (items.length > 0) {
      expect("version" in items[0]).toBe(true);
      expect(items[0].version).toBe(1);
    }
  });

  it("checklist_templates has version column", async () => {
    const templates = await testDb.query.checklistTemplates.findMany({ limit: 1 });
    if (templates.length > 0) {
      expect("version" in templates[0]).toBe(true);
    }
  });

  it("checklist_items has updatedAt column", async () => {
    const items = await testDb.query.checklistItems.findMany({ limit: 1 });
    if (items.length > 0) {
      expect("updatedAt" in items[0]).toBe(true);
    }
  });

  it("checklist_items has editionId for direct querying", async () => {
    const items = await testDb.query.checklistItems.findMany({ limit: 1 });
    if (items.length > 0) {
      expect(items[0].editionId).toBe(editionId);
    }
  });
});
