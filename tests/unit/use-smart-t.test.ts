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

describe("useSmartT", () => {
  it("returns existing translation", () => {
    const t = useSmartT("Common");

    const result = t("exists", "Fallback");

    expect(result).toBe("Translated");
  });

  it("falls back to the provided string when missing", () => {
    const t = useSmartT("Common");

    const result = t("missing", "Fallback");

    expect(result).toBe("Fallback");
  });
});
