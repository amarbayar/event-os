const DEFAULT_AGENDA_REFERENCE_DATE = "2026-01-01";
const ISO_WITHOUT_ZONE_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/;
const TZ_SUFFIX_RE = /(Z|[+-]\d{2}:?\d{2})$/i;

export function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function formatHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function toAgendaDate(value: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  const raw = value.trim();
  const normalized =
    ISO_WITHOUT_ZONE_RE.test(raw) && !TZ_SUFFIX_RE.test(raw)
      ? `${raw.replace(" ", "T")}Z`
      : raw;
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

export function minutesSinceMidnight(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function agendaTimeLabel(value: string | Date | null): string | null {
  const date = toAgendaDate(value);
  return date ? formatHHMM(minutesSinceMidnight(date)) : null;
}

export function agendaTimestamp(
  hhmm: string,
  referenceDate = DEFAULT_AGENDA_REFERENCE_DATE,
): string {
  return `${referenceDate}T${hhmm}:00.000Z`;
}

export function agendaTimestampFromMinutes(
  totalMinutes: number,
  referenceDate = DEFAULT_AGENDA_REFERENCE_DATE,
): string {
  return agendaTimestamp(formatHHMM(totalMinutes), referenceDate);
}
