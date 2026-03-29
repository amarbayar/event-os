import { LLMProvider, AgentResponse, AgentIntent, InputType } from "../types";
import { SYSTEM_PROMPT, CLASSIFY_PROMPT, buildUserPrompt, buildClassifyPrompt } from "../prompt";

export class GeminiProvider implements LLMProvider {
  name = "gemini";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "gemini-2.5-flash") {
    this.apiKey = apiKey;
    this.model = model;
  }

  private async call(systemPrompt: string, userPrompt: string): Promise<string> {
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
                { text: systemPrompt },
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
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  }

  async extract(input: string, inputType: InputType, context?: string): Promise<AgentResponse> {
    const systemPrompt = SYSTEM_PROMPT + (context ? `\n\nConversation context:\n${context}` : "");
    const text = await this.call(systemPrompt, buildUserPrompt(input, inputType));

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

  async generate(prompt: string): Promise<string> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 },
        }),
      }
    );
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${error}`);
    }
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  async classify(input: string, context?: string): Promise<AgentIntent> {
    const text = await this.call(CLASSIFY_PROMPT, buildClassifyPrompt(input, context));

    try {
      const parsed = JSON.parse(text);
      return {
        intent: parsed.intent || "chitchat",
        entityType: parsed.entityType || null,
        action: parsed.action || null,
        params: parsed.params || {},
        searchBy: parsed.searchBy || null,
        searchValue: parsed.searchValue || null,
        message: parsed.message || "I'm not sure what you meant.",
        confirmation: parsed.confirmation || false,
      };
    } catch {
      return {
        intent: "chitchat",
        entityType: null,
        action: null,
        params: {},
        searchBy: null,
        searchValue: null,
        message: "I didn't understand that. Try: 'how many speakers are confirmed?' or 'add speaker Sarah K.'",
        confirmation: false,
      };
    }
  }
}
