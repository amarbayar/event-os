import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const API_TEST_FILES = [
  "tests/e2e/pipeline.test.ts",
  "tests/e2e/security.test.ts",
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isPortFree(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

async function getFreePort(startPort: number) {
  for (let port = startPort; port < startPort + 50; port += 1) {
    if (await isPortFree(port)) {
      return port;
    }
  }
  throw new Error(`Unable to find a free port starting at ${startPort}`);
}

async function waitForServer(baseUrl: string, server: ChildProcess, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Dev server exited early with code ${server.exitCode}`);
    }

    try {
      const res = await fetch(`${baseUrl}/login`, { redirect: "manual" });
      if (res.status < 500) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await sleep(1000);
  }

  throw new Error(`Timed out waiting for ${baseUrl}. Last error: ${String(lastError)}`);
}

async function stopServer(server: ChildProcess) {
  if (server.exitCode !== null) return;

  sendSignal(server, "SIGTERM");

  const deadline = Date.now() + 10_000;
  while (server.exitCode === null && Date.now() < deadline) {
    await sleep(250);
  }

  if (server.exitCode === null) {
    sendSignal(server, "SIGKILL");
  }
}

function sendSignal(child: ChildProcess, signal: NodeJS.Signals) {
  if (child.pid === undefined) return;

  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fall back to killing the direct child when process-group signaling isn't available.
    }
  }

  child.kill(signal);
}

function createTestEnv(baseUrl: string) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: new URL(baseUrl).port,
    NEXTAUTH_URL: baseUrl,
    NEXT_PUBLIC_APP_URL: baseUrl,
    TEST_BASE_URL: baseUrl,
    AUTH_SECRET: process.env.AUTH_SECRET || "test-secret",
    SERVICE_TOKEN: process.env.SERVICE_TOKEN || "test-service-token",
  };

  if (env.DB_DIALECT !== "sqlite" && !env.DATABASE_URL && env.TEST_DATABASE_URL) {
    env.DATABASE_URL = env.TEST_DATABASE_URL;
  }

  if (env.DB_DIALECT !== "sqlite" && !env.DATABASE_URL) {
    throw new Error("Set DATABASE_URL or TEST_DATABASE_URL before running API e2e tests");
  }

  return env;
}

function pipeOutput(child: ChildProcess, label: string) {
  child.stdout?.on("data", (chunk) => {
    process.stdout.write(`[${label}] ${chunk}`);
  });
  child.stderr?.on("data", (chunk) => {
    process.stderr.write(`[${label}] ${chunk}`);
  });
}

async function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv, label: string) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  pipeOutput(child, label);

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });

  return exitCode;
}

async function main() {
  const preferredPort = Number(process.env.API_E2E_PORT || 3200);
  const port = await getFreePort(preferredPort);
  const baseUrl = `http://127.0.0.1:${port}`;
  const env = createTestEnv(baseUrl);

  const server = spawn(process.execPath, [nextBin, "dev", "--hostname", "127.0.0.1"], {
    cwd: process.cwd(),
    env,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  pipeOutput(server, "server");

  try {
    await waitForServer(baseUrl, server);
    const exitCode = await runCommand(
      npmCmd,
      ["exec", "--", "vitest", "run", "--config", "vitest.api-e2e.config.ts", ...API_TEST_FILES],
      env,
      "vitest"
    );
    process.exitCode = exitCode;
  } finally {
    await stopServer(server);
  }
}

await main();
