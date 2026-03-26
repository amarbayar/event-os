export type MailAddress = {
  email: string;
  name?: string;
};

export type MailEnvelope = {
  to: MailAddress[];
  cc?: MailAddress[];
  bcc?: MailAddress[];
  replyTo?: MailAddress;
  subject: string;
  html: string;
  text?: string;
  tags?: string[];
  metadata?: Record<string, string>;
};

export type SendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export interface MailDriver {
  name: string;
  send(envelope: MailEnvelope, from: MailAddress): Promise<SendResult>;
}

export type Mailable = {
  subject: string;
  html: string;
  text?: string;
  tags?: string[];
};
