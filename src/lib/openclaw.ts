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

  let gatewayRunning = false;
  let telegramConnected = false;
  try {
    const status = openclawExec("channels status", 5000);
    gatewayRunning = status.includes("Gateway reachable");
    telegramConnected = status.includes("running, mode:polling");
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
    ackReaction: "👀",
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
      const plistPath = path.join(homedir(), "Library/LaunchAgents/ai.openclaw.gateway.plist");
      if (existsSync(plistPath)) {
        // macOS: inject into LaunchAgent plist
        execSync(`/usr/libexec/PlistBuddy -c "Set :EnvironmentVariables:GEMINI_API_KEY ${opts.geminiApiKey}" "${plistPath}" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :EnvironmentVariables:GEMINI_API_KEY string ${opts.geminiApiKey}" "${plistPath}"`, { stdio: "pipe" });
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

export function stopGateway(): { ok: boolean } {
  if (!OPENCLAW_BIN) return { ok: true };
  try {
    openclawExec("gateway stop", 5000);
    return { ok: true };
  } catch {
    return { ok: true };
  }
}
