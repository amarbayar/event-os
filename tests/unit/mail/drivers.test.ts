import { describe, it, expect, vi, beforeEach } from "vitest";
import { LogDriver } from "@/lib/mail/drivers/log";
import { MailgunDriver } from "@/lib/mail/drivers/mailgun";
import { PostmarkDriver } from "@/lib/mail/drivers/postmark";
import type { MailEnvelope, MailAddress } from "@/lib/mail/types";

const testFrom: MailAddress = { email: "noreply@example.com", name: "Test" };
const testEnvelope: MailEnvelope = {
  to: [{ email: "alice@example.com", name: "Alice" }],
  subject: "Test Subject",
  html: "<p>Hello</p>",
  text: "Hello",
};

describe("LogDriver", () => {
  it("returns success with a log- prefixed messageId", async () => {
    const driver = new LogDriver();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await driver.send(testEnvelope, testFrom);

    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^log-/);
    expect(consoleSpy).toHaveBeenCalledOnce();

    consoleSpy.mockRestore();
  });
});

describe("MailgunDriver", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends successfully and returns messageId", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "<msg-123@mailgun.org>" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const driver = new MailgunDriver({ apiKey: "key-test", domain: "mg.example.com", region: "us" });
    const result = await driver.send(testEnvelope, testFrom);

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("<msg-123@mailgun.org>");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.mailgun.net/v3/mg.example.com/messages",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("returns failure on 401 response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });
    vi.stubGlobal("fetch", mockFetch);

    const driver = new MailgunDriver({ apiKey: "bad-key", domain: "mg.example.com", region: "us" });
    const result = await driver.send(testEnvelope, testFrom);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Mailgun 401");
  });
});

describe("PostmarkDriver", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends successfully and returns MessageID", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ MessageID: "pm-456" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const driver = new PostmarkDriver({ serverToken: "test-token" });
    const result = await driver.send(testEnvelope, testFrom);

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("pm-456");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.postmarkapp.com/email",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Postmark-Server-Token": "test-token",
        }),
      })
    );
  });

  it("returns failure on error response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => '{"ErrorCode":300,"Message":"Invalid email"}',
    });
    vi.stubGlobal("fetch", mockFetch);

    const driver = new PostmarkDriver({ serverToken: "test-token" });
    const result = await driver.send(testEnvelope, testFrom);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Postmark 422");
  });
});
