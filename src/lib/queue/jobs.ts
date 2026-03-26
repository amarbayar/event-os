import type { RawNotifyParams } from "@/lib/notify";
import type { MailAddress, Mailable } from "@/lib/mail/types";
import type { JobDefinition } from "./types";

// ─── send-notification ──────────────────────────────────
//
// Wraps the notification DB insert. Receives pre-resolved
// title/message (i18n resolved before dispatch in notify()).

export const sendNotificationJob: JobDefinition<RawNotifyParams> = {
  name: "send-notification",
  queue: "default",
  maxAttempts: 3,
  backoffSeconds: 5,
  timeoutSeconds: 10,

  async handle(payload, ctx) {
    console.log(ctx.logPrefix, `Notifying user ${payload.userId}: ${payload.title}`);

    const { db } = await import("@/db");
    const { notifications } = await import("@/db/schema");

    await db.insert(notifications).values({
      userId: payload.userId,
      organizationId: payload.orgId,
      type: payload.type,
      title: payload.title,
      message: payload.message || null,
      link: payload.link || null,
      entityType: payload.entityType || null,
      entityId: payload.entityId || null,
      actorName: payload.actorName || null,
    });
  },
};

// ─── send-email ─────────────────────────────────────────
//
// Sends an email via the mail system (Postmark/Mailgun/Log).
// Dispatched through the queue for retry and backoff on failure.

interface SendEmailPayload {
  to: MailAddress | MailAddress[];
  mailable: Mailable;
  options?: { orgId?: string; entityType?: string; entityId?: string };
}

export const sendEmailJob: JobDefinition<SendEmailPayload> = {
  name: "send-email",
  queue: "default",
  maxAttempts: 3,
  backoffSeconds: 15,
  timeoutSeconds: 30,

  async handle(payload, ctx) {
    const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];
    const toStr = recipients.map((r) => r.email).join(", ");
    console.log(ctx.logPrefix, `Sending email to ${toStr}: ${payload.mailable.subject}`);

    const { mailNow } = await import("@/lib/mail");
    const result = await mailNow(payload.to, payload.mailable, payload.options);

    if (!result.success) {
      throw new Error(`Email send failed: ${result.error}`);
    }

    console.log(ctx.logPrefix, `Email sent. Provider ID: ${result.messageId || "n/a"}`);
  },
};
