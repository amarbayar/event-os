import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "task", "read");
  if (isRbacError(ctx)) return ctx;

  const rows = await db.query.tasks.findMany({
    where: eq(tasks.editionId, ctx.editionId),
    orderBy: desc(tasks.createdAt),
  });

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "task", "create");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();
  const { title, description, status, priority, teamId, assigneeName, dueDate, linkedEntityType, linkedEntityId, source, assignedTo } = body;

  if (!title) {
    return NextResponse.json(
      { error: "title is required" },
      { status: 400 }
    );
  }

  const [task] = await db
    .insert(tasks)
    .values({
      editionId: ctx.editionId,
      organizationId: ctx.orgId,
      title,
      description: description || null,
      status: status || "todo",
      priority: priority || "medium",
      teamId: teamId || null,
      assigneeName: assigneeName || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      linkedEntityType: linkedEntityType || null,
      linkedEntityId: linkedEntityId || null,
      source: source || "intake",
      assignedTo: assignedTo || null,
    })
    .returning();

  return NextResponse.json({ data: task }, { status: 201 });
}
