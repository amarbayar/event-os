import { defineConfig } from "drizzle-kit";
import "dotenv/config";

const isSqlite = process.env.DB_DIALECT === "sqlite";

export default isSqlite
  ? defineConfig({
      schema: "./src/db/schema.sqlite.ts",
      out: "./drizzle-sqlite",
      dialect: "sqlite",
      dbCredentials: {
        url: process.env.SQLITE_PATH || "local.db",
      },
    })
  : defineConfig({
      schema: "./src/db/schema.pg.ts",
      out: "./drizzle",
      dialect: "postgresql",
      dbCredentials: {
        url: process.env.DATABASE_URL!,
      },
    });
