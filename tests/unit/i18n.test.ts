import { describe, it, expect } from "vitest";
import enMessages from "../../messages/en.json";
import mnMessages from "../../messages/mn.json";
import { formatDate, formatTime } from "@/lib/i18n/date";

describe("Translation files", () => {
  it("en.json has all required namespaces", () => {
    expect(enMessages).toHaveProperty("Common");
    expect(enMessages).toHaveProperty("Nav");
    expect(enMessages).toHaveProperty("Dashboard");
    expect(enMessages).toHaveProperty("Notifications");
    expect(enMessages).toHaveProperty("Validation");
    expect(enMessages).toHaveProperty("Auth");
    expect(enMessages).toHaveProperty("Locale");
  });

  it("mn.json has the same top-level keys as en.json", () => {
    const enKeys = Object.keys(enMessages).sort();
    const mnKeys = Object.keys(mnMessages).sort();
    expect(mnKeys).toEqual(enKeys);
  });

  it("mn.json has the same keys within each namespace as en.json", () => {
    for (const ns of Object.keys(enMessages) as (keyof typeof enMessages)[]) {
      const enKeys = Object.keys(enMessages[ns]).sort();
      const mnKeys = Object.keys(mnMessages[ns]).sort();
      expect(mnKeys, `Namespace "${ns}" keys mismatch`).toEqual(enKeys);
    }
  });

  it("en.json Nav namespace has expected keys for sidebar", () => {
    const nav = enMessages.Nav;
    expect(nav.dashboard).toBe("Dashboard");
    expect(nav.speakers).toBe("Speakers");
    expect(nav.sponsors).toBe("Sponsors");
    expect(nav.settings).toBe("Settings");
  });

  it("en.json Notifications namespace has ICU params", () => {
    const notif = enMessages.Notifications;
    expect(notif.assigned).toContain("{entity}");
    expect(notif.stageChanged).toContain("{entity}");
    expect(notif.stageChanged).toContain("{stage}");
  });
});

describe("Date formatting utility", () => {
  const testDate = new Date("2026-03-15T14:30:00Z");

  it("formatDate with en locale uses en-US format", () => {
    const result = formatDate(testDate, "en");
    expect(result).toContain("March");
    expect(result).toContain("15");
    expect(result).toContain("2026");
  });

  it("formatDate with mn locale uses mn-MN format", () => {
    const result = formatDate(testDate, "mn");
    // Mongolian date formatting includes Mongolian month names
    expect(result).toBeTruthy();
    expect(result).toContain("2026");
  });

  it("formatDate with custom options", () => {
    const result = formatDate(testDate, "en", { month: "short", day: "numeric" });
    expect(result).toContain("Mar");
    expect(result).toContain("15");
  });

  it("formatTime returns HH:MM format", () => {
    const result = formatTime(testDate, "en");
    // 14:30 UTC — exact output depends on timezone, but format should be HH:MM
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  it("formatDate accepts string input", () => {
    const result = formatDate("2026-03-15", "en");
    expect(result).toContain("2026");
  });

  it("formatDate falls back to en-US for unknown locale", () => {
    const result = formatDate(testDate, "xx");
    expect(result).toContain("2026");
  });
});
