export function normalizeEmail(email: unknown): string {
  return String(email ?? "").trim().toLowerCase();
}
