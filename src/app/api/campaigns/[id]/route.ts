import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "campaign", "update");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();

  // Build updates from body — only include fields that are present
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined) {
      // Convert date strings to Date objects for timestamp columns
      if (key === "scheduledDate" || key === "publishedDate" || key === "dueDate") {
        updates[key] = value ? new Date(value as string) : null;
      } else {
        updates[key] = value;
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const [updated] = await db
      .update(campaigns)
      .set({
        ...updates,
        version: sql`${campaigns.version} + 1`,
      })
      .where(eq(campaigns.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Campaign PATCH error:", error);
    return NextResponse.json({ error: "Failed to update campaign", details: String(error) }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "campaign", "delete");
  if (isRbacError(ctx)) return ctx;

  const [deleted] = await db
    .delete(campaigns)
    .where(
      and(
        eq(campaigns.id, id),
        eq(campaigns.organizationId, ctx.orgId)
      )
    )
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { id } });
}
