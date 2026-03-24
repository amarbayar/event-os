import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invitations } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getActiveIds } from "@/lib/queries";

export async function GET() {
  const ids = await getActiveIds();
  if (!ids) return NextResponse.json({ data: [] });

  const rows = await db.query.invitations.findMany({
    where: eq(invitations.editionId, ids.editionId),
    orderBy: desc(invitations.createdAt),
  });

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ids = await getActiveIds();
  if (!ids) return NextResponse.json({ error: "No active edition" }, { status: 400 });

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
      editionId: ids.editionId,
      organizationId: ids.orgId,
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
