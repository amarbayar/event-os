import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { volunteerApplications } from "@/db/schema";
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
  const ctx = await requirePermission(req, "volunteer", "update");
  if (isRbacError(ctx)) return ctx;

  const volunteer = await db.query.volunteerApplications.findFirst({
    where: and(
      eq(volunteerApplications.id, id),
      eq(volunteerApplications.organizationId, ctx.orgId)
    ),
  });

  if (!volunteer) {
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
    .update(volunteerApplications)
    .set({
      ...updates,
      version: sql`${volunteerApplications.version} + 1`,
    })
    .where(eq(volunteerApplications.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Checklist trigger: stage transitions
  if (updates.stage && updates.stage !== volunteer.stage) {
    if (updates.stage === "confirmed" && volunteer.stage !== "confirmed") {
      await generateChecklistItems("volunteer", id, ctx.editionId, ctx.orgId);
    } else if (volunteer.stage === "confirmed" && updates.stage !== "confirmed") {
      await archiveChecklistItems("volunteer", id);
    }
  }

  // Notification triggers
  const assigneeName = (updates.assignedTo as string) ?? (updated.assignedTo as string | null);
  if (assigneeName) {
    const assignee = await db.query.users.findFirst({
      where: eq(users.name, assigneeName),
    });
    if (assignee && assignee.id !== ctx.user.id) {
      if (updates.assignedTo && updates.assignedTo !== volunteer.assignedTo) {
        await notify({
          userId: assignee.id,
          orgId: ctx.orgId,
          type: "assignment",
          title: `You were assigned to ${updated.name}`,
          link: "/volunteers",
          entityType: "volunteer",
          entityId: id,
          actorName: ctx.user.name ?? undefined,
        });
      }
      if (updates.stage && updates.stage !== volunteer.stage) {
        await notify({
          userId: assignee.id,
          orgId: ctx.orgId,
          type: "stage_change",
          title: `${updated.name} moved to ${updates.stage}`,
          link: "/volunteers",
          entityType: "volunteer",
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
  const ctx = await requirePermission(req, "volunteer", "delete");
  if (isRbacError(ctx)) return ctx;

  const [deleted] = await db
    .delete(volunteerApplications)
    .where(
      and(
        eq(volunteerApplications.id, id),
        eq(volunteerApplications.organizationId, ctx.orgId)
      )
    )
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { id } });
}
