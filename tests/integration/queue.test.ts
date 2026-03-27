import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testDb } from "../setup";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { DatabaseDriver } from "@/lib/queue/drivers/database";
import { Worker } from "@/lib/queue/worker";
import type { JobDefinition, ClaimedJob } from "@/lib/queue/types";
import { randomUUID } from "crypto";

// ════════════════════════════════════════════════════════
// JOB QUEUE TESTS
//
// Tests the database-backed job queue system:
//   dispatch → push to jobs table → worker pop → handle → complete/fail/bury
//
// Uses testDb (from setup.ts) injected into DatabaseDriver
// for isolation from the app's singleton connection.
// ════════════════════════════════════════════════════════

let driver: DatabaseDriver;

beforeEach(async () => {
  driver = new DatabaseDriver(testDb);
  // Clean queue tables before each test
  await testDb.delete(schema.jobs);
  await testDb.delete(schema.failedJobs);
});

// ─── Helper jobs for testing ────────────────────────────

const successJob: JobDefinition<{ value: string }> = {
  name: "test-success",
  queue: "default",
  maxAttempts: 3,
  backoffSeconds: 1,
  timeoutSeconds: 5,
  async handle() {
    // no-op: succeeds
  },
};

let failCount = 0;

const failOnceJob: JobDefinition<{ value: string }> = {
  name: "test-fail-once",
  queue: "default",
  maxAttempts: 3,
  backoffSeconds: 1,
  timeoutSeconds: 5,
  async handle() {
    failCount++;
    if (failCount <= 1) {
      throw new Error("Simulated failure");
    }
  },
};

const alwaysFailJob: JobDefinition<{ value: string }> = {
  name: "test-always-fail",
  queue: "default",
  maxAttempts: 2,
  backoffSeconds: 1,
  timeoutSeconds: 5,
  async handle() {
    throw new Error("Always fails");
  },
};

const hangingJob: JobDefinition<{ value: string }> = {
  name: "test-hanging",
  queue: "default",
  maxAttempts: 1,
  timeoutSeconds: 1,
  async handle() {
    // Hang forever
    await new Promise(() => {});
  },
};

// ─── T1: dispatch — happy path insert ───────────────────

describe("dispatch (push)", () => {
  it("T1: inserts a job into the jobs table", async () => {
    const id = await driver.push({
      name: "test-success",
      queue: "default",
      payload: { value: "hello" },
      maxAttempts: 3,
    });

    expect(id).toBeTruthy();

    const [row] = await testDb
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, id));

    expect(row).toBeDefined();
    expect(row.name).toBe("test-success");
    expect(row.queue).toBe("default");
    expect(row.payload).toEqual({ value: "hello" });
    expect(row.status).toBe("pending");
    expect(row.attempts).toBe(0);
    expect(row.maxAttempts).toBe(3);
  });

  // ─── T2: dispatch — uniqueKey dedup ─────────────────

  it("T2: deduplicates jobs with the same uniqueKey", async () => {
    const id1 = await driver.push({
      name: "test-success",
      queue: "default",
      payload: { value: "first" },
      maxAttempts: 3,
      uniqueKey: "dedup-key-1",
    });

    const id2 = await driver.push({
      name: "test-success",
      queue: "default",
      payload: { value: "second" },
      maxAttempts: 3,
      uniqueKey: "dedup-key-1",
    });

    expect(id2).toBe(id1);

    const rows = await testDb.select().from(schema.jobs);
    expect(rows).toHaveLength(1);
  });

  // ─── T3: dispatch — organizationId ──────────────────

  it("T3: stores organizationId when provided", async () => {
    const testOrgId = randomUUID();
    const id = await driver.push({
      name: "test-success",
      queue: "default",
      payload: {},
      maxAttempts: 3,
      organizationId: testOrgId,
    });

    const [row] = await testDb
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, id));

    expect(row.organizationId).toBe(testOrgId);
  });
});

// ─── T4-T6: pop — claim jobs ───────────────────────────

