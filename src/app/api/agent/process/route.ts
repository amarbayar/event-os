import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProvider } from "@/lib/agent";
import { InputType } from "@/lib/agent/types";
import { dispatch, AgentContext } from "@/lib/agent/dispatcher";
import { getActiveIds } from "@/lib/queries";

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
  // Auth — get current user
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionUser = session.user as Record<string, unknown>;
  const userId = sessionUser.id as string;
  const orgId = sessionUser.organizationId as string;
  const role = (sessionUser.role as string) || "viewer";
  const userName = (sessionUser.name as string) || null;

  if (!checkRateLimit(userId)) {
    return NextResponse.json({ error: "Rate limited. Please wait a moment." }, { status: 429 });
  }

  const body = await req.json();
  const { input, inputType, editionId, context, mode } = body as {
    input: string;
    inputType?: InputType;
    editionId?: string;
    context?: string;
    mode?: "classify" | "extract"; // explicit mode override
  };

  if (!input) {
    return NextResponse.json({ error: "input is required" }, { status: 400 });
  }

  if (input.length > 50_000) {
    return NextResponse.json({ error: "Input too long. Maximum 50,000 characters." }, { status: 400 });
  }

  // Resolve edition
  const ids = await getActiveIds(orgId);
  const resolvedEditionId = editionId || ids?.editionId || "";
  const resolvedOrgId = ids?.orgId || orgId;

  try {
    const provider = getProvider();

    // Decide: classify (smart routing) or extract (bulk import)
    const useClassify = mode !== "extract" && (inputType === "text" || !inputType);

    if (useClassify) {
      // Smart agent: classify intent → dispatch
      const intent = await provider.classify(input, context);

      // If the classifier says "extract", fall through to extraction
      if (intent.intent === "extract") {
        return handleExtract(provider, input, inputType || "text", context, resolvedOrgId, resolvedEditionId);
      }

      // Dispatch the intent
      const agentCtx: AgentContext = {
        orgId: resolvedOrgId,
        editionId: resolvedEditionId,
        userId,
        userRole: role,
        userName,
      };

      const result = await dispatch(intent, agentCtx);

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
    return handleExtract(provider, input, inputType || "text", context, resolvedOrgId, resolvedEditionId);

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
  provider: { extract: (input: string, inputType: InputType, context?: string) => Promise<any>; name: string },
  input: string,
  inputType: InputType,
  context: string | undefined,
  orgId: string,
  editionId: string,
) {
  const result = await provider.extract(input, inputType, context);

  const enrichedActions = (result.actions || []).map((action: any) => ({
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
