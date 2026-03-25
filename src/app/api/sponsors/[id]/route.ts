import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sponsorApplications } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";
import { generateChecklistItems, archiveChecklistItems } from "@/lib/checklist";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "sponsor", "update");
  if (isRbacError(ctx)) return ctx;

  const sponsor = await db.query.sponsorApplications.findFirst({
    where: and(
      eq(sponsorApplications.id, id),
      eq(sponsorApplications.organizationId, ctx.orgId)
    ),
  });

  if (!sponsor) {
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
    .update(sponsorApplications)
    .set({
      ...updates,
      version: sql`${sponsorApplications.version} + 1`,
    })
    .where(eq(sponsorApplications.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Checklist trigger: stage transitions
  if (updates.stage && updates.stage !== sponsor.stage) {
    if (updates.stage === "confirmed" && sponsor.stage !== "confirmed") {
      await generateChecklistItems("sponsor", id, ctx.editionId, ctx.orgId);
    } else if (sponsor.stage === "confirmed" && updates.stage !== "confirmed") {
      await archiveChecklistItems("sponsor", id);
    }
  }

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "sponsor", "delete");
  if (isRbacError(ctx)) return ctx;

  const [deleted] = await db
    .delete(sponsorApplications)
    .where(
      and(
        eq(sponsorApplications.id, id),
        eq(sponsorApplications.organizationId, ctx.orgId)
      )
    )
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { id } });
}
