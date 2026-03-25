import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { entityNotes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";

// DELETE a note
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "note", "delete");
  if (isRbacError(ctx)) return ctx;

  const [deleted] = await db
    .delete(entityNotes)
    .where(eq(entityNotes.id, id))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { id } });
}

// PATCH a note (edit content)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "note", "update");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();

  const [updated] = await db
    .update(entityNotes)
    .set({ content: body.content, updatedAt: new Date() })
    .where(eq(entityNotes.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: updated });
}
