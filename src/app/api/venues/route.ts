import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { venues } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "venue", "read");
  if (isRbacError(ctx)) return ctx;

  const rows = await db.query.venues.findMany({
    where: eq(venues.editionId, ctx.editionId),
    orderBy: desc(venues.createdAt),
  });

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "venue", "create");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();
  const { name, address, contactName, contactEmail, contactPhone, capacity, priceQuote, assignedTo, pros, cons, notes, source, stage } = body;

  if (!name) {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    );
  }

  const [venue] = await db
    .insert(venues)
    .values({
      editionId: ctx.editionId,
      organizationId: ctx.orgId,
      name,
      address: address || null,
      contactName: contactName || null,
      contactEmail: contactEmail || null,
      contactPhone: contactPhone || null,
      capacity: capacity || null,
      priceQuote: priceQuote || null,
      assignedTo: assignedTo || null,
      pros: pros || null,
      cons: cons || null,
      notes: notes || null,
      source: source || "intake",
      stage: stage || "lead",
    })
    .returning();

  return NextResponse.json({ data: venue }, { status: 201 });
}
