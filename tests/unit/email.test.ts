import { describe, expect, it } from "vitest";
import { normalizeEmail } from "@/lib/email";

describe("normalizeEmail", () => {
  it("keeps hyphenated email local-parts valid while trimming and lowercasing", () => {
    expect(normalizeEmail("  Speaker-Test@Example.COM  ")).toBe("speaker-test@example.com");
  });
});
