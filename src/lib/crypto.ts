import crypto from "crypto";

/**
 * AES-256-GCM encryption for API keys at rest.
 *
 * Key source (in priority order):
 *   1. ENCRYPTION_KEY env var — must be 64 hex chars (32 bytes)
 *   2. SHA-256 hash of AUTH_SECRET (fallback for dev/self-hosted)
 */

function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    if (!/^[0-9a-fA-F]{64}$/.test(envKey)) {
      throw new Error(
        "ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)"
      );
    }
    return Buffer.from(envKey, "hex");
  }
  // Derive from AUTH_SECRET
  if (!process.env.AUTH_SECRET) {
    throw new Error("AUTH_SECRET is required for encryption. Set it in your .env file.");
  }
  return crypto
    .createHash("sha256")
    .update(process.env.AUTH_SECRET)
    .digest();
}

/**
 * Encrypt a plaintext API key using AES-256-GCM.
 * Returns a string in the format `iv:authTag:ciphertext` (all hex-encoded).
 */
export function encryptApiKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an API key that was encrypted with `encryptApiKey`.
 * Expects the `iv:authTag:ciphertext` hex format.
 */
export function decryptApiKey(encrypted: string): string {
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted key format");
  }

  const [ivHex, authTagHex, ciphertext] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
