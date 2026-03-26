import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sessions, eventEditions } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";

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
