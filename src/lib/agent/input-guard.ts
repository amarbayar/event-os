// ─── Agent Input Guard ────────────────────────────────
//
//  Defense-in-depth against prompt injection and hijacking.
//
//  Layers:
//  1. @mention gating — only classify when explicitly addressed
//  2. Input sanitization — block technical injection tokens
//  3. Off-topic / schema probing / security — handled by LLM prompt
//     (works across ALL languages, see CLASSIFY_PROMPT security section)
//
//  Design principle: regex only catches language-agnostic technical
//  patterns (token delimiters, code injection). All semantic filtering
//  (off-topic, prompt override, schema probing) is done by the LLM
//  because regex can't generalize across languages.

// ─── Layer 1: @mention gating ─────────────────────────
//
//  In group chats (Telegram, Discord, WhatsApp), the agent
//  should only respond when explicitly mentioned with @.
//  In the web UI chat panel, every message is directed at
//  the agent, so gating is skipped.

export type GateResult =
  | { shouldProcess: true; cleanedInput: string }
  | { shouldProcess: false; reason: string };

const AGENT_MENTIONS = [
  "@agent", "@bot", "@assistant", "@eventbot", "@eventos",
];

export function gateMention(
  input: string,
  source: "web" | "telegram" | "discord" | "whatsapp" | "api"
): GateResult {
  // Web UI and API: always process (user is talking directly to agent)
  if (source === "web" || source === "api") {
    return { shouldProcess: true, cleanedInput: input.trim() };
  }

  // Group chat platforms: require @mention
  const lower = input.toLowerCase().trim();
  for (const mention of AGENT_MENTIONS) {
    if (lower.startsWith(mention)) {
      const cleaned = input.slice(mention.length).trim();
      return { shouldProcess: true, cleanedInput: cleaned || input };
    }
  }

  return { shouldProcess: false, reason: "not_mentioned" };
}

// ─── Layer 2: Input sanitization ──────────────────────
//
//  Blocks technical injection tokens that are language-agnostic.
//  These are LLM control sequences and code execution patterns —
//  no legitimate user input contains them.
//
//  Semantic attacks ("ignore your instructions", "pretend to be X",
//  "what columns exist") are handled by the LLM's CLASSIFY_PROMPT
//  security rules, which work in all languages.

export type SanitizeResult = {
  sanitized: string;
  flags: string[];
  blocked: boolean;
  blockReason?: string;
};

// Technical injection patterns — language-agnostic, always malicious
const BLOCK_PATTERNS = [
  // Code execution
  /eval\s*\(/i,
  /exec\s*\(/i,
  /base64_decode/i,
  /\\x[0-9a-f]{2}\\x[0-9a-f]{2}\\x[0-9a-f]{2}/i,
  // LLM token delimiters (used to break out of prompt framing)
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /<\|endoftext\|>/i,
  /\[\/INST\]/i,
  /<<\s*SYS\s*>>/i,
];

export function sanitizeInput(input: string): SanitizeResult {
  const flags: string[] = [];

  // Block technical injection patterns
  for (const pattern of BLOCK_PATTERNS) {
    if (pattern.test(input)) {
      return {
        sanitized: "",
        flags: ["blocked_injection_attempt"],
        blocked: true,
        blockReason: "I can only help with event management tasks.",
      };
    }
  }

  // Length guard — extremely long inputs are suspicious
  let sanitized = input;
  if (input.length > 5000) {
    flags.push("excessive_length");
    sanitized = sanitized.slice(0, 5000);
  }

  return { sanitized, flags, blocked: false };
}

// ─── Layer 3: Off-topic detection ─────────────────────
//
//  Handled entirely by the LLM via CLASSIFY_PROMPT security rules.
//  The LLM understands intent in all languages and responds with
//  intent="chitchat" + polite refusal for off-topic requests.
//
//  This function is kept as a no-op for backward compatibility
//  with callers that still invoke it.

export function isOffTopic(_input: string): { offTopic: boolean; message?: string } {
  return { offTopic: false };
}
