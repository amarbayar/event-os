import { randomUUID } from "crypto";
import type { MailDriver, MailEnvelope, MailAddress, SendResult } from "../types";

export class LogDriver implements MailDriver {
  name = "log";

  async send(envelope: MailEnvelope, from: MailAddress): Promise<SendResult> {
    const recipients = envelope.to.map((r) => r.name ? `${r.name} <${r.email}>` : r.email).join(", ");
    const messageId = `log-${randomUUID()}`;

    console.log(
      `[Mail:log] From: ${from.name ? `${from.name} <${from.email}>` : from.email}\n` +
      `  To: ${recipients}\n` +
      `  Subject: ${envelope.subject}\n` +
      `  MessageId: ${messageId}`
    );

    return { success: true, messageId };
  }
}
