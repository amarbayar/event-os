// Test setup — database connection for integration tests
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/db/schema";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://admin@localhost:5432/event_os";

export const testClient = postgres(TEST_DB_URL, { prepare: false });
export const testDb = drizzle(testClient, { schema });

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

// Helper for API calls
export async function apiCall(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {}
) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const json = await res.json();
  return { status: res.status, json };
}
