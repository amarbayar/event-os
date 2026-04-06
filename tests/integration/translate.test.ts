// tests/integration/translate.test.ts

import { describe, it, expect } from "vitest";
import { translateText } from "@/lib/i18n/translate";

const hasKey = !!process.env.GEMINI_API_KEY;

describe("translateText", () => {
  (hasKey ? it : it.skip)("translates English to Mongolian", async () => {
    const result = await translateText("Dashboard", {
      target: "Mongolian",
    });

    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    expect(result).not.toBe("Dashboard");
  });
});
