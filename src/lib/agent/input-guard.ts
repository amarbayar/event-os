// ─── Agent Input Guard ────────────────────────────────
//
//  Defense-in-depth against prompt injection and hijacking.
//
//  Layers:
//  1. @mention gating — only classify when explicitly addressed
//  2. Input sanitization — strip known injection patterns
//  3. Scope enforcement — reject off-topic requests at output
//
//  References:
//  - OWASP LLM Prompt Injection Prevention Cheat Sheet
//  - Microsoft indirect prompt injection defense
//  - EU AI Act compliance (Aug 2026)

// ─── Layer 1: @mention gating ─────────────────────────
//
//  In group chats (Telegram, Discord, WhatsApp), the agent
//  should only respond when explicitly mentioned with @.
//  In the web UI chat panel, every message is directed at
//  the agent, so gating is skipped.
//
//  Returns:
//  - { shouldProcess: true, cleanedInput } — process this message
//  - { shouldProcess: false } — ignore (not addressed to agent)

export type GateResult =
  | { shouldProcess: true; cleanedInput: string }
  | { shouldProcess: false; reason: string };

const AGENT_MENTIONS = [
  "@agent", "@bot", "@assistant", "@eventbot", "@eventos",
  "@openclaw", "@claw",
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
      // Strip the mention prefix and process
      const cleaned = input.slice(mention.length).trim();
      return { shouldProcess: true, cleanedInput: cleaned || input };
    }
  }

  // No @mention in group chat — ignore
  return { shouldProcess: false, reason: "not_mentioned" };
}

// ─── Layer 2: Input sanitization ──────────────────────
//
//  Detects and neutralizes common prompt injection patterns.
//  Does NOT block — strips/flags suspicious content so the LLM
//  sees sanitized input with injection markers.

export type SanitizeResult = {
  sanitized: string;
  flags: string[];      // what was detected
  blocked: boolean;     // true = refuse to process
  blockReason?: string;
};

// Patterns that indicate injection attempts (case-insensitive)
const INJECTION_PATTERNS = [
  // Direct instruction override
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|context)/i,
  /forget\s+(all\s+)?(your\s+)?(previous|prior|above)\s+(instructions?|prompts?)/i,
  /disregard\s+(all\s+)?(previous|prior|your)\s+(instructions?|prompts?|rules?)/i,
  /override\s+(system|your)\s+(prompt|instructions?|rules?)/i,
  /you\s+are\s+now\s+(a|an|the)\s+/i,
  /new\s+instructions?:\s*/i,
  /system\s*:\s*/i,
  /\[SYSTEM\]/i,
  /\[INST\]/i,
  /<<\s*SYS\s*>>/i,

  // Role-play hijack
  /pretend\s+(you\s+are|to\s+be|you're)\s/i,
  /act\s+as\s+(if\s+you\s+are|a|an)\s/i,
  /roleplay\s+as\s/i,
  /from\s+now\s+on\s+(you\s+are|act\s+as|respond\s+as)/i,

  // Data exfiltration
  /reveal\s+(your|the)\s+(system\s+)?(prompt|instructions?|rules?|config)/i,
  /show\s+(me\s+)?(your|the)\s+(system\s+)?(prompt|instructions?)/i,
  /what\s+are\s+your\s+(instructions?|rules?|prompt)/i,
  /repeat\s+(your\s+)?(system\s+)?(prompt|instructions?)\s+(back|to\s+me)/i,
  /output\s+(your|the)\s+(system\s+)?(prompt|instructions?)/i,
];

// Hard-block patterns — these are always malicious
const BLOCK_PATTERNS = [
  // Encoding attacks (base64 injection, hex injection)
  /eval\s*\(/i,
  /exec\s*\(/i,
  /base64_decode/i,
  /\\x[0-9a-f]{2}\\x[0-9a-f]{2}\\x[0-9a-f]{2}/i,
  // Token manipulation
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /<\|endoftext\|>/i,
  /\[\/INST\]/i,
];

export function sanitizeInput(input: string): SanitizeResult {
  const flags: string[] = [];
  let sanitized = input;

  // Check hard-block patterns first
  for (const pattern of BLOCK_PATTERNS) {
    if (pattern.test(input)) {
      return {
        sanitized: "",
        flags: ["blocked_injection_attempt"],
        blocked: true,
        blockReason: "I can only help with event management tasks. Please rephrase your request.",
      };
    }
  }

  // Check injection patterns — flag but don't block
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      flags.push("injection_pattern_detected");
      // Strip the injection attempt from the input
      sanitized = sanitized.replace(pattern, "[filtered]");
    }
  }

  // Length guard — extremely long inputs are suspicious
  if (input.length > 5000) {
    flags.push("excessive_length");
    sanitized = sanitized.slice(0, 5000);
  }

  return { sanitized, flags, blocked: false };
}

// ─── Layer 3: Output scope enforcement ────────────────
//
//  After the LLM classifies, verify the intent is within
//  the agent's domain. Off-topic chitchat is fine (handled
//  gracefully), but requests to do non-event things are rejected.

const OFF_TOPIC_INDICATORS = [
  /write\s+(me\s+)?(a|an)\s+(poem|story|essay|song|code|script)/i,
  /translate\s+.{20,}\s+(to|into)\s/i,
  /generate\s+(an?\s+)?(image|picture|photo|video)/i,
  /what\s+is\s+the\s+meaning\s+of\s+life/i,
  /help\s+me\s+(hack|break\s+into|crack)/i,
  /how\s+to\s+(make\s+a\s+bomb|build\s+a\s+weapon)/i,
];

export function isOffTopic(input: string): { offTopic: boolean; message?: string } {
  for (const pattern of OFF_TOPIC_INDICATORS) {
    if (pattern.test(input)) {
      return {
        offTopic: true,
        message: "I'm Event OS — I help manage events (speakers, sponsors, venues, tasks, etc.). I can't help with that, but feel free to ask about your event!",
      };
    }
  }
  return { offTopic: false };
}
