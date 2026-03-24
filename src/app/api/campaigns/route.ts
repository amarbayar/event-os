import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getActiveIds } from "@/lib/queries";

export async function GET() {
  const ids = await getActiveIds();
  if (!ids) return NextResponse.json({ data: [] });

  const rows = await db.query.campaigns.findMany({
    where: eq(campaigns.editionId, ids.editionId),
    orderBy: desc(campaigns.createdAt),
  });

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ids = await getActiveIds();
  if (!ids) return NextResponse.json({ error: "No active edition" }, { status: 400 });

  const body = await req.json();
  const { title, type, platform, content, scheduledDate, speakerId, sponsorId, source, assignedTo } = body;

  if (!title || !type) {
    return NextResponse.json(
      { error: "title and type are required" },
      { status: 400 }
    );
  }

  const [campaign] = await db
    .insert(campaigns)
    .values({
      editionId: ids.editionId,
      organizationId: ids.orgId,
      title,
      type,
      platform: platform || null,
      content: content || null,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      speakerId: speakerId || null,
      sponsorId: sponsorId || null,
      source: source || "intake",
      assignedTo: assignedTo || null,
    })
    .returning();

  return NextResponse.json({ data: campaign }, { status: 201 });
}
