import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "campaign", "read");
  if (isRbacError(ctx)) return ctx;

  const rows = await db.query.campaigns.findMany({
    where: eq(campaigns.editionId, ctx.editionId),
    orderBy: desc(campaigns.createdAt),
  });

  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "campaign", "create");
  if (isRbacError(ctx)) return ctx;

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
      editionId: ctx.editionId,
      organizationId: ctx.orgId,
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
