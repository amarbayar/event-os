import { execFileSync } from "child_process";
import { rmSync } from "fs";
import path from "path";

const sqlitePath = path.resolve(process.cwd(), "playwright-e2e.db");
const baseUrl = "http://localhost:3100";

function removeSqliteFiles(filePath: string) {
  for (const suffix of ["", "-shm", "-wal"]) {
    rmSync(`${filePath}${suffix}`, { force: true });
  }
}

export default async function globalSetup() {
  const env = {
    ...process.env,
    DB_DIALECT: "sqlite",
    SQLITE_PATH: sqlitePath,
    AUTH_SECRET: "test-secret",
    SERVICE_TOKEN: "test-token",
    NEXTAUTH_URL: baseUrl,
    NEXT_PUBLIC_APP_URL: baseUrl,
  };

  removeSqliteFiles(sqlitePath);

  execFileSync("npx", ["drizzle-kit", "push"], {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });

  execFileSync("npx", ["tsx", "src/db/seed.ts"], {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });
}
