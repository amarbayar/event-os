const TEAM_SCOPE_EXEMPT_ENTITIES = new Set([
  // Tasks live on the edition task board rather than the org-wide RBAC team/entity map.
  "task",
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
