import { ilike as pgIlike, like, type Column } from "drizzle-orm";

export type Dialect = "postgresql" | "sqlite";

const dialect: Dialect =
  process.env.DB_DIALECT === "sqlite" ? "sqlite" : "postgresql";

export function getDialect(): Dialect {
  return dialect;
}

/**
 * Case-insensitive LIKE — uses `ilike` on PG, `like` on SQLite.
 * SQLite's LIKE is already case-insensitive for ASCII characters.
 */
export function ilikeFn(column: Column, value: string) {
  return dialect === "sqlite" ? like(column, value) : pgIlike(column, value);
}
