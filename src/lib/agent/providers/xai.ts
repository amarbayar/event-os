import { LLMProvider, AgentResponse, AgentIntent, InputType } from "../types";
import { SYSTEM_PROMPT, CLASSIFY_PROMPT, buildUserPrompt, buildClassifyPrompt } from "../prompt";

export class XAIProvider implements LLMProvider {
  name = "xai";
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "grok-3-mini") {
    this.apiKey = apiKey;
    this.model = model;
  }

  private async call(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`xAI API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "{}";
  }

  async extract(
    input: string,
    inputType: InputType,
    context?: string
  ): Promise<AgentResponse> {
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
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      }),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`xAI API error (${response.status}): ${error}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
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
