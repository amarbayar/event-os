import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { mediaPartners } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";
import { generateChecklistItems, archiveChecklistItems } from "@/lib/checklist";
import { notify } from "@/lib/notify";
import { users } from "@/db/schema";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "media", "update");
  if (isRbacError(ctx)) return ctx;

  const partner = await db.query.mediaPartners.findFirst({
    where: and(
      eq(mediaPartners.id, id),
      eq(mediaPartners.organizationId, ctx.orgId)
    ),
  });

  if (!partner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();

  // Build updates from body — only include fields that are present
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined) {
      updates[key] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(mediaPartners)
    .set({
      ...updates,
      version: sql`${mediaPartners.version} + 1`,
    })
    .where(eq(mediaPartners.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Checklist trigger: stage transitions
  if (updates.stage && updates.stage !== partner.stage) {
    if (updates.stage === "confirmed" && partner.stage !== "confirmed") {
      await generateChecklistItems("media", id, ctx.editionId, ctx.orgId);
    } else if (partner.stage === "confirmed" && updates.stage !== "confirmed") {
      await archiveChecklistItems("media", id);
    }
  }

  // Notification triggers
  const assigneeName = (updates.assignedTo as string) ?? (updated.assignedTo as string | null);
  if (assigneeName) {
    const assignee = await db.query.users.findFirst({
      where: eq(users.name, assigneeName),
    });
    if (assignee && assignee.id !== ctx.user.id) {
      if (updates.assignedTo && updates.assignedTo !== partner.assignedTo) {
        await notify({
          userId: assignee.id,
          orgId: ctx.orgId,
          type: "assignment",
          title: `You were assigned to ${updated.companyName}`,
          link: "/media-partners",
          entityType: "media",
          entityId: id,
          actorName: ctx.user.name ?? undefined,
        });
      }
      if (updates.stage && updates.stage !== partner.stage) {
        await notify({
          userId: assignee.id,
          orgId: ctx.orgId,
          type: "stage_change",
          title: `${updated.companyName} moved to ${updates.stage}`,
          link: "/media-partners",
          entityType: "media",
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
  const ctx = await requirePermission(req, "media", "delete");
  if (isRbacError(ctx)) return ctx;

  const [deleted] = await db
    .delete(mediaPartners)
    .where(
      and(
        eq(mediaPartners.id, id),
        eq(mediaPartners.organizationId, ctx.orgId)
      )
    )
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { id } });
}
