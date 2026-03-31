/**
 * Telegram adapter — raw Bot API with long polling. Zero extra dependencies.
 *
 * Uses fetch + getUpdates loop instead of a library.
 */

import type { Relay } from "./relay";

const API = "https://api.telegram.org";

export interface TelegramAdapterConfig {
  token: string;
  relay: Relay;
}

// ─── Telegram API types (minimal subset) ─────────────

interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TgChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
}

interface TgDocument {
  file_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: TgChat;
  text?: string;
  caption?: string;
  entities?: { type: string; offset: number; length: number }[];
  document?: TgDocument;
}

interface TgUpdate {
  update_id: number;
  message?: TgMessage;
}

// ─── Adapter ─────────────────────────────────────────

export class TelegramAdapter {
  private relay: Relay;
  private running = false;
  private offset = 0;
  private botUsername = "";

  constructor(private config: TelegramAdapterConfig) {
    this.relay = config.relay;
  }

  async start(): Promise<void> {
    const me = await this.api<{ id: number; username: string }>("getMe");
    this.botUsername = me.username;
    console.log(`[telegram] Ready as @${me.username}`);

    this.running = true;
    this.poll();
  }

  stop(): void {
    this.running = false;
    console.log("[telegram] Stopped polling");
  }

  // ─── Telegram Bot API helpers ────────────────────

  private async api<T>(method: string, body?: Record<string, unknown>): Promise<T> {
    const url = `${API}/bot${this.config.token}/${method}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = await res.json();
    if (!json.ok) {
      throw new Error(`Telegram API ${method}: ${json.description || res.status}`);
    }
    return json.result as T;
  }

  private async sendMessage(chatId: number, text: string, replyTo?: number): Promise<void> {
    if (text.length <= 4096) {
      await this.api("sendMessage", {
        chat_id: chatId,
        text,
        ...(replyTo ? { reply_parameters: { message_id: replyTo } } : {}),
      });
    } else {
      for (let i = 0; i < text.length; i += 4096) {
        const chunk = text.slice(i, i + 4096);
        await this.api("sendMessage", {
          chat_id: chatId,
          text: chunk,
          ...(i === 0 && replyTo ? { reply_parameters: { message_id: replyTo } } : {}),
        });
      }
    }
  }

  private async sendTyping(chatId: number): Promise<void> {
    await this.api("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
  }

  // ─── Long polling loop ─────────────────────────

  private async poll(): Promise<void> {
    while (this.running) {
      try {
        const updates = await this.api<TgUpdate[]>("getUpdates", {
          offset: this.offset,
          timeout: 30,
          allowed_updates: ["message"],
        });

        for (const update of updates) {
          this.offset = update.update_id + 1;
          if (update.message) {
            this.onMessage(update.message).catch((err) =>
              console.error("[telegram] Message handler error:", err)
            );
          }
        }
      } catch (err) {
        console.error("[telegram] Poll error:", err);
        await sleep(5000);
      }
    }
  }

  // ─── Message handler ───────────────────────────

  private async onMessage(msg: TgMessage): Promise<void> {
    if (!msg.from) return;

    // Extract text from message body or document attachment
    let textContent = msg.text || msg.caption || "";
    if (msg.document) {
      const docText = await this.extractDocument(msg.document);
      if (docText) {
        textContent = textContent ? `${textContent}\n\n${docText}` : docText;
      }
    }
    if (!textContent) return;

    const isGroupChat = msg.chat.type === "group" || msg.chat.type === "supergroup";

    if (isGroupChat && !this.isBotMentioned(msg)) return;

    let input = isGroupChat ? this.stripMention(textContent) : textContent;

    if (input === "/start") {
      await this.sendMessage(
        msg.chat.id,
        "Hi! I'm the Event OS bot. Ask me anything about the event, or link your account in Event OS Settings > Messaging.",
        msg.message_id,
      );
      return;
    }

    if (!input.trim()) {
      await this.sendMessage(msg.chat.id, "How can I help? Ask me anything about the event.", msg.message_id);
      return;
    }

    try {
      await this.sendTyping(msg.chat.id);

      const displayName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ");

      const result = await this.relay.handleMessage({
        platform: "telegram",
        platformUserId: String(msg.from.id),
        displayName: displayName || msg.from.username || "Unknown",
        input,
        isGroupChat,
      });

      await this.sendMessage(msg.chat.id, result.text, msg.message_id);
    } catch (err) {
      console.error("[telegram] Error:", err);
      await this.sendMessage(msg.chat.id, "Something went wrong. Please try again.", msg.message_id).catch(() => {});
    }
  }

  // ─── Mention detection ─────────────────────────

  private isBotMentioned(msg: TgMessage): boolean {
    const text = msg.text || msg.caption || "";
    if (!text) return false;

    if (msg.entities) {
      for (const entity of msg.entities) {
        if (entity.type === "mention") {
          const mention = text.slice(entity.offset, entity.offset + entity.length);
          if (mention.toLowerCase() === `@${this.botUsername.toLowerCase()}`) return true;
        }
        if (entity.type === "text_mention") return true;
      }
    }

    const lower = text.toLowerCase();
    const patterns = ["@agent", "@bot", "@assistant", "@eventbot", "@eventos"];
    return patterns.some((p) => lower.includes(p));
  }

  private stripMention(text: string): string {
    let cleaned = text.replace(new RegExp(`@${this.botUsername}`, "gi"), "").trim();
    cleaned = cleaned.replace(/@(?:agent|bot|assistant|eventbot|eventos)\b/gi, "").trim();
    return cleaned || text;
  }

  /** Download text-based document attachments via Telegram Bot API. */
  private async extractDocument(doc: TgDocument): Promise<string> {
    const textMimes = new Set(["text/plain", "text/csv", "text/tab-separated-values", "text/markdown", "application/json"]);
    const textExts = new Set([".txt", ".csv", ".tsv", ".md", ".json"]);
    const MAX_SIZE = 100_000;

    const ext = doc.file_name?.match(/\.\w+$/)?.[0]?.toLowerCase() || "";
    const isText = (doc.mime_type && textMimes.has(doc.mime_type)) || textExts.has(ext);
    if (!isText) return "";
    if (doc.file_size && doc.file_size > MAX_SIZE) return "";

    try {
      // Get file path from Telegram
      const fileInfo = await this.api<{ file_path: string }>("getFile", { file_id: doc.file_id });
      if (!fileInfo.file_path) return "";

      // Download file content
      const url = `https://api.telegram.org/file/bot${this.config.token}/${fileInfo.file_path}`;
      const res = await fetch(url);
      if (!res.ok) return "";
      const text = await res.text();
      return text.trim() ? `[File: ${doc.file_name || "attachment"}]\n${text}` : "";
    } catch {
      return "";
    }
  }
}

// ─── Util ────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
