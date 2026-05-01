import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { attendees } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";

function isValidQrHash(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 6 &&
    value.length <= 128 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

function isValidStationId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 80 &&
    /^[A-Za-z0-9_.:-]+$/.test(value)
  );
}

export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "attendee", "update");
  if (isRbacError(ctx)) return ctx;
  if (ctx.user.role === "stakeholder") {
    return NextResponse.json(
      { error: "Forbidden", message: "Stakeholder accounts cannot perform check-in scans." },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { editionId, qrHash, stationId } = body;

  if (typeof editionId !== "string" || !isValidQrHash(qrHash)) {
    return NextResponse.json(
      { error: "editionId and a valid qrHash are required" },
      { status: 400 }
    );
  }
  if (stationId !== undefined && !isValidStationId(stationId)) {
    return NextResponse.json({ error: "stationId is invalid" }, { status: 400 });
  }

  const attendee = await db.query.attendees.findFirst({
    where: and(
      eq(attendees.editionId, editionId),
      eq(attendees.qrHash, qrHash),
      eq(attendees.organizationId, ctx.orgId)
    ),
  });

  if (!attendee) {
    return NextResponse.json(
      { error: "Attendee not found", qrHash },
      { status: 404 }
    );
  }

  // First-check-in-wins: if already checked in, return success with warning
  if (attendee.checkedIn) {
    return NextResponse.json({
      data: attendee,
      warning: "Already checked in",
      checkedInAt: attendee.checkedInAt,
    });
  }

  const [updated] = await db
    .update(attendees)
    .set({
      checkedIn: true,
      checkedInAt: new Date(),
      checkedInBy: stationId || "unknown",
      version: sql`${attendees.version} + 1`,
    })
    .where(
      and(
        eq(attendees.id, attendee.id),
        eq(attendees.checkedIn, false) // first-check-in-wins
      )
    )
    .returning();

  if (!updated) {
    // Race condition: someone else checked them in between our read and write
    const current = await db.query.attendees.findFirst({
      where: eq(attendees.id, attendee.id),
    });
    return NextResponse.json({
      data: current,
      warning: "Already checked in (concurrent scan)",
    });
  }

  return NextResponse.json({ data: updated });
}

// Batch sync for offline check-ins
export async function PUT(req: NextRequest) {
  const ctx = await requirePermission(req, "attendee", "update");
  if (isRbacError(ctx)) return ctx;
  if (ctx.user.role === "stakeholder") {
    return NextResponse.json(
      { error: "Forbidden", message: "Stakeholder accounts cannot perform check-in scans." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { editionId, checkIns } = body as {
    editionId: string;
    checkIns: { qrHash: string; timestamp: string; stationId: string }[];
  };

  if (!editionId || !checkIns?.length) {
    return NextResponse.json({ error: "editionId and checkIns required" }, { status: 400 });
  }

  const results = [];
  for (const ci of checkIns) {
    const [updated] = await db
      .update(attendees)
      .set({
        checkedIn: true,
        checkedInAt: new Date(ci.timestamp),
        checkedInBy: ci.stationId,
        version: sql`${attendees.version} + 1`,
      })
      .where(
        and(
          eq(attendees.editionId, editionId),
          eq(attendees.qrHash, ci.qrHash),
          eq(attendees.organizationId, ctx.orgId),
          eq(attendees.checkedIn, false) // first-check-in-wins
        )
      )
      .returning();

    results.push({
      qrHash: ci.qrHash,
      synced: !!updated,
      alreadyCheckedIn: !updated,
    });
  }

  return NextResponse.json({ data: results });
}
