import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sessions, eventEditions, speakerApplications } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";
import { validateAgenda } from "@/lib/agenda-validator";
import { toAgendaDate } from "@/lib/agenda-time";
import { isSessionType } from "@/lib/session-types";

// Public endpoint — no auth required
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ editionId: string }> }
) {
  const { editionId } = await params;

  const edition = await db.query.eventEditions.findFirst({
    where: eq(eventEditions.id, editionId),
  });

  if (!edition) {
    return NextResponse.json({ error: "Edition not found" }, { status: 404 });
  }

  // Only return published agendas for public access
  if (edition.agendaStatus !== "published") {
    return NextResponse.json({
      data: [],
      edition: {
        name: edition.name,
        startDate: edition.startDate,
        endDate: edition.endDate,
        venue: edition.venue,
        agendaStatus: edition.agendaStatus,
      },
      message: "Agenda coming soon. Check back closer to the event.",
    });
  }

  const allSessions = await db.query.sessions.findMany({
    where: eq(sessions.editionId, editionId),
    with: { speaker: true, track: true },
    orderBy: [asc(sessions.day), asc(sessions.startTime), asc(sessions.sortOrder)],
  });

  // Strip internal fields for public consumption
  const publicSessions = allSessions.map((s: typeof allSessions[number]) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    type: s.type,
    startTime: s.startTime,
    endTime: s.endTime,
    day: s.day,
    room: s.room,
    track: s.track ? { name: s.track.name, color: s.track.color } : null,
    speaker: s.speaker
      ? {
          name: s.speaker.name,
          company: s.speaker.company,
          title: s.speaker.title,
          bio: s.speaker.bio,
          headshotUrl: s.speaker.headshotUrl,
        }
      : null,
  }));

  return NextResponse.json({
    data: publicSessions,
    edition: {
      name: edition.name,
      startDate: edition.startDate,
      endDate: edition.endDate,
      venue: edition.venue,
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ editionId: string }> }
) {
  const ctx = await requirePermission(req, "session", "create");
  if (isRbacError(ctx)) return ctx;

  const { editionId } = await params;

  // Verify edition belongs to the user's org
  const edition = await db.query.eventEditions.findFirst({
    where: and(
      eq(eventEditions.id, editionId),
      eq(eventEditions.organizationId, ctx.orgId)
    ),
  });

  if (!edition) {
    return NextResponse.json({ error: "Edition not found" }, { status: 404 });
  }

  const body = await req.json();
  const {
    title, type, trackId, speakerId, panelSpeakerIds, hostId,
    startTime, endTime, day, durationMinutes, room, description,
  } = body;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const sessionType = isSessionType(type) ? type : "talk";

  const [created] = await db
    .insert(sessions)
    .values({
      editionId,
      organizationId: ctx.orgId,
      title,
      type: sessionType,
      trackId: trackId || null,
      speakerId: speakerId || null,
      panelSpeakerIds: panelSpeakerIds || null,
      hostId: hostId || null,
      startTime: startTime ? toAgendaDate(String(startTime)) : null,
      endTime: endTime ? toAgendaDate(String(endTime)) : null,
      day: day ?? 1,
      durationMinutes: durationMinutes ?? 30,
      room: room || null,
      description: description || null,
    })
    .returning();

  // Run validation on ALL sessions for this edition
  const allSessions = await db.query.sessions.findMany({
    where: eq(sessions.editionId, editionId),
  });

  const allSpeakers = await db.query.speakerApplications.findMany({
    where: eq(speakerApplications.editionId, editionId),
    columns: { id: true, name: true, stage: true },
  });

  const issues = validateAgenda(
    allSessions,
    {
      gapMinutes: edition.agendaGapMinutes,
      startTime: edition.agendaStartTime ?? "09:00",
      endTime: edition.agendaEndTime ?? "18:00",
      startDate: edition.startDate,
      endDate: edition.endDate,
    },
    allSpeakers
  );

  return NextResponse.json({ data: created, issues }, { status: 201 });
}
