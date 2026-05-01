import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import enMessages from "../../messages/en.json";
import mnMessages from "../../messages/mn.json";

const root = process.cwd();

describe("ticket workspace navigation", () => {
  it("links the event sidebar to ticket sales with translated labels", () => {
    const sidebar = readFileSync(join(root, "src/components/sidebar.tsx"), "utf8");

    expect(sidebar).toContain('href: "/tickets"');
    expect(sidebar).toContain('labelKey: "tickets"');
    expect(enMessages.Nav.tickets).toBe("Tickets");
    expect(mnMessages.Nav.tickets).toBeTruthy();
  });
});
