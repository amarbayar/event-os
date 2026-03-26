import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { venues, eventEditions } from "@/db/schema";
import { eq, and, sql, count } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";
import { checkStageProtection } from "@/lib/api-utils";
import { generateChecklistItems, archiveChecklistItems } from "@/lib/checklist";
import { notify } from "@/lib/notify";
import { users } from "@/db/schema";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "venue", "update");
  if (isRbacError(ctx)) return ctx;

  const venue = await db.query.venues.findFirst({
    where: and(
      eq(venues.id, id),
      eq(venues.organizationId, ctx.orgId)
    ),
  });

  if (!venue) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();

  // Field allowlist — prevent mass assignment
  const allowedFields = [
    "name", "address", "contactName", "contactEmail", "contactPhone",
    "capacity", "priceQuote", "status", "stage", "source", "substatus",
    "notes", "assignedTo", "assigneeId",
  ];
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (allowedFields.includes(key) && value !== undefined) {
      updates[key] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  // Enforce single confirmed venue per edition
  if (updates.stage === "confirmed" && venue.stage !== "confirmed") {
    const [existing] = await db
      .select({ c: count() })
      .from(venues)
      .where(
        and(
          eq(venues.editionId, ctx.editionId),
          eq(venues.organizationId, ctx.orgId),
          eq(venues.stage, "confirmed")
        )
      );
    if (Number(existing.c) > 0) {
      return NextResponse.json(
        { error: "Another venue is already confirmed for this edition. Decline it first before confirming a different venue." },
        { status: 409 }
      );
    }
  }

  const [updated] = await db
    .update(venues)
    .set({
      ...updates,
      version: sql`${venues.version} + 1`,
    })
    .where(and(eq(venues.id, id), eq(venues.organizationId, ctx.orgId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Checklist trigger: stage transitions
  if (updates.stage && updates.stage !== venue.stage) {
    if (updates.stage === "confirmed" && venue.stage !== "confirmed") {
      await generateChecklistItems("venue", id, ctx.editionId, ctx.orgId);

      // Auto-sync: confirmed venue becomes the edition's venue
      const venueLabel = updated.address
        ? `${updated.name}, ${updated.address}`
        : updated.name;
      await db
        .update(eventEditions)
        .set({ venue: venueLabel })
        .where(eq(eventEditions.id, ctx.editionId));

    } else if (venue.stage === "confirmed" && updates.stage !== "confirmed") {
      await archiveChecklistItems("venue", id);

      // Clear edition venue when venue is un-confirmed
      await db
        .update(eventEditions)
        .set({ venue: null })
        .where(eq(eventEditions.id, ctx.editionId));
    }
  }

  // Notification triggers
  const assigneeName = (updates.assignedTo as string) ?? (updated.assignedTo as string | null);
  if (assigneeName) {
    const assignee = await db.query.users.findFirst({
      where: eq(users.name, assigneeName),
    });
    if (assignee && assignee.id !== ctx.user.id) {
      if (updates.assignedTo && updates.assignedTo !== venue.assignedTo) {
        await notify({
          userId: assignee.id,
          orgId: ctx.orgId,
          type: "assignment",
          title: `You were assigned to ${updated.name}`,
          link: "/venues",
          entityType: "venue",
          entityId: id,
          actorName: ctx.user.name ?? undefined,
        });
      }
      if (updates.stage && updates.stage !== venue.stage) {
        await notify({
          userId: assignee.id,
          orgId: ctx.orgId,
          type: "stage_change",
          title: `${updated.name} moved to ${updates.stage}`,
          link: "/venues",
          entityType: "venue",
          entityId: id,
          actorName: ctx.user.name ?? undefined,
        });
      }
    }
  }

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "venue", "delete");
  if (isRbacError(ctx)) return ctx;

  // Stage protection: non-admins can't delete confirmed entities
  const entity = await db.query.venues.findFirst({
    where: and(eq(venues.id, id), eq(venues.organizationId, ctx.orgId)),
    columns: { stage: true },
  });
  const stageBlock = checkStageProtection(entity?.stage, ctx.user.role);
  if (stageBlock) return stageBlock;

  const [deleted] = await db
    .delete(venues)
    .where(
      and(
        eq(venues.id, id),
        eq(venues.organizationId, ctx.orgId)
      )
    )
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { id } });
}
