import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { speakerApplications } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { checkVersion } from "@/lib/api-utils";
import { requirePermission, isRbacError } from "@/lib/rbac";
import { generateChecklistItems, archiveChecklistItems } from "@/lib/checklist";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "speaker", "read");
  if (isRbacError(ctx)) return ctx;

  const speaker = await db.query.speakerApplications.findFirst({
    where: and(
      eq(speakerApplications.id, id),
      eq(speakerApplications.organizationId, ctx.orgId)
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
  const ctx = await requirePermission(req, "speaker", "update");
  if (isRbacError(ctx)) return ctx;

  const speaker = await db.query.speakerApplications.findFirst({
    where: and(
      eq(speakerApplications.id, id),
      eq(speakerApplications.organizationId, ctx.orgId)
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
    "phone",
    "bio",
    "headshotUrl",
    "company",
    "title",
    "linkedin",
    "website",
    "talkTitle",
    "talkAbstract",
    "talkType",
    "trackPreference",
    "slideUrl",
    "requirements",
    "requirementsNotes",
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

  // Checklist trigger: stage transitions
  if (updates.stage && updates.stage !== speaker.stage) {
    if (updates.stage === "confirmed" && speaker.stage !== "confirmed") {
      await generateChecklistItems("speaker", id, ctx.editionId, ctx.orgId);
    } else if (speaker.stage === "confirmed" && updates.stage !== "confirmed") {
      await archiveChecklistItems("speaker", id);
    }
  }

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "speaker", "delete");
  if (isRbacError(ctx)) return ctx;

  const [deleted] = await db
    .delete(speakerApplications)
    .where(eq(speakerApplications.id, id))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { id } });
}
