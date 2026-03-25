import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invitations } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "invitation", "read");
  if (isRbacError(ctx)) return ctx;

  const rows = await db.query.invitations.findMany({
    where: eq(invitations.editionId, ctx.editionId),
    orderBy: desc(invitations.createdAt),
  });

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "invitation", "create");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();
  const { name, type, email, invitedBy, sourceType, sourceId, notes, source, stage, assignedTo } = body;

  if (!name || !type) {
    return NextResponse.json(
      { error: "name and type are required" },
      { status: 400 }
    );
  }

  const [invitation] = await db
    .insert(invitations)
    .values({
      editionId: ctx.editionId,
      organizationId: ctx.orgId,
      name,
      type,
      email: email || null,
      invitedBy: invitedBy || null,
      sourceType: sourceType || null,
      sourceId: sourceId || null,
      notes: notes || null,
      source: source || "intake",
      stage: stage || "lead",
      assignedTo: assignedTo || null,
    })
    .returning();

  return NextResponse.json({ data: invitation }, { status: 201 });
}
