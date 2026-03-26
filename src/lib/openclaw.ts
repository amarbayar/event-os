import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { homedir } from "os";
import path from "path";

// ─── OpenClaw Configuration Bridge ────────────────────
//
// Reads/writes OpenClaw's config files programmatically.
// The Settings UI calls these functions to configure
// Telegram/Discord/WhatsApp without the user touching CLI.
//
// Config files (all outside repo, in user's home dir):
//   ~/.openclaw/openclaw.json — gateway config
//   ~/.openclaw/skills/event-os/SKILL.md — our skill
//   ~/.openclaw/workspace/SOUL.md — bot personality
//   ~/.openclaw/workspace/AGENTS.md — operating instructions

const OPENCLAW_DIR = path.join(homedir(), ".openclaw");
const CONFIG_PATH = path.join(OPENCLAW_DIR, "openclaw.json");

// ─── Shell injection prevention ──────────────────────
//
// User-supplied values (API keys, bot tokens, model names) are interpolated
// into execSync shell commands. Reject any value containing shell
// metacharacters to prevent command injection.

function sanitizeShellValue(value: string, label = "Value"): string {
  if (/[;"'`$|&()<>\\!{}[\]#~\n\r]/.test(value)) {
    throw new Error(`${label} contains invalid characters`);
  }
  return value;
}

// For values written to .env files (not shell commands), we only need
// to reject newlines/carriage returns which could corrupt the file format.
function sanitizeEnvValue(value: string, label = "Value"): string {
  if (/[\n\r]/.test(value)) {
    throw new Error(`${label} contains invalid characters`);
  }
  return value;
}

// Find the openclaw binary — it may be installed under a different Node version via nvm
function findOpenClawBin(): string | null {
  // Check common locations
  const candidates = [
    "openclaw", // in PATH
    path.join(homedir(), ".nvm/versions/node/v22.22.2/bin/openclaw"),
    path.join(homedir(), ".nvm/versions/node/v24.14.1/bin/openclaw"),
  ];

  // Also search all nvm versions
  try {
    const nvmDir = path.join(homedir(), ".nvm/versions/node");
    if (existsSync(nvmDir)) {
      const versions = require("fs").readdirSync(nvmDir) as string[];
      for (const v of versions) {
        candidates.push(path.join(nvmDir, v, "bin/openclaw"));
      }
    }
  } catch {}

  for (const bin of candidates) {
    try {
      if (bin === "openclaw") {
        execSync("which openclaw", { stdio: "pipe" });
        return "openclaw";
      } else if (existsSync(bin)) {
        return bin;
      }
    } catch {}
  }
  return null;
}

const OPENCLAW_BIN = findOpenClawBin();

// ─── Read/write config ────────────────────────────────

function readConfig(): Record<string, any> {
  if (!existsSync(CONFIG_PATH)) return {};
  return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
}

function writeConfig(config: Record<string, any>) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// ─── Check if OpenClaw is installed ───────────────────

export function isOpenClawInstalled(): boolean {
  return OPENCLAW_BIN !== null;
}

export function getOpenClawStatus(): {
  installed: boolean;
  gatewayRunning: boolean;
  telegramConnected: boolean;
  botUsername: string | null;
} {
  const installed = isOpenClawInstalled();
  if (!installed) {
    return { installed: false, gatewayRunning: false, telegramConnected: false, botUsername: null };
  }

  // Infer status from config + plist existence (instant, no shell call)
  let gatewayRunning = false;
  let telegramConnected = false;
  try {
    const plistPath = path.join(homedir(), "Library/LaunchAgents/ai.openclaw.gateway.plist");
    gatewayRunning = existsSync(plistPath);
    const config = readConfig();
    telegramConnected = gatewayRunning && !!config?.channels?.telegram?.enabled;
  } catch {}

  const config = readConfig();
  const botUsername = config?.channels?.telegram?.botUsername || null;

  return { installed, gatewayRunning, telegramConnected, botUsername };
}

// ─── Configure Telegram ───────────────────────────────

export function configureTelegram(opts: {
  botToken: string;
  botUsername: string;
  groupChatId?: string;
  serviceToken: string;
  orgId: string;
  geminiApiKey?: string;
  eventOsUrl?: string;
}) {
  const config = readConfig();

  // Set gateway mode
  if (!config.gateway) config.gateway = {};
  config.gateway.mode = "local";
  config.gateway.bind = "loopback";

  // Configure Telegram channel
  if (!config.channels) config.channels = {};
  config.channels.telegram = {
    enabled: true,
    botToken: opts.botToken,
    dmPolicy: "allowlist",
    allowFrom: ["*"],
    ...(opts.groupChatId ? {
      groups: { [opts.groupChatId]: { requireMention: true } },
    } : {}),
  };

  // Configure event-os skill env vars
  if (!config.skills) config.skills = {};
  if (!config.skills.entries) config.skills.entries = {};
  config.skills.entries["event-os"] = {
    enabled: true,
    env: {
      EVENT_OS_URL: opts.eventOsUrl || "http://localhost:3000",
      EVENT_OS_TOKEN: opts.serviceToken,
      EVENT_OS_ORG_ID: opts.orgId,
    },
  };

  writeConfig(config);

  // Ensure GEMINI_API_KEY is in the gateway's env
  if (opts.geminiApiKey) {
    try {
      const safeKey = sanitizeShellValue(opts.geminiApiKey, "Gemini API key");
      const plistPath = path.join(homedir(), "Library/LaunchAgents/ai.openclaw.gateway.plist");
      if (existsSync(plistPath)) {
        // macOS: inject into LaunchAgent plist
        execSync(`/usr/libexec/PlistBuddy -c "Set :EnvironmentVariables:GEMINI_API_KEY ${safeKey}" "${plistPath}" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :EnvironmentVariables:GEMINI_API_KEY string ${safeKey}" "${plistPath}"`, { stdio: "pipe" });
      }
    } catch {}
  }

  // Install skill if not exists
  const skillDir = path.join(OPENCLAW_DIR, "skills", "event-os");
  if (!existsSync(skillDir)) {
    mkdirSync(skillDir, { recursive: true });
  }
  // Copy our SKILL.md
  const repoSkill = path.join(process.cwd(), "openclaw", "SKILL.md");
  if (existsSync(repoSkill)) {
    const content = readFileSync(repoSkill, "utf-8");
    writeFileSync(path.join(skillDir, "SKILL.md"), content);
  }

  // Write SOUL.md + AGENTS.md
  const workspace = path.join(OPENCLAW_DIR, "workspace");
  if (existsSync(workspace)) {
    writeFileSync(path.join(workspace, "SOUL.md"), `You are Event OS Bot — an event management assistant.

You help the organizing team manage speakers, sponsors, venues, booths, volunteers,
media partners, tasks, and campaigns through natural conversation.

Tone: professional but friendly. Concise responses. Use bullet points for lists.
Support English, Mongolian (Cyrillic), and transliterated Mongolian.

You are NOT a general-purpose AI. If asked to do anything unrelated to event
management, politely decline.

You cannot process images or files. If a user sends media, tell them to upload
via the Event OS web dashboard instead.
`);

    writeFileSync(path.join(workspace, "AGENTS.md"), `# Operating Instructions

You are Event OS Bot. You manage event data by calling an external API using curl.

## CRITICAL: Use the exec tool to run curl commands

When a user asks about event data:

1. Identify the user via the event-os skill's identify_user tool
2. Send their EXACT message to Event OS via the event_os_action tool
3. Return the response to the user

## STRICT RULES
- NEVER fabricate data. Only pass the user's exact words.
- NEVER make up entity names, emails, or any data.
- For greetings (/start, hi, hello), respond directly without calling the API.
- The environment variables EVENT_OS_URL, EVENT_OS_TOKEN, EVENT_OS_ORG_ID are set.
`);
  }
}

// ─── Add group chat ───────────────────────────────────

export function addTelegramGroup(groupChatId: string) {
  const config = readConfig();
  if (!config.channels?.telegram) return;

  if (!config.channels.telegram.groups) {
    config.channels.telegram.groups = {};
  }
  config.channels.telegram.groups[groupChatId] = { requireMention: true };

  writeConfig(config);
}

// ─── Configure Discord ────────────────────────────────

export function configureDiscord(opts: {
  botToken: string;
  botUsername: string;
  serverId: string;
  serviceToken: string;
  orgId: string;
  geminiApiKey?: string;
  eventOsUrl?: string;
}) {
  const config = readConfig();

  // Gateway mode
  if (!config.gateway) config.gateway = {};
  config.gateway.mode = "local";
  config.gateway.bind = "loopback";

  // Configure Discord channel
  if (!config.channels) config.channels = {};
  config.channels.discord = {
    enabled: true,
    token: opts.botToken,
    groupPolicy: "allowlist",
    ackReactionScope: "off",
    guilds: {
      [opts.serverId]: { requireMention: true },
    },
  };

  // Configure skill env vars (shared with Telegram)
  if (!config.skills) config.skills = {};
  if (!config.skills.entries) config.skills.entries = {};
  config.skills.entries["event-os"] = {
    enabled: true,
    env: {
      EVENT_OS_URL: opts.eventOsUrl || "http://localhost:3000",
      EVENT_OS_TOKEN: opts.serviceToken,
      EVENT_OS_ORG_ID: opts.orgId,
    },
  };

  writeConfig(config);

  // Ensure skill + workspace files exist
  ensureSkillFiles();

  // Set DISCORD_BOT_TOKEN env for the gateway
  if (opts.botToken) {
    try {
      const safeToken = sanitizeShellValue(opts.botToken, "Discord bot token");
      const plistPath = path.join(homedir(), "Library/LaunchAgents/ai.openclaw.gateway.plist");
      if (existsSync(plistPath)) {
        execSync(`/usr/libexec/PlistBuddy -c "Set :EnvironmentVariables:DISCORD_BOT_TOKEN ${safeToken}" "${plistPath}" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :EnvironmentVariables:DISCORD_BOT_TOKEN string ${safeToken}" "${plistPath}"`, { stdio: "pipe" });
      }
    } catch {}
  }
}

// ─── Update bot personality ───────────────────────────

const MOOD_DESCRIPTIONS: Record<string, string> = {
  professional: "Professional and concise. Straight to the point.",
  friendly: "Warm and encouraging. Use casual language, be supportive.",
  sarcastic: "Witty and sarcastic. Dry humor, but still helpful. Never mean.",
  nerdy: "Enthusiastic tech nerd. Use analogies, get excited about data, occasional references.",
  funny: "Light-hearted and humorous. Crack relevant jokes, keep it fun.",
};

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  auto: "Respond in the same language the user writes in.",
  en: "Always respond in English.",
  mn: "Always respond in Mongolian (Cyrillic script).",
  ko: "Always respond in Korean.",
  ja: "Always respond in Japanese.",
  zh: "Always respond in Chinese (Simplified).",
  ru: "Always respond in Russian.",
};

