import type { MailDriver, MailEnvelope, MailAddress, SendResult } from "../types";

type PostmarkConfig = {
  serverToken: string;
};

export class PostmarkDriver implements MailDriver {
  name = "postmark";
  private config: PostmarkConfig;

  constructor(config: PostmarkConfig) {
    this.config = config;
  }

  async send(envelope: MailEnvelope, from: MailAddress): Promise<SendResult> {
    const url = "https://api.postmarkapp.com/email";

    const toAddresses = envelope.to
      .map((r) => r.name ? `${r.name} <${r.email}>` : r.email)
      .join(", ");

    const body: Record<string, unknown> = {
      From: from.name ? `${from.name} <${from.email}>` : from.email,
      To: toAddresses,
      Subject: envelope.subject,
      HtmlBody: envelope.html,
    };

    if (envelope.text) {
      body.TextBody = envelope.text;
    }

    if (envelope.tags && envelope.tags.length > 0) {
      body.Tag = envelope.tags[0]; // Postmark supports a single tag per message
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": this.config.serverToken,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        success: false,
        error: `Postmark ${response.status}: ${text}`,
      };
    }

    const data = await response.json() as { MessageID?: string };
    return {
      success: true,
      messageId: data.MessageID || undefined,
    };
  }
}
