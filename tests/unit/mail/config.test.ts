import { describe, it, expect, beforeEach } from "vitest";
import { getMailConfig } from "@/lib/mail/config";

describe("getMailConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Clear all mail-related env vars
    delete process.env.MAIL_DRIVER;
    delete process.env.MAIL_FROM_ADDRESS;
    delete process.env.MAIL_FROM_NAME;
    delete process.env.MAILGUN_API_KEY;
    delete process.env.MAILGUN_DOMAIN;
    delete process.env.MAILGUN_REGION;
    delete process.env.POSTMARK_SERVER_TOKEN;
  });

  it("defaults to log driver when MAIL_DRIVER is not set", () => {
    const config = getMailConfig();
    expect(config.driver).toBe("log");
    expect(config.from.email).toBe("noreply@example.com");
    expect(config.from.name).toBe("Event OS");
  });

  it("returns log config when MAIL_DRIVER=log", () => {
    process.env.MAIL_DRIVER = "log";
    process.env.MAIL_FROM_ADDRESS = "test@example.com";
    process.env.MAIL_FROM_NAME = "Test App";

    const config = getMailConfig();
    expect(config.driver).toBe("log");
    expect(config.from.email).toBe("test@example.com");
    expect(config.from.name).toBe("Test App");
  });

  it("returns mailgun config with valid keys", () => {
    process.env.MAIL_DRIVER = "mailgun";
    process.env.MAILGUN_API_KEY = "key-test123";
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    process.env.MAILGUN_REGION = "eu";

    const config = getMailConfig();
    expect(config.driver).toBe("mailgun");
    expect(config.mailgun).toEqual({
      apiKey: "key-test123",
      domain: "mg.example.com",
      region: "eu",
    });
  });

  it("returns postmark config with valid keys", () => {
    process.env.MAIL_DRIVER = "postmark";
    process.env.POSTMARK_SERVER_TOKEN = "test-token";

    const config = getMailConfig();
    expect(config.driver).toBe("postmark");
    expect(config.postmark).toEqual({ serverToken: "test-token" });
  });

  it("throws when MAIL_DRIVER=mailgun but MAILGUN_API_KEY is missing", () => {
    process.env.MAIL_DRIVER = "mailgun";
    process.env.MAILGUN_DOMAIN = "mg.example.com";

    expect(() => getMailConfig()).toThrow("MAILGUN_API_KEY is required");
  });

  it("throws on unknown driver", () => {
    process.env.MAIL_DRIVER = "sendgrid";
    expect(() => getMailConfig()).toThrow('Invalid MAIL_DRIVER="sendgrid"');
  });
});
