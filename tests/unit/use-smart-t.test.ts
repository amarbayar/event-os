// tests/unit/use-smart-t.test.ts

import { describe, it, expect, vi } from "vitest";
import { useSmartT } from "@/lib/hooks/use-smart-t";

// mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => {
    const fn = (key: string) => {
      if (key === "exists") return "Translated";
      throw new Error("missing");
    };
    fn.has = (key: string) => key === "exists";
    return fn;
  },
}));

vi.mock("@/lib/hooks/use-ai-translation", () => ({
  useAiTranslation: (text: string) => `AI:${text}`,
}));

describe("useSmartT", () => {
  it("returns existing translation", () => {
    const t = useSmartT("Common");

    const result = t("exists", "Fallback");

    expect(result).toBe("Translated");
  });

  it("falls back to AI when missing", () => {
    const t = useSmartT("Common");

    const result = t("missing", "Fallback");

    expect(result).toBe("AI:Fallback");
  });
});
