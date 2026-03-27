import { db } from "@/db";
import { eventEditions, sessions } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { PublicAgendaClient } from "./client";

export const dynamic = "force-dynamic";

export default async function PublicAgendaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations("Common");

  const edition = await db.query.eventEditions.findFirst({
    where: eq(eventEditions.slug, slug),
  });

  if (!edition) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{t("eventNotFound")}</p>
      </div>
    );
  }

  const allSessions = await db.query.sessions.findMany({
    where: eq(sessions.editionId, edition.id),
    with: { speaker: true, track: true },
    orderBy: [asc(sessions.day), asc(sessions.startTime), asc(sessions.sortOrder)],
  });

  const publicSessions = allSessions.map((s: typeof allSessions[number]) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    type: s.type,
    startTime: s.startTime?.toISOString() || null,
    endTime: s.endTime?.toISOString() || null,
    day: s.day,
    room: s.room,
    track: s.track ? { name: s.track.name, color: s.track.color } : null,
    speaker: s.speaker
      ? { name: s.speaker.name, company: s.speaker.company, bio: s.speaker.bio }
      : null,
  }));

  return (
    <PublicAgendaClient
      edition={{
        name: edition.name,
        startDate: edition.startDate?.toISOString() || null,
        endDate: edition.endDate?.toISOString() || null,
        venue: edition.venue,
        agendaStatus: edition.agendaStatus,
      }}
      sessions={publicSessions}
    />
  );
}
