import { describe, expect, it } from "vitest";
import { canManageEntityByRoleAlone, requiresTeamScope, resolveEffectiveRole } from "@/lib/rbac-utils";

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

  it("lets organizers manage event entities without explicit team rows", () => {
    expect(canManageEntityByRoleAlone("organizer", "venue")).toBe(true);
    expect(canManageEntityByRoleAlone("organizer", "campaign")).toBe(true);
  });

  it("does not grant organizers admin-only surfaces by role alone", () => {
    expect(canManageEntityByRoleAlone("organizer", "user")).toBe(false);
    expect(canManageEntityByRoleAlone("organizer", "settings")).toBe(false);
  });

  it("keeps coordinators team-scoped for event entities", () => {
    expect(canManageEntityByRoleAlone("coordinator", "venue")).toBe(false);
  });
});
