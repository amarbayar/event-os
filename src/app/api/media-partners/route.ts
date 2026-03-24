import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { mediaPartners } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getActiveIds } from "@/lib/queries";

export async function GET() {
  const ids = await getActiveIds();
  if (!ids) return NextResponse.json({ data: [] });

  const rows = await db.query.mediaPartners.findMany({
    where: eq(mediaPartners.editionId, ids.editionId),
    orderBy: desc(mediaPartners.createdAt),
  });

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ids = await getActiveIds();
  if (!ids) return NextResponse.json({ error: "No active edition" }, { status: 400 });

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
      editionId: ids.editionId,
      organizationId: ids.orgId,
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
