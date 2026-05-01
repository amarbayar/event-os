export const SESSION_TYPES = [
  { value: "talk", label: "Talk" },
  { value: "keynote", label: "Keynote" },
  { value: "panel", label: "Panel" },
  { value: "workshop", label: "Workshop" },
  { value: "lightning", label: "Lightning" },
  { value: "fireside", label: "Fireside" },
  { value: "opening", label: "Opening" },
  { value: "closing", label: "Closing" },
  { value: "break", label: "Break" },
  { value: "coffee", label: "Coffee" },
  { value: "lunch", label: "Lunch" },
  { value: "networking", label: "Networking" },
] as const;

export type SessionType = (typeof SESSION_TYPES)[number]["value"];

const SESSION_TYPE_VALUES = new Set<string>(SESSION_TYPES.map((type) => type.value));

export function isSessionType(value: unknown): value is SessionType {
  return typeof value === "string" && SESSION_TYPE_VALUES.has(value);
}

export const SPEAKER_SESSION_TYPES: SessionType[] = [
  "talk",
  "keynote",
  "lightning",
  "fireside",
];

export const PANEL_SESSION_TYPES: SessionType[] = ["panel"];
export const HOST_SESSION_TYPES: SessionType[] = ["opening", "closing"];
