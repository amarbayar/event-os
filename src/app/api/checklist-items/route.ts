import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { checklistItems, checklistTemplates } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";

// GET — list checklist items for an entity (auto-syncs new templates)
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "entityType and entityId required" }, { status: 400 });
  }

  const ctx = await requirePermission(req, entityType, "read");
  if (isRbacError(ctx)) return ctx;

  // Auto-sync: check for new templates that don't have items yet
  const existingItems = await db.query.checklistItems.findMany({
    where: and(
      eq(checklistItems.entityType, entityType),
      eq(checklistItems.entityId, entityId),
    ),
  });

  // Only sync if entity already has at least one item (i.e., was confirmed)
  if (existingItems.length > 0) {
    const existingTemplateIds = new Set(existingItems.map((i: typeof existingItems[number]) => i.templateId));
    const templates = await db.query.checklistTemplates.findMany({
      where: and(
        eq(checklistTemplates.editionId, ctx.editionId),
        eq(checklistTemplates.entityType, entityType),
      ),
    });

    // Create items for any templates that don't have items yet
    for (const template of templates) {
      if (!existingTemplateIds.has(template.id)) {
        await db.insert(checklistItems).values({
          templateId: template.id,
          editionId: ctx.editionId,
          entityType,
          entityId,
          organizationId: ctx.orgId,
          status: "pending",
        });
      }
    }
  }

  const items = await db
    .select({
      id: checklistItems.id,
      templateId: checklistItems.templateId,
      entityType: checklistItems.entityType,
      entityId: checklistItems.entityId,
      status: checklistItems.status,
      value: checklistItems.value,
      submittedAt: checklistItems.submittedAt,
      approvedBy: checklistItems.approvedBy,
      approvedAt: checklistItems.approvedAt,
      notes: checklistItems.notes,
      version: checklistItems.version,
      // Template fields
      name: checklistTemplates.name,
      description: checklistTemplates.description,
      fieldKey: checklistTemplates.fieldKey,
      itemType: checklistTemplates.itemType,
      required: checklistTemplates.required,
      sortOrder: checklistTemplates.sortOrder,
      dueOffsetDays: checklistTemplates.dueOffsetDays,
    })
    .from(checklistItems)
    .innerJoin(checklistTemplates, eq(checklistItems.templateId, checklistTemplates.id))
    .where(
      and(
        eq(checklistItems.entityType, entityType),
        eq(checklistItems.entityId, entityId),
        eq(checklistItems.organizationId, ctx.orgId)
      )
    )
    .orderBy(asc(checklistTemplates.sortOrder));

  return NextResponse.json({ data: items });
}

// GET progress summary for an entity type
// /api/checklist-items?summary=true&entityType=speaker
export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "checklist", "read");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();
  const { entityType } = body;

  if (!entityType) {
    return NextResponse.json({ error: "entityType required" }, { status: 400 });
  }

  // Get all non-archived checklist items for this entity type in the edition
  const items = await db
    .select({
      entityId: checklistItems.entityId,
      status: checklistItems.status,
      name: checklistTemplates.name,
      required: checklistTemplates.required,
    })
    .from(checklistItems)
    .innerJoin(checklistTemplates, eq(checklistItems.templateId, checklistTemplates.id))
    .where(
      and(
        eq(checklistItems.entityType, entityType),
        eq(checklistItems.editionId, ctx.editionId),
        eq(checklistItems.organizationId, ctx.orgId)
      )
    );

  // Filter out archived
  const activeItems = items.filter((i: typeof items[number]) => i.status !== "archived");

  // Group by template name for progress bars
  const templateProgress: Record<string, { total: number; done: number }> = {};
  for (const item of activeItems) {
    if (!templateProgress[item.name]) {
      templateProgress[item.name] = { total: 0, done: 0 };
    }
    templateProgress[item.name].total++;
    if (item.status === "submitted" || item.status === "approved") {
      templateProgress[item.name].done++;
    }
  }

  // Count entities with zero progress
  const entityProgress: Record<string, number> = {};
  for (const item of activeItems) {
    if (!entityProgress[item.entityId]) entityProgress[item.entityId] = 0;
    if (item.status === "submitted" || item.status === "approved") {
      entityProgress[item.entityId]++;
    }
  }
  const zeroProgress = Object.values(entityProgress).filter((v) => v === 0).length;

  return NextResponse.json({
    data: {
      templateProgress,
      totalEntities: Object.keys(entityProgress).length,
      zeroProgressCount: zeroProgress,
    },
  });
}