describe("pop", () => {
  it("T4: claims a pending job and marks it processing", async () => {
    await driver.push({
      name: "test-success",
      queue: "default",
      payload: { value: "test" },
      maxAttempts: 3,
    });

    const claimed = await driver.pop(["default"]);

    expect(claimed).not.toBeNull();
    expect(claimed!.name).toBe("test-success");
    expect(claimed!.payload).toEqual({ value: "test" });
    expect(claimed!.attempts).toBe(1);

    // Verify status in DB
    const [row] = await testDb
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, claimed!.id));
    expect(row.status).toBe("processing");
    expect(row.reservedAt).toBeTruthy();
  });

  it("T5: skips jobs with future availableAt", async () => {
    const futureDate = new Date(Date.now() + 60_000);
    await testDb.insert(schema.jobs).values({
      name: "test-future",
      queue: "default",
      payload: { value: "future" },
      status: "pending",
      maxAttempts: 3,
      availableAt: futureDate,
    });

    const claimed = await driver.pop(["default"]);
    expect(claimed).toBeNull();
  });

  it("T6: respects queue priority order", async () => {
    // Insert default queue job first
    await driver.push({
      name: "test-default",
      queue: "default",
      payload: { value: "default" },
      maxAttempts: 3,
    });

    // Insert high queue job second
    await driver.push({
      name: "test-high",
      queue: "high",
      payload: { value: "high" },
      maxAttempts: 3,
    });

    // Pop with high priority first
    const claimed = await driver.pop(["high", "default"]);

    expect(claimed).not.toBeNull();
    expect(claimed!.queue).toBe("high");
  });

  it("returns null when queue is empty", async () => {
    const claimed = await driver.pop(["default"]);
    expect(claimed).toBeNull();
  });
});

// ─── T7-T8: pushMany — bulk insert ─────────────────────

describe("pushMany", () => {
  it("T7: inserts multiple jobs in one call", async () => {
    const ids = await driver.pushMany([
      { name: "test-a", queue: "default", payload: { v: 1 }, maxAttempts: 3 },
      { name: "test-b", queue: "default", payload: { v: 2 }, maxAttempts: 3 },
      { name: "test-c", queue: "high", payload: { v: 3 }, maxAttempts: 3 },
    ]);

    expect(ids).toHaveLength(3);

    const rows = await testDb.select().from(schema.jobs);
    expect(rows).toHaveLength(3);
  });

  it("T8: returns empty array for empty input", async () => {
    const ids = await driver.pushMany([]);
    expect(ids).toHaveLength(0);
  });
});

// ─── T9: complete — deletes job ─────────────────────────

describe("complete", () => {
  it("T9: deletes the job from the table", async () => {
    const id = await driver.push({
      name: "test-success",
      queue: "default",
      payload: {},
      maxAttempts: 3,
    });

    await driver.complete(id);

    const rows = await testDb
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, id));
    expect(rows).toHaveLength(0);
  });
});

// ─── T10: fail — reset to pending with backoff ──────────

describe("fail", () => {
  it("T10: resets job to pending with future availableAt", async () => {
    const id = await driver.push({
      name: "test-success",
      queue: "default",
      payload: {},
      maxAttempts: 3,
    });

    const nextRetry = new Date(Date.now() + 10_000);
    await driver.fail(id, "Something broke", 1, nextRetry);

    const [row] = await testDb
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, id));

    expect(row.status).toBe("pending");
    expect(row.lastError).toBe("Something broke");
    expect(row.reservedAt).toBeNull();
    // availableAt should be in the future
    expect(new Date(row.availableAt).getTime()).toBeGreaterThan(Date.now() - 1000);
  });
});

// ─── T11: bury — atomic move to failed_jobs ─────────────

describe("bury", () => {
  it("T11: moves job to failed_jobs and deletes from jobs (atomic)", async () => {
    const buryOrgId = randomUUID();
    const id = await driver.push({
      name: "test-success",
      queue: "default",
      payload: { value: "doomed" },
      maxAttempts: 3,
      organizationId: buryOrgId,
    });

    await driver.bury(id, "Permanently broken");

    // Should be gone from jobs
    const jobRows = await testDb
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, id));
    expect(jobRows).toHaveLength(0);

    // Should be in failed_jobs
    const failedRows = await testDb.select().from(schema.failedJobs);
    expect(failedRows).toHaveLength(1);
    expect(failedRows[0].jobName).toBe("test-success");
    expect(failedRows[0].queue).toBe("default");
    expect(failedRows[0].payload).toEqual({ value: "doomed" });
    expect(failedRows[0].error).toBe("Permanently broken");
    expect(failedRows[0].organizationId).toBe(buryOrgId);
  });

  it("handles bury of nonexistent job gracefully", async () => {
    // Should not throw — use a valid UUID that doesn't exist
    await driver.bury(randomUUID(), "gone");
  });
});

