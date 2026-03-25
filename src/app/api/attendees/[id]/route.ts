import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { attendees } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "attendee", "update");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();
  const allowedFields = [
    "name", "email", "ticketType", "checkedIn", "checkedInAt",
    "checkedInBy", "source", "stage", "assignedTo",
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(attendees)
    .set({
      ...updates,
      version: sql`${attendees.version} + 1`,
    })
    .where(and(eq(attendees.id, id), eq(attendees.organizationId, ctx.orgId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "attendee", "delete");
  if (isRbacError(ctx)) return ctx;

  const [deleted] = await db
    .delete(attendees)
    .where(
      and(
        eq(attendees.id, id),
        eq(attendees.organizationId, ctx.orgId)
      )
    )
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { id } });
}
