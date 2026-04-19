import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  checklistItems,
  checklistTemplates,
  users,
  speakerApplications,
  sponsorApplications,
  venues,
  booths,
  volunteerApplications,
  mediaPartners,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";
import { notify } from "@/lib/notify";
import {
  canSyncChecklistField,
  updateStakeholderEntity,
} from "@/lib/stakeholder-entities";

function stakeholderOwnsItem(
  ctx: { user: { role: string; linkedEntityType?: string | null; linkedEntityId?: string | null } },
  item: { entityType: string; entityId: string }
) {
  if (ctx.user.role !== "stakeholder") return true;
  return (
    ctx.user.linkedEntityType === item.entityType &&
    ctx.user.linkedEntityId === item.entityId
  );
}

// PATCH — update checklist item (submit value, approve, reject, etc.)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [item] = await db
    .select({
      id: checklistItems.id,
      entityType: checklistItems.entityType,
      entityId: checklistItems.entityId,
      organizationId: checklistItems.organizationId,
      status: checklistItems.status,
      templateId: checklistItems.templateId,
      fieldKey: checklistTemplates.fieldKey,
    })
    .from(checklistItems)
    .innerJoin(checklistTemplates, eq(checklistItems.templateId, checklistTemplates.id))
    .where(eq(checklistItems.id, id))
    .limit(1);

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ctx = await requirePermission(req, item.entityType, "update");
  if (isRbacError(ctx)) return ctx;

  if (!stakeholderOwnsItem(ctx, item)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (ctx.user.role === "stakeholder") {
    if (body.notes !== undefined) {
      return NextResponse.json(
        { error: "Stakeholders cannot add organizer notes" },
        { status: 403 }
      );
    }

    if (body.status && body.status !== "submitted") {
      return NextResponse.json(
        { error: "Stakeholders can only submit checklist items" },
        { status: 403 }
      );
    }

    if (body.status !== "submitted") {
      return NextResponse.json(
        { error: "Stakeholders must submit checklist items in a single request" },
        { status: 403 }
      );
    }
  }

  // Status transitions
  if (body.status) {
    const validStatuses = ["pending", "submitted", "approved", "needs_revision"];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = body.status;

    if (body.status === "submitted") {
      updates.submittedAt = new Date();
    }
    if (body.status === "approved") {
      updates.approvedBy = ctx.user.id;
      updates.approvedAt = new Date();
    }
    if (body.status === "needs_revision") {
      updates.approvedBy = null;
      updates.approvedAt = null;
    }
  }

  // Value (file URL, text content, etc.)
  if (body.value !== undefined) {
    updates.value = body.value;
  }

  // Organizer notes
  if (body.notes !== undefined) {
    updates.notes = body.notes;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(checklistItems)
    .set({
      ...updates,
      version: sql`${checklistItems.version} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(checklistItems.id, id), eq(checklistItems.organizationId, ctx.orgId)))
    .returning();

  if (
    body.value !== undefined &&
    canSyncChecklistField(item.entityType, item.fieldKey) &&
    (body.status === undefined ||
      body.status === "submitted" ||
      body.status === "approved")
  ) {
    await updateStakeholderEntity(item.entityType, item.entityId, {
      [item.fieldKey]: body.value,
    });
  }

  // Notification trigger: when status changes to "submitted", notify the entity's assignee
  if (body.status === "submitted" && item.status !== "submitted") {
    let entityAssignedTo: string | null = null;
    let entityName: string | null = null;
    if (item.entityType === "speaker") {
      const e = await db.query.speakerApplications.findFirst({ where: eq(speakerApplications.id, item.entityId) });
      if (e) { entityAssignedTo = e.assignedTo; entityName = e.name; }
    } else if (item.entityType === "sponsor") {
      const e = await db.query.sponsorApplications.findFirst({ where: eq(sponsorApplications.id, item.entityId) });
      if (e) { entityAssignedTo = e.assignedTo; entityName = e.companyName; }
    } else if (item.entityType === "venue") {
      const e = await db.query.venues.findFirst({ where: eq(venues.id, item.entityId) });
      if (e) { entityAssignedTo = e.assignedTo; entityName = e.name; }
    } else if (item.entityType === "booth") {
      const e = await db.query.booths.findFirst({ where: eq(booths.id, item.entityId) });
      if (e) { entityAssignedTo = e.assignedTo; entityName = e.name; }
    } else if (item.entityType === "volunteer") {
      const e = await db.query.volunteerApplications.findFirst({ where: eq(volunteerApplications.id, item.entityId) });
      if (e) { entityAssignedTo = e.assignedTo; entityName = e.name; }
    } else if (item.entityType === "media") {
      const e = await db.query.mediaPartners.findFirst({ where: eq(mediaPartners.id, item.entityId) });
      if (e) { entityAssignedTo = e.assignedTo; entityName = e.companyName; }
    }
    if (entityAssignedTo && entityName) {
      const assignee = await db.query.users.findFirst({
        where: eq(users.name, entityAssignedTo),
      });
      if (assignee && assignee.id !== ctx.user.id) {
        await notify({
          userId: assignee.id,
          orgId: ctx.orgId,
          type: "checklist_submitted",
          title: `Checklist item submitted for ${item.entityType} ${entityName}`,
          link: `/${item.entityType === "media" ? "media-partners" : item.entityType + "s"}`,
          entityType: item.entityType,
          entityId: item.entityId,
          actorName: ctx.user.name ?? undefined,
        });
      }
    }
  }

  return NextResponse.json({ data: updated });
}
