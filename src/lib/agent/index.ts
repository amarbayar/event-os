import { LLMProvider } from "./types";
import { GeminiProvider } from "./providers/gemini";
import { OllamaProvider } from "./providers/ollama";
import { XAIProvider } from "./providers/xai";
import { ZAIProvider } from "./providers/zai";

export function getProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER || "gemini";

  switch (provider) {
    case "gemini": {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) throw new Error("GEMINI_API_KEY not set");
      return new GeminiProvider(geminiKey, process.env.GEMINI_MODEL);
    }

    case "xai": {
      const xaiKey = process.env.XAI_API_KEY;
      if (!xaiKey) throw new Error("XAI_API_KEY not set");
      return new XAIProvider(xaiKey, process.env.XAI_MODEL);
    }

    case "zai": {
      const zaiKey = process.env.ZAI_API_KEY;
      if (!zaiKey) throw new Error("ZAI_API_KEY not set");
      return new ZAIProvider(zaiKey, process.env.ZAI_MODEL);
    }

    case "ollama":
      return new OllamaProvider(
        process.env.OLLAMA_URL || "http://localhost:11434",
        process.env.OLLAMA_MODEL || "qwen3.5:4b"
      );

    default:
      throw new Error(`Unknown LLM provider: ${provider}. Use: gemini, xai, zai, ollama`);
  }
}

export * from "./types";
