import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sessions, eventEditions, speakerApplications } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { checkVersion } from "@/lib/api-utils";
import { requirePermission, isRbacError } from "@/lib/rbac";
import { validateAgenda } from "@/lib/agenda-validator";
import { toAgendaDate } from "@/lib/agenda-time";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "session", "update");
  if (isRbacError(ctx)) return ctx;

  const session = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.id, id),
      eq(sessions.organizationId, ctx.orgId)
    ),
  });

  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const versionConflict = checkVersion(
    req.headers.get("if-match"),
    session.version
  );
  if (versionConflict) return versionConflict;

  const body = await req.json();
  const allowedFields = [
    "trackId", "speakerId", "panelSpeakerIds", "hostId",
    "title", "description", "type",
    "startTime", "endTime", "room", "day",
    "durationMinutes", "sortOrder",
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      if (field === "startTime" || field === "endTime") {
        updates[field] = body[field] ? toAgendaDate(String(body[field])) : null;
      } else {
        updates[field] = body[field];
      }
    }
  }

  const [updated] = await db
    .update(sessions)
    .set({
      ...updates,
      version: sql`${sessions.version} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(eq(sessions.id, id), eq(sessions.version, session.version))
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Conflict" }, { status: 409 });
  }

  // Run validation on all sessions for this edition
  const allSessions = await db.query.sessions.findMany({
    where: eq(sessions.editionId, session.editionId),
  });

  const edition = await db.query.eventEditions.findFirst({
    where: eq(eventEditions.id, session.editionId),
  });

  const allSpeakers = await db.query.speakerApplications.findMany({
    where: eq(speakerApplications.editionId, session.editionId),
    columns: { id: true, name: true, stage: true },
  });

  const issues = edition
    ? validateAgenda(
        allSessions,
        {
          gapMinutes: edition.agendaGapMinutes,
          startTime: edition.agendaStartTime ?? "09:00",
          endTime: edition.agendaEndTime ?? "18:00",
          startDate: edition.startDate,
          endDate: edition.endDate,
        },
        allSpeakers
      )
    : [];

  return NextResponse.json({ data: updated, issues });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await requirePermission(req, "session", "delete");
  if (isRbacError(ctx)) return ctx;

  const [deleted] = await db
    .delete(sessions)
    .where(
      and(
        eq(sessions.id, id),
        eq(sessions.organizationId, ctx.orgId)
      )
    )
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: { id } });
}
