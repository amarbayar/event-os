import { AgentIntent, DispatchResult } from "./types";
import { handleQuery } from "./query-handler";
import { handleManage } from "./manage-handler";

// ─── Agent Dispatcher ────────────────────────────────
//
//  USER INPUT → classify() → AgentIntent
//       │
//       ▼
//  dispatch(intent, ctx) → routes to handler → DispatchResult
//       │
//       ├── query  → handleQuery() — read-only DB queries
//       ├── extract → pass through to existing extraction
//       ├── manage → RBAC check → handleManage()
//       └── chitchat → return message as-is

export type AgentContext = {
  orgId: string;
  editionId: string;
  userId: string;
  userRole: string;
  userName: string | null;
};

// ─── RBAC for agent actions ──────────────────────────
//
//  ROLE HIERARCHY (mirrors src/lib/rbac.ts):
//    owner(100) > admin(80) > organizer(60) > coordinator(40) > viewer(20) > stakeholder(10)
//
//  Rules:
//  - query: ALL roles allowed (read-only)
//  - manage/create: viewer and stakeholder blocked
//  - manage/update: viewer and stakeholder blocked
//  - manage/delete: viewer, stakeholder, and coordinator blocked
//  - extract: viewer and stakeholder blocked (creates entities)

const ROLE_LEVEL: Record<string, number> = {
  owner: 100, admin: 80, organizer: 60, coordinator: 40, viewer: 20, stakeholder: 10,
};

function checkAgentPermission(
  intent: AgentIntent,
  ctx: AgentContext
): DispatchResult | null {
  const level = ROLE_LEVEL[ctx.userRole] || 0;

  // Queries are always allowed — read-only
  if (intent.intent === "query" || intent.intent === "chitchat") {
    return null; // allowed
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
      message: "Coordinators can't delete records. Ask an organizer or admin to delete this.",
      success: false,
    };
  }

  // Organizer, admin, owner — allowed for create/update
  // Coordinator — allowed for create/update only
  return null; // allowed
}

export async function dispatch(
  intent: AgentIntent,
  ctx: AgentContext
): Promise<DispatchResult> {
  try {
    // RBAC check before any mutation
    const denied = checkAgentPermission(intent, ctx);
    if (denied) return denied;

    switch (intent.intent) {
      case "query":
        return handleQuery(intent, ctx);

      case "manage":
        return handleManage(intent, ctx);

      case "extract":
        // Pass through — the chat panel handles extraction via the existing flow
        return {
          message: "__EXTRACT__", // sentinel value: chat panel uses extract() instead
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
