/**
 * Standalone bot entry point — runs adapters outside the Next.js process.
 *
 * This is an OPTIONAL fallback for running bots as a separate service
 * (e.g., on a different machine, or for local development).
 *
 * In production, bots start automatically when an admin enables them
 * in Settings > Messaging. This script is NOT required.
 *
 * Usage:
 *   npm run bot                    # start all configured adapters
 *   npm run bot -- --discord       # Discord only
 *   npm run bot -- --telegram      # Telegram only
 *
 * Env vars:
 *   SERVICE_TOKEN, EVENT_OS_URL, EVENT_OS_ORG_ID (required)
 *   DISCORD_BOT_TOKEN, TELEGRAM_BOT_TOKEN (per adapter)
 */

import { createRelayFromEnv } from "../src/lib/bots/relay";
import { DiscordAdapter } from "../src/lib/bots/discord";
import { TelegramAdapter } from "../src/lib/bots/telegram";

const args = new Set(process.argv.slice(2));
const discordOnly = args.has("--discord");
const telegramOnly = args.has("--telegram");
const filterByFlag = discordOnly || telegramOnly;

if (!process.env.SERVICE_TOKEN) { console.error("SERVICE_TOKEN is required"); process.exit(1); }
if (!process.env.EVENT_OS_ORG_ID) { console.error("EVENT_OS_ORG_ID is required"); process.exit(1); }

const adapters: { name: string; stop: () => void }[] = [];

async function main() {
  const relay = createRelayFromEnv();
  const url = process.env.EVENT_OS_URL || "http://localhost:3000";
  console.log(`Event OS API: ${url}`);
  console.log(`Organization: ${process.env.EVENT_OS_ORG_ID}\n`);

  if (process.env.DISCORD_BOT_TOKEN && (!filterByFlag || discordOnly)) {
    try {
      const d = new DiscordAdapter({ token: process.env.DISCORD_BOT_TOKEN, relay });
      await d.start();
      adapters.push({ name: "discord", stop: () => d.stop() });
    } catch (err) { console.error("[discord] Failed:", err); }
  }

  if (process.env.TELEGRAM_BOT_TOKEN && (!filterByFlag || telegramOnly)) {
    try {
      const t = new TelegramAdapter({ token: process.env.TELEGRAM_BOT_TOKEN, relay });
      await t.start();
      adapters.push({ name: "telegram", stop: () => t.stop() });
    } catch (err) { console.error("[telegram] Failed:", err); }
  }

  if (adapters.length === 0) {
    console.error("No adapters started. Set DISCORD_BOT_TOKEN and/or TELEGRAM_BOT_TOKEN.");
    process.exit(1);
  }

  console.log(`\n${adapters.length} adapter(s) running: ${adapters.map((a) => a.name).join(", ")}`);
}

function shutdown(signal: string) {
  console.log(`\n${signal} — shutting down...`);
  for (const a of adapters) a.stop();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
