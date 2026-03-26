import { describe, it, expect } from "vitest";

// Mirror the validation logic from src/app/api/me/locale/route.ts
const SUPPORTED_LOCALES = ["en", "mn"];

function isValidLocale(locale: unknown): boolean {
  return typeof locale === "string" && SUPPORTED_LOCALES.includes(locale);
}

describe("Locale validation", () => {
  it("accepts 'en'", () => {
    expect(isValidLocale("en")).toBe(true);
  });

  it("accepts 'mn'", () => {
    expect(isValidLocale("mn")).toBe(true);
  });

  it("rejects unsupported locale 'fr'", () => {
    expect(isValidLocale("fr")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidLocale("")).toBe(false);
  });

  it("rejects null", () => {
    expect(isValidLocale(null)).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isValidLocale(undefined)).toBe(false);
  });
});
