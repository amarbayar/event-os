// Test setup — database connection for integration tests
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
  const org = await testDb.query.organizations.findFirst();
  if (!org) throw new Error("No organization found — run seed first");

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

// Helper for API calls — automatically injects service token auth
export async function apiCall(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {}
) {
  const orgId = await getOrgId();

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_TOKEN}`,
      "x-organization-id": orgId,
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { error: `Non-JSON response (${res.status}): ${text.slice(0, 200)}` };
  }
  return { status: res.status, json };
}
