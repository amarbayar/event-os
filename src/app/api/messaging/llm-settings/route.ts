import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requirePermission, isRbacError } from "@/lib/rbac";
import { encryptApiKey } from "@/lib/crypto";

const VALID_PROVIDERS = ["gemini", "zai", "xai", "ollama"];

const PROVIDER_MODELS: Record<string, { id: string; label: string; note?: string }[]> = {
  gemini: [
    { id: "gemini-3-flash-preview", label: "Gemini 3 Flash", note: "Best value" },
    { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", note: "Most capable" },
    { id: "gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash Lite", note: "Cheapest" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", note: "Stable, EOL Jun 2026" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", note: "Stable, EOL Jun 2026" },
    { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", note: "Budget, EOL Jul 2026" },
  ],
  zai: [
    { id: "glm-5", label: "GLM-5", note: "Flagship" },
    { id: "glm-5-turbo", label: "GLM-5 Turbo", note: "Agent-optimized" },
    { id: "glm-4.7", label: "GLM-4.7", note: "Reasoning + coding" },
    { id: "glm-4.7-flashx", label: "GLM-4.7 FlashX", note: "Fast + lightweight" },
    { id: "glm-4.6", label: "GLM-4.6", note: "Strong coding, 200K ctx" },
    { id: "glm-4.5", label: "GLM-4.5", note: "Balanced" },
    { id: "glm-4.5-air", label: "GLM-4.5 Air", note: "Budget" },
  ],
  xai: [
    { id: "grok-4.20-0309-reasoning", label: "Grok 4.20 Reasoning", note: "Newest flagship" },
    { id: "grok-4-1-fast-reasoning", label: "Grok 4.1 Fast", note: "Best tool-calling, $0.20/1M" },
    { id: "grok-4-1-fast-non-reasoning", label: "Grok 4.1 Fast (Non-reasoning)", note: "Low latency" },
    { id: "grok-3-mini", label: "Grok 3 Mini", note: "Lightweight, $0.30/1M" },
  ],
  ollama: [
    { id: "qwen3:8b", label: "Qwen 3 8B", note: "Best all-around, tool calling" },
    { id: "qwen3:14b", label: "Qwen 3 14B", note: "Stronger reasoning" },
    { id: "deepseek-r1:8b", label: "DeepSeek R1 8B", note: "Reasoning focused" },
    { id: "gpt-oss:20b", label: "GPT-OSS 20B", note: "OpenAI open-weight" },
    { id: "gemma3:4b", label: "Gemma 3 4B", note: "Lightweight" },
    { id: "llama3.1:8b", label: "Llama 3.1 8B", note: "Most popular" },
  ],
};

function maskKey(key: string | null): string | null {
  if (!key) return null;
  if (key.length <= 8) return "••••";
  return key.slice(0, 4) + "••••" + key.slice(-4);
}

// GET — current LLM settings
export async function GET(req: NextRequest) {
  const ctx = await requirePermission(req, "settings", "read");
  if (isRbacError(ctx)) return ctx;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, ctx.orgId),
    columns: { llmProvider: true, llmModel: true, llmApiKey: true },
  });

  return NextResponse.json({
    data: {
      provider: org?.llmProvider || null,
      model: org?.llmModel || null,
      apiKeySet: !!org?.llmApiKey,
      apiKeyMasked: maskKey(org?.llmApiKey ?? null),
      providerModels: PROVIDER_MODELS,
      validProviders: VALID_PROVIDERS,
    },
  });
}

// PATCH — update LLM settings
export async function PATCH(req: NextRequest) {
  const ctx = await requirePermission(req, "settings", "update");
  if (isRbacError(ctx)) return ctx;

  const body = await req.json();
  const updates: Record<string, string | null> = {};

  if (body.provider !== undefined) {
    if (body.provider !== null && !VALID_PROVIDERS.includes(body.provider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }
    updates.llmProvider = body.provider;
  }

  if (body.model !== undefined) {
    updates.llmModel = body.model || null;
  }

  if (body.apiKey !== undefined) {
    updates.llmApiKey = body.apiKey ? encryptApiKey(body.apiKey) : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db.update(organizations).set(updates).where(eq(organizations.id, ctx.orgId));

  return NextResponse.json({
    data: {
      provider: updates.llmProvider,
      model: updates.llmModel,
      apiKeySet: !!updates.llmApiKey,
    },
  });
}
