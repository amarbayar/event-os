import type { MailDriver, MailEnvelope, MailAddress, SendResult } from "../types";

type MailgunConfig = {
  apiKey: string;
  domain: string;
  region: "us" | "eu";
};

export class MailgunDriver implements MailDriver {
  name = "mailgun";
  private config: MailgunConfig;

  constructor(config: MailgunConfig) {
    this.config = config;
  }

  async send(envelope: MailEnvelope, from: MailAddress): Promise<SendResult> {
    const baseUrl = this.config.region === "eu"
      ? "https://api.eu.mailgun.net"
      : "https://api.mailgun.net";

    const url = `${baseUrl}/v3/${this.config.domain}/messages`;

    const formData = new FormData();
    formData.append("from", from.name ? `${from.name} <${from.email}>` : from.email);

    for (const recipient of envelope.to) {
      formData.append("to", recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email);
    }

    formData.append("subject", envelope.subject);
    formData.append("html", envelope.html);

    if (envelope.text) {
      formData.append("text", envelope.text);
    }

    if (envelope.tags) {
      for (const tag of envelope.tags) {
        formData.append("o:tag", tag);
      }
    }

    const auth = Buffer.from(`api:${this.config.apiKey}`).toString("base64");

    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}` },
      body: formData,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        success: false,
        error: `Mailgun ${response.status}: ${body}`,
      };
    }

    const data = await response.json() as { id?: string };
    return {
      success: true,
      messageId: data.id || undefined,
    };
  }
}
