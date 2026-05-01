import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("check-in scanner client", () => {
  it("uses real QR scanning and posts scans to the protected check-in API", () => {
    const source = readFileSync(join(root, "src/app/events/[slug]/check-in/client.tsx"), "utf8");
    const page = readFileSync(join(root, "src/app/events/[slug]/check-in/page.tsx"), "utf8");

    expect(source).toContain('import("html5-qrcode")');
    expect(source).toContain("/api/check-in");
    expect(source).toContain("editionId");
    expect(source).toContain("stationId");
    expect(source).toContain("Manual check-in");
    expect(source).toContain("email: string");
    expect(source).toContain("a.email.toLowerCase().includes(query)");
    expect(source).toContain("Search attendees by name, email, or ticket type");
    expect(source).not.toContain("Math.random");
    expect(source).not.toContain("Simulate Scan");
    expect(page).toContain("getActiveIds");
    expect(page).toContain("editionId={ids?.editionId");
  });
});
