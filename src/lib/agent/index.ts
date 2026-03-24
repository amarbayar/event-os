import { LLMProvider } from "./types";
import { GeminiProvider } from "./providers/gemini";
import { OllamaProvider } from "./providers/ollama";

export function getProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER || "gemini";

  switch (provider) {
    case "gemini":
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) throw new Error("GEMINI_API_KEY not set");
      return new GeminiProvider(geminiKey, process.env.GEMINI_MODEL);

    case "ollama":
      return new OllamaProvider(
        process.env.OLLAMA_URL || "http://localhost:11434",
        process.env.OLLAMA_MODEL || "qwen2.5:7b"
      );

    default:
      throw new Error(`Unknown LLM provider: ${provider}. Use: gemini, ollama`);
  }
}

export * from "./types";
