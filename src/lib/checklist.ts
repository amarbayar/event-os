import { db } from "@/db";
import { checklistTemplates, checklistItems } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

// ─── Generate checklist items when entity stage → confirmed ─────
//
//  PATCH route detects stage change to "confirmed" →
//  generateChecklistItems(entityType, entityId, editionId, orgId)
//
//  If entity was previously confirmed (has archived items),
//  restore those instead of creating duplicates.

export async function generateChecklistItems(
  entityType: string,
  entityId: string,
  editionId: string,
  orgId: string
): Promise<number> {
  try {
    // Check for existing archived items (re-confirmation)
    const archived = await db.query.checklistItems.findMany({
      where: and(
        eq(checklistItems.entityType, entityType),
        eq(checklistItems.entityId, entityId),
        eq(checklistItems.status, "archived")
      ),
    });

    if (archived.length > 0) {
      // Restore archived items — preserve submitted data
      for (const item of archived) {
        // Verify template still exists before restoring
        const template = await db.query.checklistTemplates.findFirst({
          where: eq(checklistTemplates.id, item.templateId),
        });
        if (template) {
          await db
            .update(checklistItems)
            .set({
              status: item.value ? "submitted" : "pending",
              updatedAt: new Date(),
            })
            .where(eq(checklistItems.id, item.id));
        }
        // Skip orphaned items (template was deleted)
      }
      return archived.length;
    }

    // Check for existing non-archived items (already confirmed, avoid duplicates)
    const existing = await db.query.checklistItems.findMany({
      where: and(
        eq(checklistItems.entityType, entityType),
        eq(checklistItems.entityId, entityId),
        eq(checklistItems.editionId, editionId)
      ),
      limit: 1,
    });

    if (existing.length > 0) {
      return 0; // Already has items, skip
    }

    // Get templates for this entity type + edition
    const templates = await db.query.checklistTemplates.findMany({
      where: and(
        eq(checklistTemplates.editionId, editionId),
        eq(checklistTemplates.entityType, entityType)
      ),
      orderBy: [asc(checklistTemplates.sortOrder)],
    });

    if (templates.length === 0) {
      return 0; // No templates configured
    }

    // Create checklist items from templates
    for (const template of templates) {
      await db.insert(checklistItems).values({
        templateId: template.id,
        editionId,
        entityType,
        entityId,
        organizationId: orgId,
        status: "pending",
      });
    }

    return templates.length;
  } catch (error) {
    console.error("Failed to generate checklist items:", error);
    return 0;
  }
}

export async function syncChecklistItemsFromTemplates(
  entityType: string,
  entityId: string,
  editionId: string,
  orgId: string
): Promise<number> {
  try {
    const existingItems = await db.query.checklistItems.findMany({
      where: and(
        eq(checklistItems.entityType, entityType),
        eq(checklistItems.entityId, entityId),
        eq(checklistItems.editionId, editionId)
      ),
    });

    const hasActiveItems = existingItems.some(
      (item: typeof existingItems[number]) => item.status !== "archived"
    );
    if (!hasActiveItems) {
      return 0;
    }

    const existingTemplateIds = new Set(
      existingItems.map((item: typeof existingItems[number]) => item.templateId)
    );

    const templates = await db.query.checklistTemplates.findMany({
      where: and(
        eq(checklistTemplates.editionId, editionId),
        eq(checklistTemplates.entityType, entityType)
      ),
      orderBy: [asc(checklistTemplates.sortOrder)],
    });

    let created = 0;
    for (const template of templates) {
      if (existingTemplateIds.has(template.id)) continue;

      await db.insert(checklistItems).values({
        templateId: template.id,
        editionId,
        entityType,
        entityId,
        organizationId: orgId,
        status: "pending",
      });
      created++;
    }

    return created;
  } catch (error) {
    console.error("Failed to sync checklist items from templates:", error);
    return 0;
  }
}

// ─── Archive checklist items when entity leaves confirmed ───────

export async function archiveChecklistItems(
  entityType: string,
  entityId: string
): Promise<number> {
  try {
    const items = await db.query.checklistItems.findMany({
      where: and(
        eq(checklistItems.entityType, entityType),
        eq(checklistItems.entityId, entityId)
      ),
    });

    const activeItems = items.filter((i: typeof items[number]) => i.status !== "archived");
    if (activeItems.length === 0) return 0;

    for (const item of activeItems) {
      await db
        .update(checklistItems)
        .set({ status: "archived", updatedAt: new Date() })
        .where(eq(checklistItems.id, item.id));
    }

    return activeItems.length;
  } catch (error) {
    console.error("Failed to archive checklist items:", error);
    return 0;
  }
}
