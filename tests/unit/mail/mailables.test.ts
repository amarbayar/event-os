import { describe, it, expect } from "vitest";
import { escapeHtml } from "@/lib/mail/templates/base-layout";
import { portalInvite } from "@/lib/mail/mailables/portal-invite";
import { portalAdded } from "@/lib/mail/mailables/portal-added";

describe("escapeHtml", () => {
  it("escapes all 5 HTML special characters", () => {
    const input = `<script>alert("it's & dangerous")</script>`;
    const result = escapeHtml(input);

    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
    expect(result).not.toContain('"');
    expect(result).toContain("&lt;");
    expect(result).toContain("&gt;");
    expect(result).toContain("&quot;");
    expect(result).toContain("&#39;");
    expect(result).toContain("&amp;");
  });
});

describe("portalInvite", () => {
  it("returns correct subject and html with escaped data", () => {
    const mailable = portalInvite({
      name: "Alice",
      tempPassword: "abc123",
      portalUrl: "/portal",
      organizationName: "DevCon",
    });

    expect(mailable.subject).toBe("You're invited to the DevCon portal");
    expect(mailable.html).toContain("Hello Alice");
    expect(mailable.html).toContain("abc123");
    expect(mailable.html).toContain("/portal");
    expect(mailable.html).toContain("DevCon");
    expect(mailable.tags).toEqual(["portal-invite"]);
    expect(mailable.text).toContain("Alice");
  });

  it("escapes XSS in name field", () => {
    const mailable = portalInvite({
      name: '<script>alert("xss")</script>',
      tempPassword: "abc123",
      portalUrl: "/portal",
      organizationName: "DevCon",
    });

    expect(mailable.html).not.toContain("<script>");
    expect(mailable.html).toContain("&lt;script&gt;");
  });
});

describe("portalAdded", () => {
  it("returns correct subject and html without password", () => {
    const mailable = portalAdded({
      name: "Bob",
      portalUrl: "/portal",
      organizationName: "TechFest",
    });

    expect(mailable.subject).toBe("You've been added to TechFest");
    expect(mailable.html).toContain("Hello Bob");
    expect(mailable.html).toContain("TechFest");
    expect(mailable.html).not.toContain("password");
    expect(mailable.tags).toEqual(["portal-added"]);
  });
});
