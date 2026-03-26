/**
 * Standalone queue worker entry point.
 *
 * Usage:
 *   npm run queue:work                          # process high + default queues
 *   npm run queue:work -- --queues=high,default  # explicit queue list
 *
 * Polls the jobs table, executes handlers, retries with backoff,
 * and shuts down gracefully on SIGTERM/SIGINT.
 */

import { createConnection } from "../src/db/connection";
import { DatabaseDriver } from "../src/lib/queue/drivers/database";
import { Worker } from "../src/lib/queue/worker";
import { initializeJobs, getRegistry } from "../src/lib/queue";

function parseArgs(argv: string[]): { queues?: string[] } {
  const result: { queues?: string[] } = {};

  for (const arg of argv) {
    if (arg.startsWith("--queues=")) {
      result.queues = arg.slice("--queues=".length).split(",");
    }
  }

  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Register all job handlers before starting the worker
  await initializeJobs();

  const { db, close } = await createConnection();
  const driver = new DatabaseDriver(db);
  const registry = getRegistry();

  console.log(`[queue] Registered jobs: ${[...registry.keys()].join(", ")}`);

  const worker = new Worker(driver, registry, {
    ...(args.queues ? { queues: args.queues } : {}),
  });

  await worker.start();
  await close();
}

main().catch((err) => {
  console.error("[queue] Worker failed to start:", err);
  process.exit(1);
});
