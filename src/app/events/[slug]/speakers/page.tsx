import { getSpeakers } from "@/lib/queries";
import { db } from "@/db";
import { tracks, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SpeakersClient } from "./client";

export const dynamic = "force-dynamic";

export default async function SpeakersPage() {
  const speakers = await getSpeakers();

  // Fetch tracks for the dropdown
  const edition = await db.query.eventEditions.findFirst();
  const allTracks = edition
    ? await db.query.tracks.findMany({
        where: eq(tracks.editionId, edition.id),
      })
    : [];

  // Fetch sessions to show assigned slots
  const allSessions = edition
    ? await db.query.sessions.findMany({
        where: eq(sessions.editionId, edition.id),
        with: { track: true },
      })
    : [];

  return (
    <SpeakersClient
      initialSpeakers={speakers}
      tracks={allTracks.map((t: typeof allTracks[number]) => ({ id: t.id, name: t.name }))}
      sessions={allSessions.map((s: typeof allSessions[number]) => ({
        id: s.id,
        title: s.title,
        speakerId: s.speakerId,
        day: s.day,
        startTime: s.startTime?.toISOString() || null,
        endTime: s.endTime?.toISOString() || null,
        trackName: s.track?.name || null,
      }))}
    />
  );
}
