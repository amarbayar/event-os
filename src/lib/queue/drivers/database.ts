import { eq, and, lte, sql, inArray } from "drizzle-orm";
import { jobs, failedJobs } from "@/db/schema";
import { getDialect } from "@/db/dialect";
import type { QueueDriver, EnqueuedJob, ClaimedJob } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

/**
 * Database-backed queue driver.
 *
 * Accepts a Drizzle db instance via constructor for testability.
 * Uses FOR UPDATE SKIP LOCKED on PG for concurrent-safe job claiming.
 * Uses UPDATE...RETURNING on SQLite (3.35+) for atomic claiming.
 */
export class DatabaseDriver implements QueueDriver {
  private db: AnyDb;
  private dialect: "postgresql" | "sqlite";

  constructor(db: AnyDb) {
    this.db = db;
    this.dialect = getDialect();
  }

  async push(job: EnqueuedJob): Promise<string> {
    if (job.uniqueKey) {
      // Dedup: check for existing pending job with same key
      const existing = await this.db
        .select({ id: jobs.id })
        .from(jobs)
        .where(
          and(eq(jobs.uniqueKey, job.uniqueKey), eq(jobs.status, "pending"))
        )
        .limit(1);

      if (existing.length > 0) {
        return existing[0].id;
      }
    }

    const [inserted] = await this.db
      .insert(jobs)
      .values({
        name: job.name,
        queue: job.queue,
        payload: job.payload,
        maxAttempts: job.maxAttempts,
        organizationId: job.organizationId ?? null,
        uniqueKey: job.uniqueKey ?? null,
      })
      .returning({ id: jobs.id });

    return inserted.id;
  }

  async pushMany(enqueuedJobs: EnqueuedJob[]): Promise<string[]> {
    if (enqueuedJobs.length === 0) return [];

    const rows = enqueuedJobs.map((job) => ({
      name: job.name,
      queue: job.queue,
      payload: job.payload,
      maxAttempts: job.maxAttempts,
      organizationId: job.organizationId ?? null,
      uniqueKey: job.uniqueKey ?? null,
    }));

    const inserted = await this.db
      .insert(jobs)
      .values(rows)
      .returning({ id: jobs.id });

    return inserted.map((r: { id: string }) => r.id);
  }

  async pop(queues: string[]): Promise<ClaimedJob | null> {
    if (queues.length === 0) return null;

    const now = new Date();

    if (this.dialect === "postgresql") {
      return this.popPg(queues, now);
    }
    return this.popSqlite(queues, now);
  }

