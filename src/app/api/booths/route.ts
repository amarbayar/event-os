import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { booths } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "booth", "read");
  if (isRbacError(ctx)) return ctx;

  const rows = await db.query.booths.findMany({
    where: eq(booths.editionId, ctx.editionId),
    orderBy: desc(booths.createdAt),
  });

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "booth", "create");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();
  const { name, location, size, price, equipment, sponsorId, notes, source, stage, assignedTo } = body;

  if (!name) {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    );
  }

  const [booth] = await db
    .insert(booths)
    .values({
      editionId: ctx.editionId,
      organizationId: ctx.orgId,
      name,
      location: location || null,
      size: size || null,
      price: price || null,
      equipment: equipment || null,
      sponsorId: sponsorId || null,
      notes: notes || null,
      source: source || "intake",
      stage: stage || "lead",
      assignedTo: assignedTo || null,
    })
    .returning();

  return NextResponse.json({ data: booth }, { status: 201 });
}
