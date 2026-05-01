import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgendaClient } from "@/app/events/[slug]/agenda/client";

const root = process.cwd();

describe("AgendaClient", () => {
  it("renders a 5-minute single-column agenda with richer session cards", () => {
    const html = renderToStaticMarkup(
      <AgendaClient
        initialSessions={[
          {
            id: "session-1",
            title: "Machine Learning Systems in Practice",
            type: "keynote",
            startTime: "2026-01-01T09:05:00.000Z",
            endTime: "2026-01-01T09:10:00.000Z",
            day: 1,
            room: "Main Hall",
            durationMinutes: 5,
            trackId: "track-1",
            speakerId: "speaker-1",
            panelSpeakerIds: null,
            hostId: null,
            description: "Opening keynote abstract with enough detail to preview.",
            version: 1,
            speaker: {
              id: "speaker-1",
              name: "Ada Lovelace",
              company: "Analytical Engines",
              stage: "confirmed",
              headshotUrl: null,
            },
            track: { id: "track-1", name: "Systems", color: "#0ea5e9" },
          },
        ]}
        tracks={[{ id: "track-1", name: "Systems", color: "#0ea5e9", sortOrder: 1 }]}
        eventSlug="devsummit-2026"
        editionId="edition-1"
        editionName="DevSummit"
        totalDays={1}
        agendaStartTime="09:00"
        agendaEndTime="10:00"
        agendaGapMinutes={5}
        agendaStatus="draft"
      />,
    );

    expect(html).toContain("09:05");
    expect(html).toContain("Machine Learning Systems in Practice");
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("/events/devsummit-2026/speakers?speakerId=speaker-1");
    expect(html).toContain("Opening keynote abstract");
    expect(html).toContain("Systems");
  });

  it("uses one-minute duration input bounds in the editor", () => {
    const source = readFileSync(join(root, "src/app/events/[slug]/agenda/client.tsx"), "utf8");

    expect(source).toContain("min={1}");
    expect(source).toContain("max={60}");
    expect(source).toContain("step={1}");
  });

  it("renders friendly selected labels for drawer speaker and track controls", () => {
    const source = readFileSync(join(root, "src/app/events/[slug]/agenda/client.tsx"), "utf8");

    expect(source).toContain("selectedSpeakerLabel");
    expect(source).toContain("selectedTrackLabel");
    expect(source).toContain("selectedHostLabel");
  });

  it("supports drag-and-drop session swaps through the server-side swap endpoint", () => {
    const source = readFileSync(join(root, "src/app/events/[slug]/agenda/client.tsx"), "utf8");

    expect(source).toContain("draggable");
    expect(source).toContain("handleSessionDrop");
    expect(source).toContain("/api/sessions/swap");
  });

  it("uses a right-side metadata rail to balance dense session cards", () => {
    const source = readFileSync(join(root, "src/app/events/[slug]/agenda/client.tsx"), "utf8");

    expect(source).toContain("session-card-main");
    expect(source).toContain("session-card-meta");
    expect(source).toContain("md:absolute md:right-0 md:top-0");
  });
});
