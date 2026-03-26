import type { JobDefinition, QueueDriver, EnqueuedJob } from "./types";
import { DatabaseDriver } from "./drivers/database";

// Re-export types for consumers
export type { JobDefinition, JobContext, QueueDriver, WorkerOptions } from "./types";
export { Worker } from "./worker";
export { DatabaseDriver } from "./drivers/database";
export { sendNotificationJob, sendEmailJob } from "./jobs";

// ─── Job Registry ───────────────────────────────────────

const registry = new Map<string, JobDefinition>();
let initialized = false;

export function registerJob<T>(job: JobDefinition<T>): void {
  if (registry.has(job.name)) {
    throw new Error(`Duplicate job registration: ${job.name}`);
  }
  registry.set(job.name, job as JobDefinition);
}

export function getJob(name: string): JobDefinition | undefined {
  return registry.get(name);
}

export function getRegistry(): Map<string, JobDefinition> {
  return registry;
}

/**
 * Register all known jobs. Call this from the worker entry point
 * or app startup — not at import time, to avoid side effects.
 */
export async function initializeJobs(): Promise<void> {
  if (initialized) return;
  const { sendNotificationJob, sendEmailJob } = await import("./jobs");
  registerJob(sendNotificationJob);
  registerJob(sendEmailJob);
  initialized = true;
}

// ─── Driver Factory ─────────────────────────────────────

let cachedDriver: QueueDriver | null = null;

export async function getDriver(): Promise<QueueDriver> {
  if (cachedDriver) return cachedDriver;

  const backend = process.env.QUEUE_DRIVER ?? "database";

  switch (backend) {
    case "database": {
      const { db } = await import("@/db");
      cachedDriver = new DatabaseDriver(db);
      return cachedDriver;
    }
    default:
      throw new Error(`Unknown queue driver: ${backend}`);
  }
}

export function setDriver(driver: QueueDriver): void {
  cachedDriver = driver;
}

// ─── Dispatch API ───────────────────────────────────────
//
// dispatch() throws on failure — callers decide error handling:
//   - notify() wraps in try/catch (fire-and-forget)
//   - checklist routes let it propagate (returns 500)

export async function dispatch<T>(
  job: JobDefinition<T>,
  payload: T,
  options?: { organizationId?: string; uniqueKey?: string; queue?: string }
): Promise<string> {
  const driver = await getDriver();
  return driver.push({
    name: job.name,
    queue: options?.queue ?? job.queue ?? "default",
    payload,
    maxAttempts: job.maxAttempts ?? 3,
    organizationId: options?.organizationId,
    uniqueKey: options?.uniqueKey,
  });
}

export async function dispatchMany<T>(
  job: JobDefinition<T>,
  items: Array<{
    payload: T;
    organizationId?: string;
    uniqueKey?: string;
  }>
): Promise<string[]> {
  if (items.length === 0) return [];

  const driver = await getDriver();
  const enqueuedJobs: EnqueuedJob[] = items.map((item) => ({
    name: job.name,
    queue: job.queue ?? "default",
    payload: item.payload,
    maxAttempts: job.maxAttempts ?? 3,
    organizationId: item.organizationId,
    uniqueKey: item.uniqueKey,
  }));

  return driver.pushMany(enqueuedJobs);
}
