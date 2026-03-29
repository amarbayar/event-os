import { LLMProvider, AgentResponse, AgentIntent, InputType } from "../types";
import { CLASSIFY_PROMPT, buildClassifyPrompt } from "../prompt";

const COMPACT_SYSTEM_PROMPT = `You extract event management entities from user input. Return ONLY valid JSON.

Entity types: speaker, sponsor, venue, volunteer, media, booth, attendee, outreach, task, campaign.

Required fields per type:
- speaker: name, email, talkTitle
- sponsor: companyName, contactName, contactEmail
- venue: name, address, contactName
- volunteer: name, email
- media: companyName, contactName, type
- outreach: targetType, name
- task: title
- attendee: name, email

JSON format:
{"message":"summary","entities":[{"type":"speaker","confidence":0.9,"data":{"name":"...","email":"...","talkTitle":"..."},"warnings":[]}],"actions":[{"label":"Import 1 speaker","endpoint":"/api/speakers","method":"POST","payload":{}}],"questions":[]}`;

export class OllamaProvider implements LLMProvider {
  name = "ollama";
  private baseUrl: string;
  private model: string;

  constructor(baseUrl = "http://localhost:11434", model = "qwen3.5:4b") {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  private async call(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
        format: "json",
        options: { temperature: 0.1, num_predict: 2048 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error (${response.status}): ${await response.text()}`);
    }

    const data = await response.json();
    return data.message?.content || "{}";
  }

  async extract(
    input: string,
    inputType: InputType,
    context?: string
  ): Promise<AgentResponse> {
    const typeHint = inputType === "csv" ? "(This is tabular/CSV data)" : "";
    const contextMessages = context ? `Previous context: ${context}\n\n` : "";
    const userPrompt = `${contextMessages}${typeHint}\n${input}\n\nReturn JSON only.`;
    const raw = await this.call(COMPACT_SYSTEM_PROMPT, userPrompt);

    try {
      const parsed = JSON.parse(raw);

      // Normalize — the model might not return the exact schema
      return {
        message: parsed.message || parsed.summary || `Found ${(parsed.entities || []).length} entities`,
        entities: (parsed.entities || []).map((e: Record<string, unknown>) => ({
          type: e.type || "outreach",
          confidence: typeof e.confidence === "number" ? e.confidence : 0.8,
          data: e.data || e,
          warnings: Array.isArray(e.warnings) ? e.warnings : [],
        })),
        actions: parsed.actions || [],
        questions: parsed.questions || [],
      };
    } catch {
      // If the model returned something useful but not valid JSON, try to salvage it
      if (raw.includes("speaker") || raw.includes("sponsor") || raw.includes("name")) {
        return {
          message: `I understood your input but couldn't structure it properly. Here's what I got:\n\n${raw.slice(0, 500)}`,
          entities: [],
          actions: [],
          questions: ["Could you try pasting the data in a simpler format? For example: Name, Email, Talk Title — one per line."],
        };
      }

      return {
        message: "I couldn't parse that input. Try pasting it in a different format.",
        entities: [],
        actions: [],
        questions: ["Try: one entity per line, with name and email separated by commas."],
      };
    }
  }

  async generate(prompt: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        options: { temperature: 0.1, num_predict: 2048 },
      }),
    });
    if (!response.ok) {
      throw new Error(`Ollama error (${response.status}): ${await response.text()}`);
    }
    const data = await response.json();
    return data.message?.content || "";
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
