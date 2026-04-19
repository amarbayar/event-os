import { getDialect } from "./dialect";
import * as pgSchema from "./schema.pg";
import * as sqliteSchema from "./schema.sqlite";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

/**
 * Create a dialect-aware database connection.
 * Uses dynamic import() for native drivers to avoid loading the unused one.
 */
export async function createConnection(pgUrlOverride?: string): Promise<{
  db: AnyDb;
  close: () => Promise<void>;
}> {
  if (getDialect() === "sqlite") {
    const Database = (await import("better-sqlite3")).default;
    const { drizzle } = await import("drizzle-orm/better-sqlite3");
    const sqlite = new Database(process.env.SQLITE_PATH || "local.db");
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("busy_timeout = 5000");
    sqlite.pragma("foreign_keys = ON");
    return { db: drizzle(sqlite, { schema: sqliteSchema }), close: async () => { sqlite.close(); } };
  }

  const postgres = (await import("postgres")).default;
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const url = pgUrlOverride || process.env.DATABASE_URL!;
  const client = postgres(url, { prepare: false });
  return { db: drizzle(client, { schema: pgSchema }), close: async () => client.end() };
}
