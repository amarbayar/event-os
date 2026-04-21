import { AgentIntent, DispatchResult } from "./types";
import { handleQuery } from "./query-handler";
import { handleManage } from "./manage-handler";
import { db } from "@/db";
import { teamMembers, teams, teamEntityTypes } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { canManageEntityByRoleAlone } from "@/lib/rbac-utils";

// ─── Agent Dispatcher ────────────────────────────────
//
//  USER INPUT → classify() → AgentIntent
//       │
//       ▼
//  dispatch(intent, ctx) → DispatchResult
//       │
//       ├── 1. Destructive intent detection (bulk/rogue)
//       ├── 2. RBAC check (role + team scope)
//       ├── 3. Route to handler
//       │     ├── query  → handleQuery()
//       │     ├── manage → handleManage()
//       │     ├── extract → pass through
//       │     └── chitchat → message
//       └── 4. Stage protection (in manage handler)

export type AgentContext = {
  orgId: string;
  editionId: string;
  userId: string;
  userRole: string;
  userName: string | null;
};

// ─── Layer 1: Destructive Intent Detection ───────────
//
//  Catches bulk/mass operations BEFORE RBAC — these are
//  dangerous regardless of role. Even admins should use
//  the UI for bulk operations, not the chat agent.
//
//  "Delete all speakers" → blocked
//  "Update every sponsor's name" → blocked
//  "Remove all booths" → blocked
//  "Delete speaker Bob" → allowed (single entity, goes to RBAC)

const BULK_PATTERNS = [
  /\b(all|every|each|entire|whole)\b.*\b(speaker|sponsor|venue|booth|volunteer|media|task|campaign|attendee)/i,
  /\b(speaker|sponsor|venue|booth|volunteer|media|task|campaign|attendee)s?\b.*\b(all|every|everything)\b/i,
  /\bdelete\b.*\bmultipl/i,
  /\bremove\b.*\b(all|every)\b/i,
  /\bwipe\b/i,
  /\bclear\b.*\b(all|every|table|data)/i,
  /\breset\b.*\b(all|every|data)/i,
  /\bstart\s*over\b/i,
  /\btruncate\b/i,
  /\bdrop\b/i,
];

function detectDestructiveBulk(
  intent: AgentIntent,
  originalInput?: string
): DispatchResult | null {
  // Only check mutations
  if (intent.intent !== "manage") return null;
  if (!intent.action || intent.action === "search") return null;

  // Check the original user input for bulk language
  const textToCheck = originalInput || intent.message || "";
  for (const pattern of BULK_PATTERNS) {
    if (pattern.test(textToCheck)) {
      if (intent.action === "delete" || intent.action === "update") {
        return {
          message: "I can only modify one record at a time. Bulk operations need to be done by an admin through the dashboard. Which specific record would you like to change?",
          success: false,
        };
      }
    }
  }

  // Agent handlers only operate on single entities (by name search).
  // This is enforced at the code level — there's no "delete where stage=X" path.
  return null;
}

// ─── Layer 2: RBAC ───────────────────────────────────
//
//  ROLE HIERARCHY (mirrors src/lib/rbac.ts):
//    owner(100) > admin(80) > organizer(60) > coordinator(40) > viewer(20) > stakeholder(10)
//
//  Rules:
//  - query/chitchat: ALL roles allowed (read-only)
//  - manage/create: organizer+ with team scope
//  - manage/update: organizer+ with team scope (coordinator can update)
//  - manage/delete: organizer+ with team scope (coordinator CANNOT delete)
//  - extract: same as create

const ROLE_LEVEL: Record<string, number> = {
  owner: 100, admin: 80, organizer: 60, coordinator: 40, viewer: 20, stakeholder: 10,
};

async function checkAgentPermission(
  intent: AgentIntent,
  ctx: AgentContext
): Promise<DispatchResult | null> {
  // Queries and chitchat are always allowed
  if (intent.intent === "query" || intent.intent === "chitchat") {
    return null;
  }

  // Stakeholders can only read
  if (ctx.userRole === "stakeholder") {
    return {
      message: "You can view event data but can't make changes through the assistant. Use the portal to update your profile and checklist.",
      success: false,
    };
  }

  // Viewers can only read
  if (ctx.userRole === "viewer") {
    return {
      message: "You have view-only access. Contact an admin to get edit permissions.",
      success: false,
    };
  }

  // Coordinators can't delete
  if (intent.intent === "manage" && intent.action === "delete" && ctx.userRole === "coordinator") {
    return {
      message: "Coordinators can't delete records. Ask an organizer or admin.",
      success: false,
    };
  }

  // Owner/admin bypass team scope
  if (ROLE_LEVEL[ctx.userRole] >= ROLE_LEVEL.admin) {
    return null;
  }

  // Coordinators are team-scoped. Organizers can manage the normal
  // event-data entities across the org without explicit team rows.
  if (intent.intent === "manage" && intent.entityType && !canManageEntityByRoleAlone(ctx.userRole, intent.entityType)) {
    const hasScope = await userOwnsEntityType(ctx.userId, intent.entityType, ctx.orgId);
    if (!hasScope) {
      return {
        message: ctx.userRole === "coordinator"
          ? `You don't have permission to manage ${intent.entityType}s. Your team doesn't cover this entity type. Ask an admin to update your team assignments.`
          : "You don't have permission to modify this resource. Contact an admin.",
        success: false,
      };
    }
  }

  return null;
}

// Duplicated from rbac.ts to avoid NextRequest dependency
async function userOwnsEntityType(
  userId: string,
  entityType: string,
  orgId: string
): Promise<boolean> {
  const result = await db
    .select({ entityType: teamEntityTypes.entityType })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .innerJoin(teamEntityTypes, eq(teams.id, teamEntityTypes.teamId))
    .where(
      and(
        eq(teamMembers.userId, userId),
        eq(teams.organizationId, orgId),
        isNull(teams.editionId),
        eq(teamEntityTypes.entityType, entityType)
      )
    )
    .limit(1);

  return result.length > 0;
}

// ─── Dispatch ────────────────────────────────────────

export async function dispatch(
  intent: AgentIntent,
  ctx: AgentContext,
  originalInput?: string
): Promise<DispatchResult> {
  try {
    // Layer 1: Block bulk/destructive operations
    const bulk = detectDestructiveBulk(intent, originalInput);
    if (bulk) return bulk;

    // Layer 2: RBAC check (role + team scope)
    const denied = await checkAgentPermission(intent, ctx);
    if (denied) return denied;

    // Layer 3: Route to handler
    switch (intent.intent) {
      case "query":
        return handleQuery(intent, ctx, originalInput);

      case "manage":
        return handleManage(intent, ctx);

      case "extract":
        return {
          message: "__EXTRACT__",
          success: true,
        };

      case "chitchat":
      default:
        return {
          message: intent.message || "I can help you query event data. Try: 'how many speakers are confirmed?' or 'list all pending sponsors.'",
          success: true,
        };
    }
  } catch (error) {
    console.error("Dispatcher error:", error);
    return {
      message: "Something went wrong processing your request. Please try again.",
      success: false,
    };
  }
}
