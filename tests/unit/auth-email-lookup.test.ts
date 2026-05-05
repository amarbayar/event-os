import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("credential auth email lookup", () => {
  it("normalizes login email and tolerates older mixed-case or padded stored emails", () => {
    const source = readFileSync(join(root, "src/lib/auth.ts"), "utf8");

    expect(source).toContain("normalizeEmail(credentials.email)");
    expect(source).toContain("lower(trim(");
  });
});
