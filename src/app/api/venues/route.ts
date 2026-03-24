import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { venues } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getActiveIds } from "@/lib/queries";

export async function GET() {
  const ids = await getActiveIds();
  if (!ids) return NextResponse.json({ data: [] });

  const rows = await db.query.venues.findMany({
    where: eq(venues.editionId, ids.editionId),
    orderBy: desc(venues.createdAt),
  });

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ids = await getActiveIds();
  if (!ids) return NextResponse.json({ error: "No active edition" }, { status: 400 });

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
      editionId: ids.editionId,
      organizationId: ids.orgId,
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
