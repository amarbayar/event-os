import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { outreach } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "outreach", "read");
  if (isRbacError(ctx)) return ctx;

  const rows = await db.query.outreach.findMany({
    where: eq(outreach.editionId, ctx.editionId),
    orderBy: desc(outreach.createdAt),
  });

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "outreach", "create");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();
  const { name, targetType, email, company, role, source, assignedTo, notes } = body;

  if (!name || !targetType) {
    return NextResponse.json(
      { error: "name and targetType are required" },
      { status: 400 }
    );
  }

  const [lead] = await db
    .insert(outreach)
    .values({
      editionId: ctx.editionId,
      organizationId: ctx.orgId,
      name,
      targetType,
      email: email || null,
      company: company || null,
      role: role || null,
      source: source || null,
      assignedTo: assignedTo || null,
      notes: notes || null,
    })
    .returning();

  return NextResponse.json({ data: lead }, { status: 201 });
}
