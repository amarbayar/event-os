import { AgentIntent, DispatchResult } from "./types";
import { handleQuery } from "./query-handler";

// ─── Agent Dispatcher ────────────────────────────────
//
//  USER INPUT → classify() → AgentIntent
//       │
//       ▼
//  dispatch(intent, ctx) → routes to handler → DispatchResult
//       │
//       ├── query  → handleQuery() — read-only DB queries
//       ├── extract → pass through to existing extraction
//       ├── manage → stub (Phase 1b)
//       └── chitchat → return message as-is

export type AgentContext = {
  orgId: string;
  editionId: string;
  userId: string;
  userRole: string;
  userName: string | null;
};

export async function dispatch(
  intent: AgentIntent,
  ctx: AgentContext
): Promise<DispatchResult> {
  try {
    switch (intent.intent) {
      case "query":
        return handleQuery(intent, ctx);

      case "manage":
        // Phase 1b stub — acknowledge but don't execute
        return {
          message: `I understand you want to ${intent.action} a ${intent.entityType}. This feature is coming soon — for now, use the web UI to make changes.`,
          success: true,
        };

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
