import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProvider } from "@/lib/agent";
import { InputType, AgentResponse } from "@/lib/agent/types";
import { dispatch, AgentContext } from "@/lib/agent/dispatcher";
import { getActiveIds } from "@/lib/queries";
import { gateMention, sanitizeInput, isOffTopic } from "@/lib/agent/input-guard";
import { validateServiceToken } from "@/lib/service-token";

// Rate limiter
const rateLimiter = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimiter.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimiter.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  let userId: string;
  let orgId: string;
  let role: string;
  let userName: string | null;

  // Auth: service token (bot relay) or session (web UI)
  if (validateServiceToken(req)) {
    // Service token path — bot relay passes the user's identity
    orgId = req.headers.get("x-organization-id") || "";
    if (!orgId) {
      return NextResponse.json({ error: "x-organization-id header required" }, { status: 400 });
    }
    // Body is parsed below; we'll read platform identity fields from it
    const body = await req.json();
    userId = (body.userId as string) || "service";
    role = (body.userRole as string) || "viewer"; // REAL user's role, not admin
    userName = (body.userName as string) || null;

    if (!checkRateLimit(userId)) {
      return NextResponse.json({ error: "Rate limited. Please wait a moment." }, { status: 429 });
    }

    // Service token calls come from bot relay which already handled user routing.
    // Override source to "api" so @mention gating is skipped.
    body.source = "api";

    return handleRequest(req, body, userId, orgId, role, userName);
  }

  // Session auth path — web UI
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  userId = session.user.id;
  orgId = session.user.organizationId as string;
  role = session.user.role || "viewer";
  userName = session.user.name || null;

  if (!checkRateLimit(userId)) {
    return NextResponse.json({ error: "Rate limited. Please wait a moment." }, { status: 429 });
  }

  const body = await req.json();
  return handleRequest(req, body, userId, orgId, role, userName);
}

async function handleRequest(
  req: NextRequest,
  body: Record<string, unknown>,
  userId: string,
  orgId: string,
  role: string,
  userName: string | null,
) {
  const { input, inputType, editionId, context, mode } = body as {
    input: string;
    inputType?: InputType;
    editionId?: string;
    context?: string;
    mode?: "classify" | "extract";
  };

  // Sanitize context to prevent injection via conversation history
  const sanitizedContext = context ? sanitizeInput(context).sanitized : undefined;

  if (!input) {
    return NextResponse.json({ error: "input is required" }, { status: 400 });
  }

  if (input.length > 50_000) {
    return NextResponse.json({ error: "Input too long. Maximum 50,000 characters." }, { status: 400 });
  }

  // Determine source platform (web UI by default, can be overridden by bots)
  const source = (body.source as "web" | "telegram" | "discord" | "whatsapp" | "api") || "web";

  // Layer 1: @mention gating — in group chats, only respond when mentioned
  const gate = gateMention(input, source);
  if (!gate.shouldProcess) {
    return NextResponse.json({
      data: { message: "", intent: "ignored", success: true, entities: [], actions: [], questions: [] },
      provider: "none",
    });
  }
  const gatedInput = gate.cleanedInput;

  // Layer 2: Prompt injection defense — sanitize before sending to LLM
  const sanitized = sanitizeInput(gatedInput);
  if (sanitized.blocked) {
    return NextResponse.json({
      data: {
        message: sanitized.blockReason || "I can only help with event management tasks.",
        intent: "blocked", success: false, entities: [], actions: [], questions: [],
      },
      provider: "none",
    });
  }
  if (sanitized.flags.length > 0) {
    console.warn("Agent input guard flags:", sanitized.flags, "userId:", userId);
  }

  // Layer 3: Off-topic detection — reject non-event requests before spending tokens
  const offTopic = isOffTopic(sanitized.sanitized);
  if (offTopic.offTopic) {
    return NextResponse.json({
      data: {
        message: offTopic.message, intent: "chitchat", success: true,
        entities: [], actions: [], questions: [],
      },
      provider: "none",
    });
  }

  // Resolve edition
  const ids = await getActiveIds(orgId);
  const resolvedEditionId = editionId || ids?.editionId || "";
  const resolvedOrgId = ids?.orgId || orgId;

  try {
    const provider = await getProvider(resolvedOrgId);

    // Decide: classify (smart routing) or extract (bulk import)
    const useClassify = mode !== "extract" && (inputType === "text" || !inputType);

    if (useClassify) {
      // Smart agent: classify intent → dispatch
      const intent = await provider.classify(sanitized.sanitized, sanitizedContext);

      // If the classifier says "extract", fall through to extraction
      if (intent.intent === "extract") {
        return handleExtract(provider, input, inputType || "text", sanitizedContext, resolvedOrgId, resolvedEditionId);
      }

      // Dispatch the intent
      const agentCtx: AgentContext = {
        orgId: resolvedOrgId,
        editionId: resolvedEditionId,
        userId,
        userRole: role,
        userName,
      };

      const result = await dispatch(intent, agentCtx, sanitized.sanitized);

      return NextResponse.json({
        data: {
          message: result.message,
          intent: intent.intent,
          entityType: intent.entityType,
          action: intent.action,
          success: result.success,
          // Include empty arrays for backward compat with chat panel
          entities: [],
          actions: [],
          questions: [],
        },
        provider: provider.name,
      });
    }

    // Bulk extraction mode (CSV, file, or explicit mode=extract)
    return handleExtract(provider, input, inputType || "text", sanitizedContext, resolvedOrgId, resolvedEditionId);

  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent processing failed";
    return NextResponse.json({
      data: {
        message: "Agent temporarily unavailable. Try again or use manual add.",
        entities: [],
        actions: [],
        questions: [],
      },
      error: message,
    }, { status: 502 });
  }
}

// Existing extraction flow (backward compatible)
async function handleExtract(
  provider: { extract: (input: string, inputType: InputType, context?: string) => Promise<AgentResponse>; name: string },
  input: string,
  inputType: InputType,
  context: string | undefined,
  orgId: string,
  editionId: string,
) {
  const result = await provider.extract(input, inputType, context);

  const enrichedActions = (result.actions || []).map((action: AgentResponse["actions"][number]) => ({
    ...action,
    payload: {
      ...action.payload,
      organizationId: orgId,
      editionId: editionId,
    },
  }));

  return NextResponse.json({
    data: {
      ...result,
      actions: enrichedActions,
      intent: "extract",
    },
    provider: provider.name,
  });
}
