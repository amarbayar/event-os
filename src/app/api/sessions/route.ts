import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { paginationParams } from "@/lib/api-utils";
import { requirePermission, isRbacError } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "session", "read");
  if (isRbacError(ctx)) return ctx;

  const url = new URL(req.url);
  const editionId = url.searchParams.get("editionId") || ctx.editionId;
  const day = url.searchParams.get("day");
  const { limit } = paginationParams(req);

  if (!editionId) {
    return NextResponse.json({ error: "editionId required" }, { status: 400 });
  }

  const conditions = [
    eq(sessions.editionId, editionId),
    eq(sessions.organizationId, ctx.orgId),
  ];

  if (day) {
    conditions.push(eq(sessions.day, parseInt(day, 10)));
  }

  const result = await db.query.sessions.findMany({
    where: and(...conditions),
    with: { speaker: true, track: true },
    orderBy: [asc(sessions.day), asc(sessions.startTime), asc(sessions.sortOrder)],
    limit,
  });

  return NextResponse.json({ data: result });
}

export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "session", "create");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();
  const { trackId, speakerId, title, description, type, startTime, endTime, room, day } = body;

  // Use provided editionId, or fall back to active edition
  const editionId = body.editionId || ctx.editionId;

  if (!editionId || !title) {
    return NextResponse.json(
      { error: "title is required" },
      { status: 400 }
    );
  }

  const [session] = await db
    .insert(sessions)
    .values({
      editionId,
      organizationId: ctx.orgId,
      trackId: trackId || null,
      speakerId: speakerId || null,
      title,
      description: description || null,
      type: type || "talk",
      startTime: startTime ? new Date(startTime) : null,
      endTime: endTime ? new Date(endTime) : null,
      room: room || null,
      day: day || 1,
    })
    .returning();

  return NextResponse.json({ data: session }, { status: 201 });
}
