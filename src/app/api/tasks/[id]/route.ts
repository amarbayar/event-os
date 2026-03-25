import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";
import { notify } from "@/lib/notify";
import { users } from "@/db/schema";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "task", "update");
  if (isRbacError(ctx)) return ctx;

  const existingTask = await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
  });

  if (!existingTask) {
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
    .update(tasks)
    .set({
      ...updates,
      version: sql`${tasks.version} + 1`,
    })
    .where(eq(tasks.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Notification triggers
  const newAssigneeName = (updates.assigneeName as string) ?? (updates.assignedTo as string) ?? null;
  const oldAssigneeName = existingTask.assigneeName ?? existingTask.assignedTo ?? null;
  const resolvedAssigneeName = newAssigneeName ?? (updated.assigneeName as string | null) ?? (updated.assignedTo as string | null);
  if (resolvedAssigneeName) {
    const assignee = await db.query.users.findFirst({
      where: eq(users.name, resolvedAssigneeName),
    });
    if (assignee && assignee.id !== ctx.user.id) {
      // Assignment changed
      if (newAssigneeName && newAssigneeName !== oldAssigneeName) {
        await notify({
          userId: assignee.id,
          orgId: ctx.orgId,
          type: "assignment",
          title: `You were assigned a task: ${updated.title}`,
          link: "/tasks",
          entityType: "task",
          entityId: id,
          actorName: ctx.user.name ?? undefined,
        });
      }
      // Status changed
      if (updates.status && updates.status !== existingTask.status) {
        await notify({
          userId: assignee.id,
          orgId: ctx.orgId,
          type: "stage_change",
          title: `Task '${updated.title}' moved to ${updates.status}`,
          link: "/tasks",
          entityType: "task",
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
  const ctx = await requirePermission(req, "task", "delete");
  if (isRbacError(ctx)) return ctx;

  const [deleted] = await db
    .delete(tasks)
    .where(
      and(
        eq(tasks.id, id),
        eq(tasks.organizationId, ctx.orgId)
      )
    )
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { id } });
}