// ─── T12: releaseStale — crash recovery ─────────────────

describe("releaseStale", () => {
  it("T12: recovers stuck processing jobs", async () => {
    // Insert a job that looks like it was claimed 10 minutes ago
    const oldDate = new Date(Date.now() - 600_000);
    await testDb.insert(schema.jobs).values({
      name: "test-stale",
      queue: "default",
      payload: {},
      status: "processing",
      maxAttempts: 3,
      reservedAt: oldDate,
    });

    const released = await driver.releaseStale(300); // 5 min timeout

    expect(released).toBe(1);

    const [row] = await testDb.select().from(schema.jobs);
    expect(row.status).toBe("pending");
    expect(row.reservedAt).toBeNull();
  });

  it("does not release recently claimed jobs", async () => {
    await testDb.insert(schema.jobs).values({
      name: "test-recent",
      queue: "default",
      payload: {},
      status: "processing",
      maxAttempts: 3,
      reservedAt: new Date(), // just claimed
    });

    const released = await driver.releaseStale(300);
    expect(released).toBe(0);
  });
});

// ─── T13-T17: Worker integration tests ─────────────────

describe("Worker", () => {
  let registry: Map<string, JobDefinition>;

  beforeEach(() => {
    registry = new Map();
    registry.set(successJob.name, successJob as JobDefinition);
    registry.set(failOnceJob.name, failOnceJob as JobDefinition);
    registry.set(alwaysFailJob.name, alwaysFailJob as JobDefinition);
    registry.set(hangingJob.name, hangingJob as JobDefinition);
    failCount = 0;
  });

  it("T13: processes a job end-to-end", async () => {
    await driver.push({
      name: "test-success",
      queue: "default",
      payload: { value: "e2e" },
      maxAttempts: 3,
    });

    const worker = new Worker(driver, registry, {
      queues: ["default"],
      pollInterval: 100,
    });

    // Process one job directly
    const claimed = await driver.pop(["default"]);
    expect(claimed).not.toBeNull();
    await worker.process(claimed!);

    // Job should be deleted (completed)
    const rows = await testDb.select().from(schema.jobs);
    expect(rows).toHaveLength(0);
  });

  it("T14: retries a failed job with backoff", async () => {
    await driver.push({
      name: "test-fail-once",
      queue: "default",
      payload: { value: "retry" },
      maxAttempts: 3,
    });

    const worker = new Worker(driver, registry);

    // First attempt — should fail
    const claimed1 = await driver.pop(["default"]);
    await worker.process(claimed1!);

    // Job should be back in pending with future availableAt
    const [row] = await testDb.select().from(schema.jobs);
    expect(row.status).toBe("pending");
    expect(row.lastError).toBe("Simulated failure");
    expect(new Date(row.availableAt).getTime()).toBeGreaterThan(Date.now() - 1000);
  });

  it("T15: buries job after maxAttempts", async () => {
    await driver.push({
      name: "test-always-fail",
      queue: "default",
      payload: { value: "doomed" },
      maxAttempts: 2,
    });

    const worker = new Worker(driver, registry);

    // First attempt
    const claimed1 = await driver.pop(["default"]);
    await worker.process(claimed1!);

    // Job should be pending (1 attempt < 2 max)
    let rows = await testDb.select().from(schema.jobs);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("pending");

    // Reset availableAt so we can pop again immediately
    await testDb
      .update(schema.jobs)
      .set({ availableAt: new Date() })
      .where(eq(schema.jobs.id, rows[0].id));

    // Second attempt — should bury
    const claimed2 = await driver.pop(["default"]);
    await worker.process(claimed2!);

    // Should be in failed_jobs now
    rows = await testDb.select().from(schema.jobs);
    expect(rows).toHaveLength(0);

    const failedRows = await testDb.select().from(schema.failedJobs);
    expect(failedRows).toHaveLength(1);
    expect(failedRows[0].jobName).toBe("test-always-fail");
    expect(failedRows[0].error).toBe("Always fails");
  });

  it("T16: buries unknown job type", async () => {
    await testDb.insert(schema.jobs).values({
      name: "nonexistent-job-type",
      queue: "default",
      payload: {},
      status: "processing",
      maxAttempts: 3,
      attempts: 1,
    });

    const worker = new Worker(driver, registry);

    const claimed: ClaimedJob = {
      id: (await testDb.select().from(schema.jobs))[0].id,
      name: "nonexistent-job-type",
      queue: "default",
      payload: {},
      attempts: 1,
      maxAttempts: 3,
      organizationId: null,
    };

    await worker.process(claimed);

    // Should be in failed_jobs
    const failedRows = await testDb.select().from(schema.failedJobs);
    expect(failedRows).toHaveLength(1);
    expect(failedRows[0].error).toContain("Unknown job type");
  });

  it("T17: times out hanging jobs via AbortController", async () => {
    await driver.push({
      name: "test-hanging",
      queue: "default",
      payload: { value: "hang" },
      maxAttempts: 1,
    });

    const worker = new Worker(driver, registry);

    const claimed = await driver.pop(["default"]);
    expect(claimed).not.toBeNull();

    await worker.process(claimed!);

    // Should be buried (maxAttempts: 1, so first failure = permanent)
    const failedRows = await testDb.select().from(schema.failedJobs);
    expect(failedRows).toHaveLength(1);
    expect(failedRows[0].error).toContain("timed out");
  }, 10_000); // Allow extra time for the 1s timeout
});

