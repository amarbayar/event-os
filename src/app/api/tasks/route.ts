import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getActiveIds } from "@/lib/queries";

export async function GET() {
  const ids = await getActiveIds();
  if (!ids) return NextResponse.json({ data: [] });

  const rows = await db.query.tasks.findMany({
    where: eq(tasks.editionId, ids.editionId),
    orderBy: desc(tasks.createdAt),
  });

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ids = await getActiveIds();
  if (!ids) return NextResponse.json({ error: "No active edition" }, { status: 400 });

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
      editionId: ids.editionId,
      organizationId: ids.orgId,
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
