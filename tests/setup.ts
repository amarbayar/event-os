// Test setup — database connection for integration tests
import { config } from "dotenv";
import { eq } from "drizzle-orm";
config({ path: ".env.local" });
config(); // also load .env if it exists
import { createConnection } from "@/db/connection";
import * as schema from "@/db/schema";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://admin@localhost:5432/event_os";

const conn = await createConnection(TEST_DB_URL);
export const testDb = conn.db;
export const testClient = conn;

// Helper to get active IDs for testing — uses fixtures if no seed data exists
export async function getTestIds() {
  const { createTestFixtures } = await import("./fixtures");

  // Try to find an existing org with data first
  const orgs = await testDb.query.organizations.findMany();
  for (const org of orgs) {
    const members = await testDb.query.userOrganizations.findMany({
      where: eq(schema.userOrganizations.organizationId, org.id),
    });
    if (members.length >= 3) {
      // Has enough users to be a seeded org
      const edition = await testDb.query.eventEditions.findFirst({
        where: eq(schema.eventEditions.organizationId, org.id),
      });
      if (edition) {
        return { orgId: org.id, editionId: edition.id };
      }
    }
  }

  // No suitable seed data — create fixtures
  const fixtures = await createTestFixtures();
  // Store cleanup for later (best-effort, process exit will also clean up)
  const testGlobals = globalThis as typeof globalThis & {
    __testFixturesCleanup?: () => Promise<void>;
  };
  testGlobals.__testFixturesCleanup = fixtures.cleanup;
  return { orgId: fixtures.orgId, editionId: fixtures.editionId };
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

    if (RETRYABLE.has(res.status) && attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * (attempt + 1);
      console.warn(`[test] ${path} returned ${res.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    return { status: res.status, json };
  }

  throw new Error("Exhausted retries");
}
