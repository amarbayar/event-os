import { describe, test, expect } from "vitest";
import { getTableName, getTableColumns } from "drizzle-orm";
import * as pgSchema from "@/db/schema.pg";
import * as sqliteSchema from "@/db/schema.sqlite";

/**
 * Ensures PG and SQLite schemas stay in sync.
 * If you add a table or column to one schema, you must add it to the other.
 */

function getTableExports(schema: Record<string, unknown>) {
  const tables: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key.endsWith("Relations") || key.endsWith("Enum")) continue;
    if (!value || typeof value !== "object") continue;
    try {
      getTableName(value as never);
      tables[key] = value;
    } catch {
      // not a table — skip
    }
  }
  return tables;
}

describe("Schema sync: PG ↔ SQLite", () => {
  const pgTables = getTableExports(pgSchema as Record<string, unknown>);
  const sqliteTables = getTableExports(sqliteSchema as Record<string, unknown>);

  test("both schemas export tables", () => {
    expect(Object.keys(pgTables).length).toBeGreaterThan(0);
    expect(Object.keys(sqliteTables).length).toBeGreaterThan(0);
  });

  test("same table exports exist in both schemas", () => {
    const pgKeys = Object.keys(pgTables).sort();
    const sqliteKeys = Object.keys(sqliteTables).sort();
    expect(sqliteKeys).toEqual(pgKeys);
  });

  for (const key of Object.keys(pgSchema).filter(
    (k) => !k.endsWith("Relations") && !k.endsWith("Enum")
  )) {
    const pgVal = (pgSchema as Record<string, unknown>)[key];
    if (!pgVal || typeof pgVal !== "object") continue;
    try {
      getTableName(pgVal as never);
    } catch {
      continue;
    }

    test(`table "${key}" has matching columns`, () => {
      const sqliteTable = (sqliteSchema as Record<string, unknown>)[key];
      expect(sqliteTable).toBeDefined();

      const pgCols = Object.keys(getTableColumns(pgVal as never)).sort();
      const sqliteCols = Object.keys(
        getTableColumns(sqliteTable as never)
      ).sort();
      expect(sqliteCols).toEqual(pgCols);
    });
  }
});
