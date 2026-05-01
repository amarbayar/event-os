type SwappableSessionSlot = {
  type: string;
  day: number;
  trackId: string | null;
  startTime: Date | string | null;
  endTime: Date | string | null;
  durationMinutes: number;
  room: string | null;
  sortOrder?: number | null;
};

export type SwappedSessionSlotUpdates = {
  source: SwappableSessionSlot;
  target: SwappableSessionSlot;
};

function slotFields(session: SwappableSessionSlot): SwappableSessionSlot {
  return {
    type: session.type,
    day: session.day,
    trackId: session.trackId,
    startTime: session.startTime,
    endTime: session.endTime,
    durationMinutes: session.durationMinutes,
    room: session.room,
    sortOrder: session.sortOrder ?? null,
  };
}

export function buildSwappedSessionSlotUpdates(
  source: SwappableSessionSlot,
  target: SwappableSessionSlot
): SwappedSessionSlotUpdates {
  return {
    source: slotFields(target),
    target: slotFields(source),
  };
}
