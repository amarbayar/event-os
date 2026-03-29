// Test setup — database connection for integration tests
import { config } from "dotenv";
config({ path: ".env.local" });
config(); // also load .env if it exists
import { createConnection } from "@/db/connection";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://admin@localhost:5432/event_os";

const conn = await createConnection(TEST_DB_URL);
export const testDb = conn.db;
export const testClient = conn;

// Helper to get active IDs for testing
export async function getTestIds() {
  // Use the org with the most members (the seeded org, not manually created ones)
  const { userOrganizations } = await import("@/db/schema");
  const { eq, sql } = await import("drizzle-orm");
  const orgs = await testDb.query.organizations.findMany();
  if (orgs.length === 0) throw new Error("No organization found — run seed first");
  let org = orgs[0];
  if (orgs.length > 1) {
    const counts = await Promise.all(
      orgs.map(async (o) => ({
        org: o,
        count: (await testDb.query.userOrganizations.findMany({
          where: eq(userOrganizations.organizationId, o.id),
        })).length,
      }))
    );
    org = counts.sort((a, b) => b.count - a.count)[0].org;
  }

  const edition = await testDb.query.eventEditions.findFirst();
  if (!edition) throw new Error("No edition found — run seed first");

  return { orgId: org.id, editionId: edition.id };
}

// Base URL for API tests
export const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

// Service token for authenticated API calls
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || "test-service-token";

// Cached org ID for auth headers
let cachedOrgId: string | null = null;

async function getOrgId(): Promise<string> {
  if (cachedOrgId) return cachedOrgId;
  const { orgId } = await getTestIds();
  cachedOrgId = orgId;
  return orgId;
}

// Retry-eligible status codes (LLM API rate limits and transient errors)
const RETRYABLE = new Set([429, 500, 502, 503]);
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;

// Helper for API calls — automatically injects service token auth.
// Retries on transient LLM API errors (429/500/502/503) with backoff.
export async function apiCall(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {}
) {
  const orgId = await getOrgId();
  const reqInit = {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_TOKEN}`,
      "x-organization-id": orgId,
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(`${BASE_URL}${path}`, reqInit);

    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { error: `Non-JSON response (${res.status}): ${text.slice(0, 200)}` };
    }

    // Retry on transient errors (but not on the last attempt)
    if (RETRYABLE.has(res.status) && attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * (attempt + 1);
      console.warn(`[test] ${path} returned ${res.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    return { status: res.status, json };
  }

  // Unreachable, but TypeScript needs it
  throw new Error("Exhausted retries");
}