  /**
   * PG: Atomic claim using FOR UPDATE SKIP LOCKED.
   * Single UPDATE...RETURNING with a subquery for safe concurrent access.
   */
  private async popPg(
    queues: string[],
    now: Date
  ): Promise<ClaimedJob | null> {
    const queueList = queues.map((q) => `'${q.replace(/'/g, "''")}'`).join(",");
    const nowIso = now.toISOString();

    const result = await this.db.execute(sql`
      UPDATE jobs
      SET status = 'processing',
          reserved_at = ${nowIso}::timestamp,
          attempts = attempts + 1
      WHERE id = (
        SELECT id FROM jobs
        WHERE queue IN (${sql.raw(queueList)})
          AND status = 'pending'
          AND available_at <= ${nowIso}::timestamp
        ORDER BY
          array_position(ARRAY[${sql.raw(queueList)}], queue),
          created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, name, queue, payload, attempts, max_attempts, organization_id
    `);

    const rows = Array.isArray(result) ? result : result.rows ?? [];
    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      queue: row.queue,
      payload: row.payload,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      organizationId: row.organization_id,
    };
  }

  /**
   * SQLite: Atomic claim using UPDATE...RETURNING (SQLite 3.35+).
   * WAL mode serializes writes, so no SKIP LOCKED needed.
   */
  private async popSqlite(
    queues: string[],
    now: Date
  ): Promise<ClaimedJob | null> {
    // SQLite doesn't support subquery in UPDATE, so SELECT then UPDATE.
    // Build a CASE expression for queue priority ordering.
    const caseParts = queues
      .map((q, i) => `WHEN '${q.replace(/'/g, "''")}' THEN ${i}`)
      .join(" ");
    const queueOrder = sql.raw(`CASE "queue" ${caseParts} ELSE ${queues.length} END`);

    const candidates = await this.db
      .select({ id: jobs.id })
      .from(jobs)
      .where(
        and(
          inArray(jobs.queue, queues),
          eq(jobs.status, "pending"),
          lte(jobs.availableAt, now)
        )
      )
      .orderBy(queueOrder, jobs.createdAt)
      .limit(1);

    if (candidates.length === 0) return null;

    const updated = await this.db
      .update(jobs)
      .set({
        status: "processing",
        reservedAt: now,
        attempts: sql`${jobs.attempts} + 1`,
      })
      .where(
        and(eq(jobs.id, candidates[0].id), eq(jobs.status, "pending"))
      )
      .returning({
        id: jobs.id,
        name: jobs.name,
        queue: jobs.queue,
        payload: jobs.payload,
        attempts: jobs.attempts,
        maxAttempts: jobs.maxAttempts,
        organizationId: jobs.organizationId,
      });

    if (updated.length === 0) return null; // Another worker claimed it

    return {
      id: updated[0].id,
      name: updated[0].name,
      queue: updated[0].queue,
      payload: updated[0].payload,
      attempts: updated[0].attempts,
      maxAttempts: updated[0].maxAttempts,
      organizationId: updated[0].organizationId ?? null,
    };
  }

  async complete(jobId: string): Promise<void> {
    await this.db.delete(jobs).where(eq(jobs.id, jobId));
  }

  async fail(
    jobId: string,
    error: string,
    attempts: number,
    nextRetryAt: Date | null
  ): Promise<void> {
    await this.db
      .update(jobs)
      .set({
        status: "pending",
        lastError: error,
        reservedAt: null,
        availableAt: nextRetryAt ?? new Date(),
      })
      .where(eq(jobs.id, jobId));
  }

  /**
   * Atomically move a job to failed_jobs — wrapped in a transaction
   * so a crash between INSERT and DELETE can't lose or duplicate the job.
   *
   * SQLite's better-sqlite3 driver uses synchronous transactions,
   * so we branch on dialect to handle both PG (async) and SQLite (sync).
   */
  async bury(jobId: string, error: string): Promise<void> {
    if (this.dialect === "sqlite") {
      // SQLite: read job outside transaction to avoid SQLITE_BUSY_SNAPSHOT
      // when other connections hold read snapshots (e.g. CI test parallelism).
      // No race risk — SQLite serializes all writes synchronously.
      const [job] = this.db
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId))
        .limit(1)
        .all();
      if (!job) return;
      this.db.transaction((tx: AnyDb) => {
        tx.insert(failedJobs)
          .values({
            jobName: job.name,
            queue: job.queue,
            payload: job.payload,
            error,
            organizationId: job.organizationId,
          })
          .run();
        tx.delete(jobs).where(eq(jobs.id, jobId)).run();
      });
    } else {
      // PG: async transaction — SELECT inside for consistency
      await this.db.transaction(async (tx: AnyDb) => {
        const [job] = await tx
          .select()
          .from(jobs)
          .where(eq(jobs.id, jobId))
          .limit(1);
        if (!job) return;
        await tx.insert(failedJobs).values({
          jobName: job.name,
          queue: job.queue,
          payload: job.payload,
          error,
          organizationId: job.organizationId,
        });
        await tx.delete(jobs).where(eq(jobs.id, jobId));
      });
    }
  }

  /**
   * Recover jobs stuck in "processing" — happens when a worker crashes.
   * Resets them to "pending" so they can be retried.
   */
  async releaseStale(timeoutSeconds: number): Promise<number> {
    const cutoff = new Date(Date.now() - timeoutSeconds * 1000);

    const stale = await this.db
      .update(jobs)
      .set({
        status: "pending",
        reservedAt: null,
      })
      .where(
        and(eq(jobs.status, "processing"), lte(jobs.reservedAt, cutoff))
      )
      .returning({ id: jobs.id });

    return stale.length;
  }
}
