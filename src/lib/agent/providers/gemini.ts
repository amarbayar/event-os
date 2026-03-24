import { LLMProvider, AgentResponse, InputType } from "../types";
import { SYSTEM_PROMPT, buildUserPrompt } from "../prompt";

export class GeminiProvider implements LLMProvider {
  name = "gemini";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "gemini-2.0-flash") {
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
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: SYSTEM_PROMPT + (context ? `\n\nConversation context:\n${context}` : "") },
                { text: userPrompt },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    try {
      return JSON.parse(text) as AgentResponse;
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
