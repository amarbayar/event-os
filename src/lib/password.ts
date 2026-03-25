import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hash(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function compare(
  password: string,
  stored: string
): Promise<boolean> {
  // Support legacy SHA-256 hashes (salt:hash format) for migration
  if (stored.includes(":") && !stored.startsWith("$2")) {
    const { createHash, timingSafeEqual } = await import("crypto");
    const [salt, hashed] = stored.split(":");
    if (!salt || !hashed) return false;
    const attempt = createHash("sha256").update(password + salt).digest("hex");
    try {
      return timingSafeEqual(Buffer.from(hashed), Buffer.from(attempt));
    } catch {
      return false;
    }
  }
  // bcrypt comparison
  return bcrypt.compare(password, stored);
}
