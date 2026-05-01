import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("public API middleware access", () => {
  it("allows unauthenticated /api/public routes for landing-page buyers", () => {
    const middleware = readFileSync(join(process.cwd(), "src/middleware.ts"), "utf8");

    expect(middleware).toContain('"/api/public"');
  });

  it("allows Bonum to call the payment webhook without a browser session", () => {
    const middleware = readFileSync(join(process.cwd(), "src/middleware.ts"), "utf8");

    expect(middleware).toContain('"/api/payments/bonum/webhook"');
  });
});
