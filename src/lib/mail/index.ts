import { getMailConfig } from "./config";
import type { MailAddress, MailDriver, Mailable, SendResult } from "./types";
import { LogDriver } from "./drivers/log";
import { MailgunDriver } from "./drivers/mailgun";
import { PostmarkDriver } from "./drivers/postmark";
import { db } from "@/db";
import { emailLog } from "@/db/schema";
import { and, eq, gte } from "drizzle-orm";

function getDriver(): MailDriver {
  const config = getMailConfig();

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

  const conditions = [
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

/**
 * Send an email. Fire-and-forget pattern matching notify().
 * Logs to email_log table. Never throws.
 *
 * Usage:
 *   await mail(
 *     { email: "alice@example.com", name: "Alice" },
 *     portalInvite({ name: "Alice", tempPassword: "abc123", ... }),
 *     { orgId, entityType: "speaker", entityId }
 *   );
 */
export async function mail(
  to: MailAddress | MailAddress[],
  mailable: Mailable,
  options?: { orgId?: string; entityType?: string; entityId?: string }
): Promise<SendResult> {
  try {
    const config = getMailConfig();
    const driver = getDriver();
    const recipients = Array.isArray(to) ? to : [to];
    const toEmails = recipients.map((r) => r.email);

    // Dedup check
    const duplicate = await isDuplicate(
      toEmails[0],
      mailable.subject,
      options?.entityId
    );

    if (duplicate) {
      // Log the skip for audit trail
      try {
        await db.insert(emailLog).values({
          organizationId: options?.orgId || null,
          driver: driver.name,
          fromEmail: config.from.email,
          toEmails,
          subject: mailable.subject,
          status: "skipped",
          providerMessageId: null,
          error: "Deduplicated: similar email sent within last 5 minutes",
          entityType: options?.entityType || null,
          entityId: options?.entityId || null,
        });
      } catch (logError) {
        console.error("Failed to log skipped email:", logError);
      }
      return { success: true };
    }

    // Send the email [try/catch #1]
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

    // Log to DB [try/catch #2]
    try {
      await db.insert(emailLog).values({
        organizationId: options?.orgId || null,
        driver: driver.name,
        fromEmail: config.from.email,
        toEmails,
        subject: mailable.subject,
        status: result.success ? "sent" : "failed",
        providerMessageId: result.messageId || null,
        error: result.error || null,
        entityType: options?.entityType || null,
        entityId: options?.entityId || null,
      });
    } catch (logError) {
      console.error("Failed to log email:", logError);
    }

    return result;
  } catch (error) {
    console.error("Mail send failed:", error);
    return { success: false, error: String(error) };
  }
}
