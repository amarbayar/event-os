import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq, and, ne, isNotNull } from "drizzle-orm";

export type Conflict = {
  type:
    | "speaker_double_booking"
    | "room_double_booking"
    | "missing_buffer"
    | "orphan_session";
  sessionId: string;
  message: string;
  conflictsWith?: string;
};

const BUFFER_MINUTES = 15;

export async function detectConflicts(
  editionId: string
): Promise<Conflict[]> {
  const allSessions = await db.query.sessions.findMany({
    where: eq(sessions.editionId, editionId),
    with: { speaker: true, track: true },
    orderBy: (s: any, { asc }: any) => [asc(s.day), asc(s.startTime)],
  });

  const conflicts: Conflict[] = [];

  for (let i = 0; i < allSessions.length; i++) {
    const session = allSessions[i];

    // Orphan session: no speaker assigned (except breaks/networking)
    if (
      !session.speakerId &&
      session.type !== "break" &&
      session.type !== "networking"
    ) {
      conflicts.push({
        type: "orphan_session",
        sessionId: session.id,
        message: `"${session.title}" has no speaker assigned`,
      });
    }

    if (!session.startTime || !session.endTime) continue;

    for (let j = i + 1; j < allSessions.length; j++) {
      const other = allSessions[j];
      if (!other.startTime || !other.endTime) continue;
      if (session.day !== other.day) continue;

      const overlaps =
        session.startTime < other.endTime && session.endTime > other.startTime;

      // Speaker double-booking
      if (
        overlaps &&
        session.speakerId &&
        session.speakerId === other.speakerId
      ) {
        conflicts.push({
          type: "speaker_double_booking",
          sessionId: session.id,
          conflictsWith: other.id,
          message: `Speaker is double-booked: "${session.title}" and "${other.title}" overlap`,
        });
      }

      // Room double-booking (same track = same room for now)
      if (
        overlaps &&
        session.trackId &&
        session.trackId === other.trackId &&
        session.type !== "break" &&
        other.type !== "break"
      ) {
        conflicts.push({
          type: "room_double_booking",
          sessionId: session.id,
          conflictsWith: other.id,
          message: `Room conflict: "${session.title}" and "${other.title}" overlap in the same track`,
        });
      }

      // Missing buffer: sessions back-to-back with < 15 min gap
      if (
        !overlaps &&
        session.trackId === other.trackId &&
        session.trackId
      ) {
        const gapMs =
          other.startTime.getTime() - session.endTime.getTime();
        const gapMinutes = gapMs / (1000 * 60);
        if (gapMinutes > 0 && gapMinutes < BUFFER_MINUTES) {
          conflicts.push({
            type: "missing_buffer",
            sessionId: session.id,
            conflictsWith: other.id,
            message: `Only ${Math.round(gapMinutes)}min between "${session.title}" and "${other.title}" (${BUFFER_MINUTES}min recommended)`,
          });
        }
      }
    }
  }

  return conflicts;
}