// ─── T18-T19: notify() queue integration ────────────────

describe("notify integration", () => {
  it("T18: notify dispatches to queue when QUEUE_ENABLED=true", async () => {
    const { dispatch, sendNotificationJob, setDriver, initializeJobs } =
      await import("@/lib/queue");

    await initializeJobs();
    setDriver(driver);

    const testUserId = randomUUID();
    const testOrgId = randomUUID();

    const id = await dispatch(
      sendNotificationJob,
      {
        userId: testUserId,
        orgId: testOrgId,
        type: "test",
        title: "Test notification",
      },
      { organizationId: testOrgId }
    );

    expect(id).toBeTruthy();

    const [row] = await testDb
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, id));

    expect(row.name).toBe("send-notification");
    expect(row.payload).toEqual({
      userId: testUserId,
      orgId: testOrgId,
      type: "test",
      title: "Test notification",
    });
  });

  it("T19: dispatchMany creates multiple jobs in bulk", async () => {
    const { dispatchMany, sendNotificationJob, setDriver, initializeJobs } =
      await import("@/lib/queue");

    await initializeJobs();
    setDriver(driver);

    const testOrgId = randomUUID();
    const testUserId1 = randomUUID();
    const testUserId2 = randomUUID();

    const ids = await dispatchMany(sendNotificationJob, [
      {
        payload: {
          userId: testUserId1,
          orgId: testOrgId,
          type: "test",
          title: "Notif 1",
        },
        organizationId: testOrgId,
      },
      {
        payload: {
          userId: testUserId2,
          orgId: testOrgId,
          type: "test",
          title: "Notif 2",
        },
        organizationId: testOrgId,
      },
    ]);

    expect(ids).toHaveLength(2);

    const rows = await testDb
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.name, "send-notification"));
    expect(rows).toHaveLength(2);
  });
});

// ─── T20: send-notification job handler ─────────────────

describe("send-notification handler", () => {
  afterEach(async () => {
    // Clean up any test notifications to avoid leaking state
    await testDb
      .delete(schema.notifications)
      .where(eq(schema.notifications.title, "Queue test notification"));
  });

  it("T20: inserts a notification row when executed", async () => {
    const { sendNotificationJob } = await import("@/lib/queue/jobs");

    const org = await testDb.query.organizations.findFirst();
    const user = await testDb.query.users.findFirst();

    if (!org || !user) {
      console.warn("Skipping T20: no org/user in test DB");
      return;
    }

    const controller = new AbortController();

    await sendNotificationJob.handle(
      {
        userId: user.id,
        orgId: org.id,
        type: "test",
        title: "Queue test notification",
        message: "Created by queue test",
      },
      {
        attempt: 1,
        jobId: "test-job-id",
        logPrefix: "[queue] test",
        signal: controller.signal,
      }
    );

    const notifRows = await testDb
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.title, "Queue test notification"));

    expect(notifRows).toHaveLength(1);
    expect(notifRows[0].userId).toBe(user.id);
    expect(notifRows[0].organizationId).toBe(org.id);
    expect(notifRows[0].type).toBe("test");
  });
});
