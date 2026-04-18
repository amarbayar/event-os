/**
 * Discord adapter — connects Discord.js to the shared relay core.
 *
 * Requires: discord.js (npm dependency)
 */

import { Client, GatewayIntentBits, Partials, Events, type Message } from "discord.js";
import type { Relay } from "./relay";
import { RelayApiError } from "./relay";

const DISCORD_MESSAGE_LINK_RE = /https?:\/\/(?:canary\.|ptb\.)?discord\.com\/channels\/(@me|\d+)\/(\d+)\/(\d+)/gi;
const MAX_CONTEXT_CHARS = 3_000;

export interface DiscordAdapterConfig {
  token: string;
  relay: Relay;
}

export class DiscordAdapter {
  private client: Client;
  private relay: Relay;

  constructor(private config: DiscordAdapterConfig) {
    this.relay = config.relay;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
      partials: [Partials.Channel],
    });
  }

  async start(): Promise<void> {
    this.client.once(Events.ClientReady, (c) => {
      console.log(`[discord] Ready as ${c.user.tag}`);
    });

    this.client.on(Events.MessageCreate, (msg) => this.onMessage(msg));

    await this.client.login(this.config.token);
  }

  stop(): void {
    this.client.destroy();
    console.log("[discord] Disconnected");
  }

  private async onMessage(message: Message): Promise<void> {
    if (message.author.bot) return;
    // PartialGroupDMChannel lacks send/sendTyping — skip those channels
    if (!("send" in message.channel)) return;

    const isDM = !message.guild;
    const isMentioned = message.mentions.has(this.client.user!);

    // In guilds: only respond when @mentioned. In DMs: always respond.
    if (!isDM && !isMentioned) return;

    // Strip the bot mention from the text
    let input = message.content;
    if (isMentioned && this.client.user) {
      input = input.replace(new RegExp(`<@!?${this.client.user.id}>`, "g"), "").trim();
    }

    const { cleanedInput, contextBlocks } = await this.extractContextBlocks(message, input);
    input = cleanedInput;

    // Download text file attachments and append to input
    const attachmentText = await this.extractAttachments(message);
    if (attachmentText) {
      input = input ? `${input}\n\n${attachmentText}` : attachmentText;
    }

    input = this.composeInput(input, contextBlocks);

    if (!input) {
      await message.reply({ content: "How can I help? Ask me anything about the event.", allowedMentions: { repliedUser: false } });
      return;
    }

    const channel = message.channel;

    try {
      await channel.sendTyping();

      const result = await this.relay.handleMessage({
        platform: "discord",
        platformUserId: message.author.id,
        displayName: message.author.displayName || message.author.username,
        input,
        isGroupChat: !isDM,
      });

      const reply = result.text;
      if (reply.length <= 2000) {
        await message.reply({ content: reply, allowedMentions: { repliedUser: false } });
      } else {
        for (let i = 0; i < reply.length; i += 2000) {
          const chunk = reply.slice(i, i + 2000);
          if (i === 0) await message.reply({ content: chunk, allowedMentions: { repliedUser: false } });
          else await channel.send({ content: chunk });
        }
      }
    } catch (err) {
      if (err instanceof RelayApiError) {
        console.error("[discord] Relay error:", {
          status: err.status,
          userMessage: err.userMessage,
          details: err.details,
        });
        await message.reply({ content: err.userMessage, allowedMentions: { repliedUser: false } }).catch(() => {});
        return;
      }

      console.error("[discord] Error:", err);
      await message.reply({ content: "Something went wrong. Please try again.", allowedMentions: { repliedUser: false } }).catch(() => {});
    }
  }

  private composeInput(input: string, contextBlocks: string[]): string {
    const trimmedInput = input.trim();
    if (contextBlocks.length === 0) return trimmedInput;

    const sections = [];
    if (trimmedInput) sections.push(trimmedInput);
    sections.push(`Discord context:\n${contextBlocks.join("\n\n")}`);
    return sections.join("\n\n").trim();
  }

  private async extractContextBlocks(
    message: Message,
    input: string,
  ): Promise<{ cleanedInput: string; contextBlocks: string[] }> {
    const contextBlocks: string[] = [];
    const seenMessageIds = new Set<string>();

    const addContext = async (label: string, target: Message | null | undefined) => {
      if (!target || seenMessageIds.has(target.id)) return;

      const parts = [];
      if (target.content.trim()) parts.push(target.content.trim());
      const attachments = await this.extractAttachments(target);
      if (attachments) parts.push(attachments);
      const text = parts.join("\n\n").trim();
      if (!text) return;

      seenMessageIds.add(target.id);
      const authorName = target.author.displayName || target.author.username;
      contextBlocks.push(this.truncateContext(`${label} from ${authorName}:\n${text}`));
    };

    if (message.reference?.messageId) {
      try {
        await addContext("Referenced message", await message.fetchReference());
      } catch {
        // Ignore missing or inaccessible referenced messages.
      }
    }

    if ("fetchStarterMessage" in message.channel && typeof message.channel.fetchStarterMessage === "function") {
      try {
        await addContext("Thread starter", await message.channel.fetchStarterMessage());
      } catch {
        // Ignore threads without an accessible starter message.
      }
    }

    const linkMatches = [...input.matchAll(DISCORD_MESSAGE_LINK_RE)];
    for (const match of linkMatches) {
      const [, guildId, channelId, messageId] = match;
      if (!channelId || !messageId || guildId === "@me") continue;

      try {
        const channel = await this.client.channels.fetch(channelId);
        if (!channel || !("messages" in channel)) continue;
        const linkedMessage = await channel.messages.fetch(messageId);
        await addContext("Linked message", linkedMessage);
      } catch {
        // Ignore inaccessible message links.
      }
    }

    const cleanedInput = input.replace(DISCORD_MESSAGE_LINK_RE, " ").replace(/\s+/g, " ").trim();
    return { cleanedInput, contextBlocks };
  }

  private truncateContext(text: string): string {
    if (text.length <= MAX_CONTEXT_CHARS) return text;
    return `${text.slice(0, MAX_CONTEXT_CHARS - 3)}...`;
  }

  /** Download text-based attachments (txt, csv, tsv, md, json). */
  private async extractAttachments(message: Message): Promise<string> {
    if (!message.attachments.size) return "";

    const textTypes = new Set(["text/plain", "text/csv", "text/tab-separated-values", "text/markdown", "application/json"]);
    const textExts = new Set([".txt", ".csv", ".tsv", ".md", ".json"]);
    const MAX_SIZE = 100_000; // 100KB per file

    const parts: string[] = [];

    for (const [, attachment] of message.attachments) {
      const ext = attachment.name?.match(/\.\w+$/)?.[0]?.toLowerCase() || "";
      const isText = (attachment.contentType && textTypes.has(attachment.contentType)) || textExts.has(ext);
      if (!isText) continue;
      if (attachment.size > MAX_SIZE) continue;

      try {
        const res = await fetch(attachment.url);
        if (!res.ok) continue;
        const text = await res.text();
        if (text.trim()) {
          parts.push(`[File: ${attachment.name}]\n${text}`);
        }
      } catch {
        // Skip failed downloads
      }
    }

    return parts.join("\n\n");
  }
}
