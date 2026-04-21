const TEAM_SCOPE_EXEMPT_ENTITIES = new Set([
  // Tasks live on the edition task board rather than the org-wide RBAC team/entity map.
  "task",
]);

const ORGANIZER_MANAGED_ENTITIES = new Set([
  // Organizers are cross-functional event operators. They can manage the
  // normal event-data entities without needing explicit org-wide team rows.
  "speaker",
  "session",
  "sponsor",
  "outreach",
  "venue",
  "booth",
  "volunteer",
  "media",
  "attendee",
  "campaign",
]);

export function resolveEffectiveRole(
  sessionRole: string | null | undefined,
  membershipRole: string | null | undefined,
): string {
  return membershipRole || sessionRole || "viewer";
}

export function requiresTeamScope(entityType: string): boolean {
  return !TEAM_SCOPE_EXEMPT_ENTITIES.has(entityType);
}

export function canManageEntityByRoleAlone(role: string, entityType: string): boolean {
  if (!requiresTeamScope(entityType)) return true;
  return role === "organizer" && ORGANIZER_MANAGED_ENTITIES.has(entityType);
}
