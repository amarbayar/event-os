// tests/integration/translate.test.ts

import { describe, it, expect } from "vitest";
import { translateText } from "@/lib/i18n/translate";

const hasGeminiKey = !!process.env.GEMINI_API_KEY;

describe("translateText (Gemini)", () => {
  if (!hasGeminiKey) {
    it.skip("skipped: GEMINI_API_KEY not set", () => {});
    return;
  }

  it("translates English to Mongolian", async () => {
    const result = await translateText("Dashboard", {
      target: "Mongolian",
    });

    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    expect(result).not.toBe("Dashboard");
  });
});
