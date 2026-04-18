import { describe, expect, it } from "vitest";
import { requiresTeamScope, resolveEffectiveRole } from "@/lib/rbac-utils";

describe("RBAC helpers", () => {
  it("prefers the membership role over the session role", () => {
    expect(resolveEffectiveRole("viewer", "organizer")).toBe("organizer");
  });

  it("falls back to the session role when no membership role is present", () => {
    expect(resolveEffectiveRole("coordinator", null)).toBe("coordinator");
  });

  it("treats tasks as exempt from org-wide team scope", () => {
    expect(requiresTeamScope("task")).toBe(false);
  });

  it("still requires team scope for normal entity types", () => {
    expect(requiresTeamScope("speaker")).toBe(true);
  });
});
