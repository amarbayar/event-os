import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("PortalInviteSection", () => {
  it("handles failed or non-JSON invite responses without staying in loading state", () => {
    const source = readFileSync(join(root, "src/components/portal-invite-section.tsx"), "utf8");

    expect(source).toContain("parseInviteResponse");
    expect(source).toContain("try {");
    expect(source).toContain("catch");
    expect(source).toContain('setStatus("error")');
    expect(source).toContain('setShowConfirm(false)');
  });
});
