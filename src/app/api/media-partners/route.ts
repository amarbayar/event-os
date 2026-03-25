import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { mediaPartners } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "media", "read");
  if (isRbacError(ctx)) return ctx;

  const rows = await db.query.mediaPartners.findMany({
    where: eq(mediaPartners.editionId, ctx.editionId),
    orderBy: desc(mediaPartners.createdAt),
  });

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "media", "create");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();
  const { companyName, contactName, contactEmail, type, reach, proposal, deliverables, source, stage, assignedTo } = body;

  if (!companyName || !contactName || !contactEmail) {
    return NextResponse.json(
      { error: "companyName, contactName, and contactEmail are required" },
      { status: 400 }
    );
  }

  const [partner] = await db
    .insert(mediaPartners)
    .values({
      editionId: ctx.editionId,
      organizationId: ctx.orgId,
      companyName,
      contactName,
      contactEmail,
      type: type || null,
      reach: reach || null,
      proposal: proposal || null,
      deliverables: deliverables || null,
      source: source || "intake",
      stage: stage || "lead",
      assignedTo: assignedTo || null,
    })
    .returning();

  return NextResponse.json({ data: partner }, { status: 201 });
}
