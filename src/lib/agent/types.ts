export type EntityType =
  | "speaker"
  | "sponsor"
  | "venue"
  | "volunteer"
  | "media"
  | "booth"
  | "attendee"
  | "invitation"
  | "task"
  | "outreach"
  | "campaign";

export type ExtractedEntity = {
  type: EntityType;
  confidence: number; // 0-1
  data: Record<string, unknown>;
  warnings: string[];
};

export type AgentResponse = {
  message: string;
  entities: ExtractedEntity[];
  actions: {
    label: string;
    endpoint: string;
    method: "POST" | "PATCH";
    payload: Record<string, unknown>;
  }[];
  questions: string[];
};

export type InputType = "text" | "csv" | "file";

export interface LLMProvider {
  name: string;
  extract(
    input: string,
    inputType: InputType,
    context?: string
  ): Promise<AgentResponse>;
}
