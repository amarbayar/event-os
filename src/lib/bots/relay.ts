/**
 * Shared relay core — platform-agnostic bridge to Event OS API.
 *
 * All platform adapters (Discord, Telegram, WhatsApp, etc.) call
 * handleMessage() with a MessageContext. This module handles:
 *   1. User identification (platform ID → Event OS identity)
 *   2. Message processing (input → classify → dispatch → response)
 *   3. Conversation history (sliding window per user)
 *
 * No platform-specific logic lives here.
 */

// ─── Types ───────────────────────────────────────────

export type Platform = "telegram" | "discord" | "whatsapp" | "slack" | "signal";

export interface MessageContext {
  platform: Platform;
  platformUserId: string;
  displayName: string;
  input: string;
  /** Whether this message is from a group chat (affects @mention gating in Event OS) */
  isGroupChat: boolean;
}

export interface BotResponse {
  text: string;
  intent: string;
  success: boolean;
}

export interface RelayConfig {
  eventOsUrl: string;
  serviceToken: string;
  orgId: string;
}

export class RelayApiError extends Error {
  constructor(
    message: string,
    readonly userMessage: string,
    readonly status: number,
    readonly details?: string,
  ) {
    super(message);
    this.name = "RelayApiError";
  }
}

export async function readRelayError(
  response: Response,
  fallbackMessage: string,
): Promise<RelayApiError> {
  const contentType = response.headers.get("content-type") || "";
  let userMessage = fallbackMessage;
  let details = "";

  try {
    if (contentType.includes("application/json")) {
      const json = await response.json();
      const dataMessage = typeof json?.data?.message === "string" ? json.data.message : "";
      const errorMessage = typeof json?.error === "string" ? json.error : "";
      const topLevelMessage = typeof json?.message === "string" ? json.message : "";

      userMessage = dataMessage || errorMessage || topLevelMessage || fallbackMessage;
      details = [topLevelMessage, errorMessage].filter(Boolean).join(" | ");
    } else {
      const text = (await response.text()).trim();
      if (text) {
        userMessage = text;
        details = text;
      }
    }
  } catch {
    // Fall back to status text below.
  }

  const statusDetail = `${response.status} ${response.statusText}`.trim();
  const message = details ? `${statusDetail}: ${details}` : `${statusDetail}: ${userMessage}`;
  return new RelayApiError(message, userMessage, response.status, details || undefined);
}

// ─── Identity result from /api/agent/identify ────────

export interface UserIdentity {
  userId: string | null;
  name?: string;
  email?: string;
  role?: string;
  teams?: string[];
  linked: boolean;
  message?: string;
}

// ─── Conversation history ────────────────────────────

interface ConversationEntry {
  role: "user" | "agent";
  text: string;
  timestamp: number;
}

/** Max turns to keep per user (user + agent = 2 entries per turn) */
const MAX_HISTORY_TURNS = 10;
/** Expire conversation after 15 minutes of inactivity */
const HISTORY_TTL_MS = 15 * 60 * 1000;

// ─── Relay class ─────────────────────────────────────

export class Relay {
  private headers: Record<string, string>;
  /** Key: "platform:platformUserId" → conversation history */
  private conversations = new Map<string, ConversationEntry[]>();

  constructor(private config: RelayConfig) {
    this.headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.serviceToken}`,
      "x-organization-id": config.orgId,
    };
  }

  /** Resolve a platform user to their Event OS identity. */
  async identify(
    platform: Platform,
    platformUserId: string,
    displayName: string,
  ): Promise<UserIdentity> {
    const res = await fetch(`${this.config.eventOsUrl}/api/agent/identify`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ platform, platformUserId, displayName }),
    });

    if (!res.ok) {
      throw await readRelayError(res, "I couldn't verify your Event OS account. Try again in a moment.");
    }

    const json = await res.json();
    return json.data;
  }

  /** Send a message through the Event OS agent pipeline. */
  async process(
    input: string,
    source: Platform | "api",
    user: UserIdentity,
    context?: string,
  ): Promise<BotResponse> {
    const res = await fetch(`${this.config.eventOsUrl}/api/agent/process`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        input,
        source,
        userId: user.userId || "unknown",
        userRole: user.role || "viewer",
        userName: user.name || null,
        ...(context ? { context } : {}),
      }),
    });

    if (!res.ok) {
      throw await readRelayError(res, "Agent temporarily unavailable. Try again or use manual add.");
    }

    const json = await res.json();
    return {
      text: json.data?.message || "Done.",
      intent: json.data?.intent || "unknown",
      success: json.data?.success ?? true,
    };
  }

  /**
   * Full message handling pipeline: identify → process (with history) → response.
   */
  async handleMessage(ctx: MessageContext): Promise<BotResponse> {
    const user = await this.identify(ctx.platform, ctx.platformUserId, ctx.displayName);

    if (!user.linked) {
      return {
        text:
          user.message ||
          "I don't recognize you yet. Link your account in Event OS Settings > Messaging > Platform Links.",
        intent: "unlinked",
        success: false,
      };
    }

    // Build context from conversation history
    const historyKey = `${ctx.platform}:${ctx.platformUserId}`;
    const context = this.getContext(historyKey);

    // Record the user's message
    this.addEntry(historyKey, "user", ctx.input);

    // Process with conversation context
    const result = await this.process(ctx.input, ctx.platform, user, context);

    // Record the agent's response
    this.addEntry(historyKey, "agent", result.text);

    return result;
  }

  // ─── Conversation history helpers ──────────────────

  private getContext(key: string): string | undefined {
    const history = this.conversations.get(key);
    if (!history || history.length === 0) return undefined;

    // Expire stale conversations
    const now = Date.now();
    const last = history[history.length - 1];
    if (now - last.timestamp > HISTORY_TTL_MS) {
      this.conversations.delete(key);
      return undefined;
    }

    // Format as "User: ...\nAgent: ..." for the LLM context window
    return history
      .map((e) => `${e.role === "user" ? "User" : "Agent"}: ${e.text}`)
      .join("\n");
  }

  private addEntry(key: string, role: "user" | "agent", text: string): void {
    let history = this.conversations.get(key);
    if (!history) {
      history = [];
      this.conversations.set(key, history);
    }

    history.push({ role, text, timestamp: Date.now() });

    // Trim to max turns (each turn = user + agent = 2 entries)
    const maxEntries = MAX_HISTORY_TURNS * 2;
    if (history.length > maxEntries) {
      history.splice(0, history.length - maxEntries);
    }
  }
}

// ─── Factory helpers ─────────────────────────────────

/** Create a relay from explicit config (used by BotManager). */
export function createRelay(config: RelayConfig): Relay {
  return new Relay(config);
}

/** Create a relay from environment variables (used by standalone scripts). */
export function createRelayFromEnv(): Relay {
  const eventOsUrl = (process.env.EVENT_OS_URL || "http://localhost:3000").replace(/\/$/, "");
  const serviceToken = process.env.SERVICE_TOKEN;
  const orgId = process.env.EVENT_OS_ORG_ID;

  if (!serviceToken) throw new Error("SERVICE_TOKEN is required");
  if (!orgId) throw new Error("EVENT_OS_ORG_ID is required");

  return new Relay({ eventOsUrl, serviceToken, orgId });
}
