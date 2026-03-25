export function validateRequired(
  data: Record<string, unknown>,
  fields: string[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const value = data[field];
    if (value === undefined || value === null || String(value).trim() === "") {
      const label = field
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (c) => c.toUpperCase());
      errors[field] = `${label} is required`;
    }
  }
  return errors;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateEmail(
  value: unknown,
  label: string,
): string | null {
  const str = String(value ?? "").trim();
  if (!str) return null; // not required — use validateRequired for that
  return isValidEmail(str) ? null : `${label} must be a valid email address`;
}

/** Extract an error message from a failed API response body. */
export async function getApiError(
  res: Response,
  fallback: string,
): Promise<string> {
  try {
    const json = await res.json();
    return json.message || json.error || fallback;
  } catch {
    return fallback;
  }
}
