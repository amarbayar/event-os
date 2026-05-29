import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("coordinator check-in UI confinement", () => {
  it("redirects coordinators away from sensitive attendee and ticket pages", () => {
    for (const page of ["tickets", "attendees", "invitations"]) {
      const source = readFileSync(
        join(root, `src/app/events/[slug]/${page}/page.tsx`),
        "utf8",
      );

      expect(source).toContain("redirectCoordinatorFromSensitiveEventPage");
    }
  });

  it("shows only check-in navigation for coordinators", () => {
    const source = readFileSync(join(root, "src/components/sidebar.tsx"), "utf8");

    expect(source).toContain('userRole === "coordinator"');
    expect(source).toContain('href === "/check-in"');
    expect(source).toContain('userRole !== "coordinator"');
  });
});
