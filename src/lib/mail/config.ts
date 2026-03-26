import type { MailAddress } from "./types";

export type MailDriverName = "mailgun" | "postmark" | "log";

export type MailConfig = {
  driver: MailDriverName;
  from: MailAddress;
  mailgun?: { apiKey: string; domain: string; region: "us" | "eu" };
  postmark?: { serverToken: string };
};

const VALID_DRIVERS: MailDriverName[] = ["mailgun", "postmark", "log"];

/**
 * Resolve mail config from environment variables.
 * Called at send time (not module load) for testability.
 * Throws if driver-specific keys are missing.
 */
export function getMailConfig(): MailConfig {
  const driver = (process.env.MAIL_DRIVER || "log") as MailDriverName;

  if (!VALID_DRIVERS.includes(driver)) {
    throw new Error(
      `Invalid MAIL_DRIVER="${driver}". Must be one of: ${VALID_DRIVERS.join(", ")}`
    );
  }

  const from: MailAddress = {
    email: process.env.MAIL_FROM_ADDRESS || "noreply@example.com",
    name: process.env.MAIL_FROM_NAME || "Event OS",
  };

  const config: MailConfig = { driver, from };

  if (driver === "mailgun") {
    const apiKey = process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN;
    if (!apiKey) throw new Error("MAILGUN_API_KEY is required when MAIL_DRIVER=mailgun");
    if (!domain) throw new Error("MAILGUN_DOMAIN is required when MAIL_DRIVER=mailgun");
    const region = (process.env.MAILGUN_REGION || "us") as "us" | "eu";
    config.mailgun = { apiKey, domain, region };
  }

  if (driver === "postmark") {
    const serverToken = process.env.POSTMARK_SERVER_TOKEN;
    if (!serverToken) throw new Error("POSTMARK_SERVER_TOKEN is required when MAIL_DRIVER=postmark");
    config.postmark = { serverToken };
  }

  return config;
}
