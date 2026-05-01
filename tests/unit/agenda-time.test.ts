import { afterEach, describe, expect, it } from "vitest";
import {
  agendaTimestamp,
  agendaTimeLabel,
  formatHHMM,
  minutesSinceMidnight,
  toAgendaDate,
} from "@/lib/agenda-time";
import { validateAgenda } from "@/lib/agenda-validator";

const originalTz = process.env.TZ;

afterEach(() => {
  process.env.TZ = originalTz;
});

describe("agenda time helpers", () => {
  it("treats stored agenda timestamps as UTC wall-clock times", () => {
    process.env.TZ = "Asia/Ulaanbaatar";
    const stored = "2026-01-01T10:15:00.000Z";

    expect(new Date(stored).getHours()).toBe(18);
    expect(minutesSinceMidnight(new Date(stored))).toBe(615);
    expect(agendaTimeLabel(stored)).toBe("10:15");
  });

  it("normalizes legacy timezone-less ISO strings as agenda wall-clock UTC", () => {
    process.env.TZ = "Asia/Ulaanbaatar";

    expect(toAgendaDate("2026-01-01T10:15:00")?.toISOString()).toBe(
      "2026-01-01T10:15:00.000Z",
    );
    expect(agendaTimeLabel("2026-01-01 10:15:00")).toBe("10:15");
  });

  it("builds persisted session timestamps with an explicit UTC designator", () => {
    expect(agendaTimestamp("09:30")).toBe("2026-01-01T09:30:00.000Z");
    expect(agendaTimestamp(formatHHMM(18 * 60))).toBe("2026-01-01T18:00:00.000Z");
  });
});

describe("agenda validation time handling", () => {
  it("validates out-of-bounds checks against UTC wall-clock time", () => {
    process.env.TZ = "Asia/Ulaanbaatar";
    const issues = validateAgenda(
      [
        {
          id: "session-1",
          title: "Morning keynote",
          trackId: "track-1",
          speakerId: null,
          panelSpeakerIds: null,
          hostId: null,
          startTime: "2026-01-01T10:00:00.000Z",
          endTime: "2026-01-01T10:30:00.000Z",
          day: 1,
          type: "keynote",
        },
      ],
      {
        gapMinutes: 5,
        startTime: "09:00",
        endTime: "18:00",
        startDate: null,
        endDate: null,
      },
      [],
    );

    expect(issues).toEqual([]);
  });
});
