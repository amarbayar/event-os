import { getMailConfig, type MailConfig } from "./config";
import type { MailAddress, MailDriver, Mailable, SendResult } from "./types";
import { LogDriver } from "./drivers/log";
import { MailgunDriver } from "./drivers/mailgun";
import { PostmarkDriver } from "./drivers/postmark";
import { db } from "@/db";
import { emailLog } from "@/db/schema";
import { and, eq, gte, like, sql } from "drizzle-orm";
import { getDialect } from "@/db/dialect";

function getDriver(config: MailConfig): MailDriver {
  switch (config.driver) {
    case "log":
      return new LogDriver();
    case "mailgun":
      return new MailgunDriver(config.mailgun!);
    case "postmark":
      return new PostmarkDriver(config.postmark!);
  }
}

/**
 * Check if a similar email was sent recently (within 5 minutes).
 * Prevents accidental duplicate sends from bugs or retries.
 */
async function isDuplicate(
  toEmail: string,
  subject: string,
  entityId?: string
): Promise<boolean> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  // PG uses jsonb containment; SQLite stores JSON as text, so use LIKE
  const emailMatch =
    getDialect() === "sqlite"
      ? like(emailLog.toEmails, `%${toEmail}%`)
      : sql`${emailLog.toEmails}::jsonb @> ${JSON.stringify([toEmail])}::jsonb`;

  const conditions = [
    emailMatch,
    eq(emailLog.subject, subject),
    gte(emailLog.createdAt, fiveMinutesAgo),
  ];

  if (entityId) {
    conditions.push(eq(emailLog.entityId, entityId));
  }

  const existing = await db.query.emailLog.findFirst({
    where: and(...conditions),
    columns: { id: true },
  });

  return !!existing;
}

function buildLogEntry(
  config: MailConfig,
  driver: MailDriver,
  toEmails: string[],
  subject: string,
  status: string,
  options?: { orgId?: string; entityType?: string; entityId?: string },
  result?: SendResult
) {
  return {
    organizationId: options?.orgId || null,
    driver: driver.name,
    fromEmail: config.from.email,
    toEmails,
    subject,
    status,
    providerMessageId: result?.messageId || null,
    error: result?.error || null,
    entityType: options?.entityType || null,
    entityId: options?.entityId || null,
  };
}

/**
 * Queue an email for sending. Returns immediately — the actual send
 * happens in the background via the queue worker with retry/backoff.
 *
 * Falls back to synchronous send when QUEUE_ENABLED is not set
 * (e.g. local dev without a worker running).
 */
export async function mail(
  to: MailAddress | MailAddress[],
  mailable: Mailable,
  options?: { orgId?: string; entityType?: string; entityId?: string }
): Promise<SendResult> {
  try {
    if (process.env.QUEUE_ENABLED === "true") {
      const { dispatch, sendEmailJob } = await import("@/lib/queue");
      await dispatch(sendEmailJob, { to, mailable, options }, {
        organizationId: options?.orgId,
      });
      return { success: true };
    }

    return mailNow(to, mailable, options);
  } catch (error) {
    console.error("Mail dispatch failed:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send an email synchronously. Dedup-checks, sends via driver, logs result.
 * Called directly by the queue worker (sendEmailJob) or as fallback when
 * queue is disabled. Never throws.
 */
export async function mailNow(
  to: MailAddress | MailAddress[],
  mailable: Mailable,
  options?: { orgId?: string; entityType?: string; entityId?: string }
): Promise<SendResult> {
  try {
    const config = getMailConfig();
    const driver = getDriver(config);
    const recipients = Array.isArray(to) ? to : [to];
    const toEmails = recipients.map((r) => r.email);

    const duplicate = await isDuplicate(
      toEmails[0],
      mailable.subject,
      options?.entityId
    );

    if (duplicate) {
      try {
        await db.insert(emailLog).values(
          buildLogEntry(config, driver, toEmails, mailable.subject, "skipped", options, {
            success: false,
            error: "Deduplicated: similar email sent within last 5 minutes",
          })
        );
      } catch (logError) {
        console.error("Failed to log skipped email:", logError);
      }
      return { success: true };
    }

    let result: SendResult;
    try {
      result = await driver.send(
        {
          to: recipients,
          subject: mailable.subject,
          html: mailable.html,
          text: mailable.text,
          tags: mailable.tags,
        },
        config.from
      );
    } catch (sendError) {
      result = { success: false, error: String(sendError) };
    }

    try {
      await db.insert(emailLog).values(
        buildLogEntry(
          config, driver, toEmails, mailable.subject,
          result.success ? "sent" : "failed",
          options, result
        )
      );
    } catch (logError) {
      console.error("Failed to log email:", logError);
    }

    return result;
  } catch (error) {
    console.error("Mail send failed:", error);
    return { success: false, error: String(error) };
  }
}
