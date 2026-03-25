import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { booths } from "@/db/schema";
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
  const ctx = await requirePermission(req, "booth", "update");
  if (isRbacError(ctx)) return ctx;

  const booth = await db.query.booths.findFirst({
    where: and(
      eq(booths.id, id),
      eq(booths.organizationId, ctx.orgId)
    ),
  });

  if (!booth) {
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
    .update(booths)
    .set({
      ...updates,
      version: sql`${booths.version} + 1`,
    })
    .where(eq(booths.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Checklist trigger: stage transitions
  if (updates.stage && updates.stage !== booth.stage) {
    if (updates.stage === "confirmed" && booth.stage !== "confirmed") {
      await generateChecklistItems("booth", id, ctx.editionId, ctx.orgId);
    } else if (booth.stage === "confirmed" && updates.stage !== "confirmed") {
      await archiveChecklistItems("booth", id);
    }
  }

  // Notification triggers
  const assigneeName = (updates.assignedTo as string) ?? (updated.assignedTo as string | null);
  if (assigneeName) {
    const assignee = await db.query.users.findFirst({
      where: eq(users.name, assigneeName),
    });
    if (assignee && assignee.id !== ctx.user.id) {
      if (updates.assignedTo && updates.assignedTo !== booth.assignedTo) {
        await notify({
          userId: assignee.id,
          orgId: ctx.orgId,
          type: "assignment",
          title: `You were assigned to ${updated.name}`,
          link: "/booths",
          entityType: "booth",
          entityId: id,
          actorName: ctx.user.name ?? undefined,
        });
      }
      if (updates.stage && updates.stage !== booth.stage) {
        await notify({
          userId: assignee.id,
          orgId: ctx.orgId,
          type: "stage_change",
          title: `${updated.name} moved to ${updates.stage}`,
          link: "/booths",
          entityType: "booth",
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
  const ctx = await requirePermission(req, "booth", "delete");
  if (isRbacError(ctx)) return ctx;

  const [deleted] = await db
    .delete(booths)
    .where(
      and(
        eq(booths.id, id),
        eq(booths.organizationId, ctx.orgId)
      )
    )
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { id } });
}