export function updateBotPersonality(language: string, mood: string) {
  const workspace = path.join(OPENCLAW_DIR, "workspace");
  if (!existsSync(workspace)) return;

  const langInstruction = LANGUAGE_INSTRUCTIONS[language] || LANGUAGE_INSTRUCTIONS.auto;
  const moodDescription = MOOD_DESCRIPTIONS[mood] || MOOD_DESCRIPTIONS.professional;

  writeFileSync(path.join(workspace, "SOUL.md"), `You are Event OS Bot — an event management assistant.

You help the organizing team manage speakers, sponsors, venues, booths, volunteers,
media partners, tasks, and campaigns through natural conversation.

PERSONALITY: ${moodDescription}

LANGUAGE: ${langInstruction}

You are NOT a general-purpose AI. If asked to do anything unrelated to event
management, politely decline.

You cannot process images or files. If a user sends media, tell them to upload
via the Event OS web dashboard instead.
`);
}

// ─── Shared: ensure skill + workspace files ───────────

function ensureSkillFiles() {
  const skillDir = path.join(OPENCLAW_DIR, "skills", "event-os");
  if (!existsSync(skillDir)) mkdirSync(skillDir, { recursive: true });

  const repoSkill = path.join(process.cwd(), "openclaw", "SKILL.md");
  if (existsSync(repoSkill)) {
    writeFileSync(path.join(skillDir, "SKILL.md"), readFileSync(repoSkill, "utf-8"));
  }
}

