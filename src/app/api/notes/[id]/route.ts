import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { entityNotes } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";

// PATCH — edit note content (own notes only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "note", "update");
  if (isRbacError(ctx)) return ctx;

  const note = await db.query.entityNotes.findFirst({
    where: and(eq(entityNotes.id, id), eq(entityNotes.organizationId, ctx.orgId)),
  });

  if (!note) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Ownership check — only the author can edit (admins bypass)
  const isOwner = note.authorEmail === ctx.user.email;
  const isAdmin = ["owner", "admin"].includes(ctx.user.role);
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "You can only edit your own notes" }, { status: 403 });
  }

  const body = await req.json();

  const [updated] = await db
    .update(entityNotes)
    .set({ content: body.content, updatedAt: new Date() })
    .where(and(eq(entityNotes.id, id), eq(entityNotes.organizationId, ctx.orgId)))
    .returning();

  return NextResponse.json({ data: updated });
}

// DELETE — remove note (own notes only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "note", "delete");
  if (isRbacError(ctx)) return ctx;

  const note = await db.query.entityNotes.findFirst({
    where: and(eq(entityNotes.id, id), eq(entityNotes.organizationId, ctx.orgId)),
  });

  if (!note) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Ownership check — only the author can delete (admins bypass)
  const isOwner = note.authorEmail === ctx.user.email;
  const isAdmin = ["owner", "admin"].includes(ctx.user.role);
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "You can only delete your own notes" }, { status: 403 });
  }

  await db.delete(entityNotes).where(and(eq(entityNotes.id, id), eq(entityNotes.organizationId, ctx.orgId)));

  return NextResponse.json({ data: { id } });
}
