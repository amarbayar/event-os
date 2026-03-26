import { describe, it, expect, vi, beforeEach } from "vitest";

// Track all DB insert calls
const insertedRows: Record<string, unknown>[] = [];
const mockFindFirst = vi.fn();

// Mock the db module before importing mail
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn((vals: Record<string, unknown>) => {
        insertedRows.push(vals);
        return Promise.resolve();
      }),
    }),
    query: {
      emailLog: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
  },
}));

// Mock the schema module
vi.mock("@/db/schema", () => ({
  emailLog: { subject: "subject", entityId: "entity_id", createdAt: "created_at" },
}));

// Mock drizzle-orm operators
vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((a: unknown, b: unknown) => ({ op: "eq", a, b })),
  gte: vi.fn((a: unknown, b: unknown) => ({ op: "gte", a, b })),
}));

import { mail } from "@/lib/mail";
import type { Mailable, MailAddress } from "@/lib/mail/types";

const testTo: MailAddress = { email: "alice@example.com", name: "Alice" };
const testMailable: Mailable = {
  subject: "Test Email",
  html: "<p>Hello</p>",
  text: "Hello",
  tags: ["test"],
};

describe("mail()", () => {
  beforeEach(() => {
    insertedRows.length = 0;
    mockFindFirst.mockReset().mockResolvedValue(null);
    process.env.MAIL_DRIVER = "log";
    delete process.env.MAILGUN_API_KEY;
    delete process.env.MAILGUN_DOMAIN;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("sends successfully and logs to DB with status=sent", async () => {
    const result = await mail(testTo, testMailable, {
      orgId: "org-1",
      entityType: "speaker",
      entityId: "entity-1",
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^log-/);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toMatchObject({
      driver: "log",
      status: "sent",
      subject: "Test Email",
      toEmails: ["alice@example.com"],
      organizationId: "org-1",
      entityType: "speaker",
      entityId: "entity-1",
    });
  });

  it("returns success even when DB insert fails", async () => {
    // Make the db.insert().values() reject
    const { db } = await import("@/db");
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      values: vi.fn().mockRejectedValue(new Error("DB connection lost")),
    });

    const result = await mail(testTo, testMailable);

    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^log-/);
  });

  it("returns failure when send fails and logs error to DB", async () => {
    process.env.MAIL_DRIVER = "mailgun";
    process.env.MAILGUN_API_KEY = "bad-key";
    process.env.MAILGUN_DOMAIN = "mg.example.com";

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    }));

    const result = await mail(testTo, testMailable, { orgId: "org-1" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Mailgun 500");
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toMatchObject({
      status: "failed",
      error: expect.stringContaining("Mailgun 500"),
    });
  });

  it("skips sending when duplicate detected within 5 minutes", async () => {
    mockFindFirst.mockResolvedValue({ id: "existing-log-id" });

    const result = await mail(testTo, testMailable, { entityId: "entity-1" });

    expect(result.success).toBe(true);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toMatchObject({
      status: "skipped",
      error: expect.stringContaining("Deduplicated"),
    });
  });

  it("normalizes a single recipient to an array", async () => {
    const result = await mail({ email: "single@example.com" }, testMailable);

    expect(result.success).toBe(true);
    expect(insertedRows[0]?.toEmails).toEqual(["single@example.com"]);
  });
});
