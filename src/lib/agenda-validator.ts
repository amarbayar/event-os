import { agendaTimeLabel, minutesSinceMidnight, toAgendaDate } from "@/lib/agenda-time";

export type AgendaIssue = {
  type: "overlap" | "speaker_conflict" | "out_of_bounds" | "gap_violation" | "unconfirmed_speaker";
  severity: "error" | "warning";
  sessionIds: string[];
  message: string;
};

type SessionForValidation = {
  id: string;
  title: string;
  trackId: string | null;
  speakerId: string | null;
  panelSpeakerIds: string[] | null;
  hostId: string | null;
  startTime: Date | string | null;
  endTime: Date | string | null;
  day: number;
  type: string;
};

type SpeakerInfo = {
  id: string;
  name: string;
  stage: string;
};

type AgendaConfig = {
  gapMinutes: number;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  startDate: Date | string | null;
  endDate: Date | string | null;
};

/** Returns all speaker IDs associated with a session (speakerId + panelSpeakerIds combined). */
export function getSessionSpeakerIds(session: Pick<SessionForValidation, "speakerId" | "panelSpeakerIds">): string[] {
  const ids: string[] = [];
  if (session.speakerId) {
    ids.push(session.speakerId);
  }
  if (session.panelSpeakerIds && Array.isArray(session.panelSpeakerIds)) {
    for (const id of session.panelSpeakerIds) {
      if (id && !ids.includes(id)) {
        ids.push(id);
      }
    }
  }
  return ids;
}

/** Parse "HH:MM" into total minutes since midnight. */
function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Check if two time ranges overlap: (a.start < b.end && b.start < a.end) */
function timesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

export function validateAgenda(
  sessions: SessionForValidation[],
  config: AgendaConfig,
  speakers: SpeakerInfo[]
): AgendaIssue[] {
  const issues: AgendaIssue[] = [];
  const speakerMap = new Map(speakers.map((s) => [s.id, s]));

  // Pre-process sessions: resolve dates and filter to only scheduled ones
  type ResolvedSession = SessionForValidation & { start: Date; end: Date };
  const scheduled: ResolvedSession[] = [];

  for (const session of sessions) {
    const start = toAgendaDate(session.startTime);
    const end = toAgendaDate(session.endTime);
    if (start && end) {
      scheduled.push({ ...session, start, end });
    }
  }

  // 1. Overlap: sessions on the same day + same track with overlapping times
  const byDayTrack = new Map<string, ResolvedSession[]>();
  for (const s of scheduled) {
    const key = `${s.day}::${s.trackId ?? "__no_track__"}`;
    const group = byDayTrack.get(key) || [];
    group.push(s);
    byDayTrack.set(key, group);
  }

  for (const group of Array.from(byDayTrack.values())) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (timesOverlap(a.start, a.end, b.start, b.end)) {
          issues.push({
            type: "overlap",
            severity: "error",
            sessionIds: [a.id, b.id],
            message: `"${a.title}" and "${b.title}" overlap on day ${a.day}${a.trackId ? "" : " (no track)"}`,
          });
        }
      }
    }
  }

  // 2. Speaker conflict: same speaker in two sessions at overlapping times (any track)
  const byDay = new Map<number, ResolvedSession[]>();
  for (const s of scheduled) {
    const group = byDay.get(s.day) || [];
    group.push(s);
    byDay.set(s.day, group);
  }

  for (const daySessions of Array.from(byDay.values())) {
    for (let i = 0; i < daySessions.length; i++) {
      for (let j = i + 1; j < daySessions.length; j++) {
        const a = daySessions[i];
        const b = daySessions[j];

        // Collect all person IDs (speakers + host) from both sessions
        const aPersonIds = getSessionSpeakerIds(a);
        if (a.hostId) aPersonIds.push(a.hostId);
        const bPersonIds = new Set(getSessionSpeakerIds(b));
        if (b.hostId) bPersonIds.add(b.hostId);

        const shared = aPersonIds.filter((id) => bPersonIds.has(id));

        if (shared.length > 0 && timesOverlap(a.start, a.end, b.start, b.end)) {
          const names = shared
            .map((id) => speakerMap.get(id)?.name || id)
            .join(", ");
          issues.push({
            type: "speaker_conflict",
            severity: "error",
            sessionIds: [a.id, b.id],
            message: `Speaker conflict: ${names} assigned to "${a.title}" and "${b.title}" at overlapping times on day ${a.day}`,
          });
        }
      }
    }
  }

  // 3. Out of bounds: session time falls outside the configured event hours
  const dayStartMinutes = parseHHMM(config.startTime);
  const dayEndMinutes = parseHHMM(config.endTime);

  for (const s of scheduled) {
    const sessionStartMinutes = minutesSinceMidnight(s.start);
    const sessionEndMinutes = minutesSinceMidnight(s.end);

    if (sessionStartMinutes < dayStartMinutes) {
      issues.push({
        type: "out_of_bounds",
        severity: "warning",
        sessionIds: [s.id],
        message: `"${s.title}" starts at ${agendaTimeLabel(s.start) ?? "--:--"}, before event start time ${config.startTime}`,
      });
    }
    if (sessionEndMinutes > dayEndMinutes) {
      issues.push({
        type: "out_of_bounds",
        severity: "warning",
        sessionIds: [s.id],
        message: `"${s.title}" ends at ${agendaTimeLabel(s.end) ?? "--:--"}, after event end time ${config.endTime}`,
      });
    }
  }

  // 4. Gap violation: consecutive sessions in same track with less than gapMinutes between them
  for (const group of Array.from(byDayTrack.values())) {
    const sorted = [...group].sort((a, b) => a.start.getTime() - b.start.getTime());

    for (let i = 0; i < sorted.length - 1; i++) {
      const prev = sorted[i];
      const next = sorted[i + 1];
      const gapMs = next.start.getTime() - prev.end.getTime();
      const gapMinutes = gapMs / (1000 * 60);

      // Only check gap if sessions don't overlap (overlaps are caught separately)
      if (gapMs > 0 && gapMinutes < config.gapMinutes) {
        issues.push({
          type: "gap_violation",
          severity: "warning",
          sessionIds: [prev.id, next.id],
          message: `Only ${Math.round(gapMinutes)} min gap between "${prev.title}" and "${next.title}" (minimum: ${config.gapMinutes} min)`,
        });
      }
    }
  }

  // 5. Unconfirmed speaker: session references a speaker whose stage !== "confirmed"
  for (const session of sessions) {
    const speakerIds = getSessionSpeakerIds(session);

    for (const spkId of speakerIds) {
      const speaker = speakerMap.get(spkId);
      if (speaker && speaker.stage !== "confirmed") {
        issues.push({
          type: "unconfirmed_speaker",
          severity: "warning",
          sessionIds: [session.id],
          message: `"${session.title}" has unconfirmed speaker ${speaker.name} (stage: ${speaker.stage})`,
        });
      }
    }
  }

  return issues;
}
