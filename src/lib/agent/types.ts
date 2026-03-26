import type { Table, Column } from "drizzle-orm";

/**
 * A Drizzle table that also supports dynamic string-key column access.
 * Uses intersection so it satisfies both Table (for getTableColumns, select, etc.)
 * and Record<string, ...> (for dynamic column lookup).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DrizzleTable = Table<any> & Record<string, any>;

/** Safely access a Drizzle table column by dynamic string key. */
export function col(table: DrizzleTable, name: string): Column {
  const c = table[name];
  if (!c || typeof c !== "object" || !("name" in c)) {
    throw new Error(`Column "${name}" not found on table`);
  }
  return c as Column;
}

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

// ─── Agent Intelligence Types ────────────────────────

export type AgentIntent = {
  intent: "manage" | "query" | "extract" | "chitchat";
  entityType: EntityType | null;
  action: "create" | "update" | "delete" | "list" | "count" | "search" | "sql" | null;
  params: Record<string, unknown>;
  searchBy: "name" | "email" | "company" | null;
  searchValue: string | null;
  message: string;
  confirmation: boolean;
};

export type DispatchResult = {
  message: string;
  success: boolean;
  data?: unknown;
  requiresConfirmation?: boolean;
  pendingAction?: AgentIntent;
};

export interface LLMProvider {
  name: string;
  extract(
    input: string,
    inputType: InputType,
    context?: string
  ): Promise<AgentResponse>;
  classify(
    input: string,
    context?: string
  ): Promise<AgentIntent>;
}
