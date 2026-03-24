import { LLMProvider, AgentResponse, InputType } from "../types";
import { SYSTEM_PROMPT, buildUserPrompt } from "../prompt";

export class ZAIProvider implements LLMProvider {
  name = "zai";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "glm-4.5") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async extract(
    input: string,
    inputType: InputType,
    context?: string
  ): Promise<AgentResponse> {
    const userPrompt = buildUserPrompt(input, inputType);

    const response = await fetch(
      "https://api.z.ai/api/paas/v4/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "system",
              content:
                SYSTEM_PROMPT +
                (context ? `\n\nConversation context:\n${context}` : ""),
            },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.1,
          response_format: { type: "json_object" },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Z.AI API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "{}";

    try {
      return JSON.parse(text) as AgentResponse;
    } catch {
      return {
        message:
          "I had trouble parsing that input. Could you try a different format?",
        entities: [],
        actions: [],
        questions: ["Could you paste the data in a different format?"],
      };
    }
  }
}
