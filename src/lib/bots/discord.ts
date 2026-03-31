/**
 * Discord adapter — connects Discord.js to the shared relay core.
 *
 * Requires: discord.js (npm dependency)
 */

import { Client, GatewayIntentBits, Partials, Events, type Message } from "discord.js";
import type { Relay } from "./relay";

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
      console.error("[discord] Error:", err);
      await message.reply({ content: "Something went wrong. Please try again.", allowedMentions: { repliedUser: false } }).catch(() => {});
    }
  }
}
