import { LLMProvider, AgentResponse, InputType } from "../types";
import { SYSTEM_PROMPT, buildUserPrompt } from "../prompt";

export class OllamaProvider implements LLMProvider {
  name = "ollama";
  private baseUrl: string;
  private model: string;

  constructor(baseUrl = "http://localhost:11434", model = "qwen2.5:7b") {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async extract(
    input: string,
    inputType: InputType,
    context?: string
  ): Promise<AgentResponse> {
    const userPrompt = buildUserPrompt(input, inputType);

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt: userPrompt,
        system: SYSTEM_PROMPT + (context ? `\n\nConversation context:\n${context}` : ""),
        stream: false,
        format: "json",
        options: { temperature: 0.1 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error (${response.status}): ${await response.text()}`);
    }

    const data = await response.json();

    try {
      return JSON.parse(data.response) as AgentResponse;
    } catch {
      return {
        message: "I had trouble parsing that input. Could you try a different format?",
        entities: [],
        actions: [],
        questions: ["Could you paste the data in a different format?"],
      };
    }
  }
}
