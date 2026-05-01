import { describe, expect, it } from "vitest";
import { buildSwappedSessionSlotUpdates } from "@/lib/agenda-swap";

describe("agenda session swapping", () => {
  it("moves each speaker/content record into the other session slot and type", () => {
    const source = {
      id: "lightning-1",
      title: "Speaker A Talk",
      type: "lightning",
      day: 1,
      trackId: "track-1",
      startTime: new Date("2026-01-01T10:00:00.000Z"),
      endTime: new Date("2026-01-01T10:10:00.000Z"),
      durationMinutes: 10,
      room: "Main",
      sortOrder: 10,
    };
    const target = {
      id: "keynote-1",
      title: "Speaker B Talk",
      type: "keynote",
      day: 1,
      trackId: "track-2",
      startTime: new Date("2026-01-01T11:00:00.000Z"),
      endTime: new Date("2026-01-01T11:16:00.000Z"),
      durationMinutes: 16,
      room: "Stage",
      sortOrder: 20,
    };

    const updates = buildSwappedSessionSlotUpdates(source, target);

    expect(updates.source).toMatchObject({
      type: "keynote",
      day: 1,
      trackId: "track-2",
      startTime: target.startTime,
      endTime: target.endTime,
      durationMinutes: 16,
      room: "Stage",
      sortOrder: 20,
    });
    expect(updates.target).toMatchObject({
      type: "lightning",
      day: 1,
      trackId: "track-1",
      startTime: source.startTime,
      endTime: source.endTime,
      durationMinutes: 10,
      room: "Main",
      sortOrder: 10,
    });
    expect(updates.source).not.toHaveProperty("title");
    expect(updates.target).not.toHaveProperty("title");
  });
});
