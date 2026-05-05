import { describe, expect, it } from "vitest";
import { formatEventDates } from "@/app/events/[slug]/event-workspace-shell";

describe("formatEventDates", () => {
  it("formats event dates in UTC so SSR and browser hydration agree", () => {
    expect(
      formatEventDates("2026-05-30T00:00:00.000Z", "2026-05-31T00:00:00.000Z")
    ).toBe("May 30–31, 2026");
  });
});
