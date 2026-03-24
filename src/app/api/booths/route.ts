import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { booths } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getActiveIds } from "@/lib/queries";

export async function GET() {
  const ids = await getActiveIds();
  if (!ids) return NextResponse.json({ data: [] });

  const rows = await db.query.booths.findMany({
    where: eq(booths.editionId, ids.editionId),
    orderBy: desc(booths.createdAt),
  });

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ids = await getActiveIds();
  if (!ids) return NextResponse.json({ error: "No active edition" }, { status: 400 });

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
      editionId: ids.editionId,
      organizationId: ids.orgId,
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
