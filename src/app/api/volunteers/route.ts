import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { volunteerApplications } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getActiveIds } from "@/lib/queries";

export async function GET() {
  const ids = await getActiveIds();
  if (!ids) return NextResponse.json({ data: [] });

  const rows = await db.query.volunteerApplications.findMany({
    where: eq(volunteerApplications.editionId, ids.editionId),
    orderBy: desc(volunteerApplications.createdAt),
  });

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ids = await getActiveIds();
  if (!ids) return NextResponse.json({ error: "No active edition" }, { status: 400 });

  const body = await req.json();
  const { name, email, phone, role, availability, tshirtSize, experience, source, stage, assignedTo } = body;

  if (!name || !email) {
    return NextResponse.json(
      { error: "name and email are required" },
      { status: 400 }
    );
  }

  const [volunteer] = await db
    .insert(volunteerApplications)
    .values({
      editionId: ids.editionId,
      organizationId: ids.orgId,
      name,
      email,
      phone: phone || null,
      role: role || null,
      availability: availability || null,
      tshirtSize: tshirtSize || null,
      experience: experience || null,
      source: source || "intake",
      stage: stage || "lead",
      assignedTo: assignedTo || null,
    })
    .returning();

  return NextResponse.json({ data: volunteer }, { status: 201 });
}
