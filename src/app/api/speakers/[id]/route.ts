import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { speakerApplications } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getApiContext, checkVersion } from "@/lib/api-utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getApiContext(req);
  if (ctx instanceof NextResponse) return ctx;

  const speaker = await db.query.speakerApplications.findFirst({
    where: and(
      eq(speakerApplications.id, id),
      eq(speakerApplications.organizationId, ctx.organizationId)
    ),
  });

  if (!speaker) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: speaker });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getApiContext(req);
  if (ctx instanceof NextResponse) return ctx;

  const speaker = await db.query.speakerApplications.findFirst({
    where: and(
      eq(speakerApplications.id, id),
      eq(speakerApplications.organizationId, ctx.organizationId)
    ),
  });

  if (!speaker) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only enforce version check if If-Match is a real version number (not 999/placeholder)
  const ifMatch = req.headers.get("if-match");
  if (ifMatch && ifMatch !== "999") {
    const versionConflict = checkVersion(ifMatch, speaker.version);
    if (versionConflict) return versionConflict;
  }

  const body = await req.json();
  const allowedFields = [
    "status",
    "reviewScore",
    "reviewNotes",
    "name",
    "email",
    "bio",
    "headshotUrl",
    "company",
    "title",
    "talkTitle",
    "talkAbstract",
    "talkType",
    "trackPreference",
    "source",
    "stage",
    "assignedTo",
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(speakerApplications)
    .set({
      ...updates,
      version: sql`${speakerApplications.version} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(speakerApplications.id, id),
        eq(speakerApplications.version, speaker.version)
      )
    )
    .returning();

  if (!updated) {
    return NextResponse.json(
      { error: "Conflict — record was modified", currentVersion: speaker.version },
      { status: 409 }
    );
  }

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [deleted] = await db
    .delete(speakerApplications)
    .where(eq(speakerApplications.id, id))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { id } });
}
