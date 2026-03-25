import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { attendees } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import { requirePermission, isRbacError } from "@/lib/rbac";

function generateQrHash(editionId: string, email: string): string {
  const salt = randomBytes(4).toString("hex");
  return createHash("sha256")
    .update(`${editionId}-${email}-${salt}`)
    .digest("hex")
    .slice(0, 16);
}

// GET — list attendees
export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "attendee", "read");
  if (isRbacError(ctx)) return ctx;

  const url = new URL(req.url);
  const editionId = url.searchParams.get("editionId") || ctx.editionId;

  if (!editionId) {
    return NextResponse.json({ error: "editionId required" }, { status: 400 });
  }

  const result = await db.query.attendees.findMany({
    where: eq(attendees.editionId, editionId),
    orderBy: [asc(attendees.name)],
  });

  return NextResponse.json({ data: result });
}

// POST — bulk import attendees
export async function POST(req: NextRequest) {
  const ctx = await requirePermission(req, "attendee", "create");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();
  const { attendeeList } = body as {
    attendeeList: Array<{
      name: string;
      email: string;
      ticketType?: string;
    }>;
  };

  const editionId = body.editionId || ctx.editionId;
  const organizationId = ctx.orgId;

  if (!editionId || !attendeeList?.length) {
    return NextResponse.json(
      { error: "editionId and attendeeList are required" },
      { status: 400 }
    );
  }

  const results = { imported: 0, skipped: 0, errors: [] as string[] };

  for (const attendee of attendeeList) {
    if (!attendee.name || !attendee.email) {
      results.errors.push(`Skipped: missing name or email for "${attendee.name || attendee.email || "unknown"}"`);
      results.skipped++;
      continue;
    }

    // Check for duplicate email in this edition
    const existing = await db.query.attendees.findFirst({
      where: and(
        eq(attendees.editionId, editionId),
        eq(attendees.email, attendee.email.trim().toLowerCase())
      ),
    });

    if (existing) {
      results.skipped++;
      continue;
    }

    await db.insert(attendees).values({
      editionId,
      organizationId,
      name: attendee.name.trim(),
      email: attendee.email.trim().toLowerCase(),
      ticketType: attendee.ticketType || "general",
      qrHash: generateQrHash(editionId, attendee.email),
    });

    results.imported++;
  }

  return NextResponse.json({
    data: results,
    message: `Imported ${results.imported} attendees. ${results.skipped} skipped (duplicates or invalid).`,
  }, { status: 201 });
}
