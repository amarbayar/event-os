import { getSessions, getEdition } from "@/lib/queries";
import { db } from "@/db";
import { tracks as tracksTable } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { AgendaClient } from "./client";

export const dynamic = "force-dynamic";

export default async function AgendaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [sessions, edition] = await Promise.all([
    getSessions(),
    getEdition(),
  ]);

  // Fetch tracks for this edition
  const tracks = edition
    ? await db
        .select({
          id: tracksTable.id,
          name: tracksTable.name,
          color: tracksTable.color,
          sortOrder: tracksTable.sortOrder,
        })
        .from(tracksTable)
        .where(eq(tracksTable.editionId, edition.id))
        .orderBy(asc(tracksTable.sortOrder))
    : [];

  // Compute number of event days from edition dates
  let totalDays = 1;
  if (edition?.startDate && edition?.endDate) {
    const start = new Date(edition.startDate);
    const end = new Date(edition.endDate);
    totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  }

  return (
    <AgendaClient
      initialSessions={sessions}
      tracks={tracks}
      eventSlug={slug}
      editionId={edition?.id ?? ""}
      editionName={edition?.name ?? "Event"}
      totalDays={totalDays}
      agendaStartTime={edition?.agendaStartTime ?? "09:00"}
      agendaEndTime={edition?.agendaEndTime ?? "18:00"}
      agendaGapMinutes={edition?.agendaGapMinutes ?? 5}
      agendaStatus={(edition?.agendaStatus as "draft" | "published") ?? "draft"}
    />
  );
}