// ─── Gateway control ──────────────────────────────────

// OpenClaw needs Node 22+ to run. Ensure the right PATH when calling it.
function openclawExec(cmd: string, timeout = 10000): string {
  if (!OPENCLAW_BIN) throw new Error("OpenClaw not installed");
  const binDir = path.dirname(OPENCLAW_BIN);
  const env = { ...process.env, PATH: `${binDir}:${process.env.PATH}` };
  return execSync(`${OPENCLAW_BIN} ${cmd} 2>&1`, { stdio: "pipe", timeout, env }).toString();
}

export function restartGateway(): { ok: boolean; error?: string } {
  if (!OPENCLAW_BIN) return { ok: false, error: "OpenClaw not installed" };
  try {
    // Always force-reinstall to ensure the plist has the latest config/token.
    // A simple "restart" fails when the LaunchAgent is stale.
    openclawExec("gateway install --force", 15000);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message?.slice(0, 200) };
  }
}

// ─── Update LLM config ───────────────────────────────

const PROVIDER_MODEL_PREFIX: Record<string, string> = {
  gemini: "google",
  zai: "zai",
  xai: "xai",
  ollama: "ollama",
};

const PROVIDER_ENV_KEY: Record<string, string> = {
  gemini: "GEMINI_API_KEY",
  zai: "ZAI_API_KEY",
  xai: "XAI_API_KEY",
};

