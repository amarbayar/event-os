import { LLMProvider } from "./types";
import { GeminiProvider } from "./providers/gemini";
import { OllamaProvider } from "./providers/ollama";
import { XAIProvider } from "./providers/xai";
import { ZAIProvider } from "./providers/zai";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decryptApiKey } from "@/lib/crypto";

function buildProvider(provider: string, model?: string, apiKey?: string): LLMProvider {
  switch (provider) {
    case "gemini": {
      const key = apiKey || process.env.GEMINI_API_KEY;
      if (!key) throw new Error("Gemini API key not configured");
      return new GeminiProvider(key, model || process.env.GEMINI_MODEL);
    }

    case "xai": {
      const key = apiKey || process.env.XAI_API_KEY;
      if (!key) throw new Error("xAI API key not configured");
      return new XAIProvider(key, model || process.env.XAI_MODEL);
    }

    case "zai": {
      const key = apiKey || process.env.ZAI_API_KEY;
      if (!key) throw new Error("z.ai API key not configured");
      return new ZAIProvider(key, model || process.env.ZAI_MODEL);
    }

    case "ollama":
      return new OllamaProvider(
        process.env.OLLAMA_URL || "http://localhost:11434",
        model || process.env.OLLAMA_MODEL || "qwen3.5:4b"
      );

    default:
      throw new Error(`Unknown LLM provider: ${provider}. Use: gemini, xai, zai, ollama`);
  }
}

// Get provider from DB config (org-level), fall back to env vars
export async function getProvider(orgId?: string): Promise<LLMProvider> {
  // Try org-level config from DB
  if (orgId) {
    try {
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, orgId),
        columns: { llmProvider: true, llmModel: true, llmApiKey: true },
      });
      if (org?.llmProvider && org?.llmApiKey) {
        const plainKey = decryptApiKey(org.llmApiKey);
        return buildProvider(org.llmProvider, org.llmModel || undefined, plainKey);
      }
    } catch {} // fall through to env vars
  }

  // Fall back to env vars
  const provider = process.env.LLM_PROVIDER || "gemini";
  return buildProvider(provider);
}

// Sync version for backward compat (env vars only)
export function getProviderSync(): LLMProvider {
  const provider = process.env.LLM_PROVIDER || "gemini";
  return buildProvider(provider);
}

export * from "./types";