export function updateLlmConfig(provider: string, model?: string, apiKey?: string) {
  if (!OPENCLAW_BIN) return;

  const prefix = PROVIDER_MODEL_PREFIX[provider];
  if (!prefix) return;

  const modelId = model ? `${prefix}/${model}` : `${prefix}/default`;
  const safeModelId = sanitizeShellValue(modelId, "Model ID");

  // Update model in openclaw.json
  try {
    openclawExec(`config set agents.defaults.model.primary "${safeModelId}"`, 5000);
  } catch {}

  // Write API key to ~/.openclaw/.env
  if (apiKey) {
    const envKey = PROVIDER_ENV_KEY[provider];
    if (envKey) {
      try {
        const safeApiKey = sanitizeEnvValue(apiKey, "API key");
        const envPath = path.join(OPENCLAW_DIR, ".env");
        let envContent = "";
        if (existsSync(envPath)) {
          envContent = readFileSync(envPath, "utf-8");
        }
        // Replace or append the key
        const regex = new RegExp(`^${envKey}=.*$`, "m");
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${envKey}=${safeApiKey}`);
        } else {
          envContent = envContent.trimEnd() + `\n${envKey}=${safeApiKey}\n`;
        }
        writeFileSync(envPath, envContent);
      } catch {}
    }
  }

  // Restart gateway to pick up changes
  try {
    openclawExec("gateway install --force", 15000);
  } catch {}
}

export function stopGateway(): { ok: boolean } {
  if (!OPENCLAW_BIN) return { ok: true };
  try {
    openclawExec("gateway stop", 5000);
    return { ok: true };
  } catch {
    return { ok: true };
  }
}
