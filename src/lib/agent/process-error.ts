export interface AgentProcessFailure {
  status: number;
  userMessage: string;
  retryAfterSeconds?: number;
}

const DEFAULT_FAILURE: AgentProcessFailure = {
  status: 502,
  userMessage: "Agent temporarily unavailable. Try again or use manual add.",
};

export function getAgentProcessFailure(error: unknown): AgentProcessFailure {
  if (!(error instanceof Error)) {
    return DEFAULT_FAILURE;
  }

  const match = error.message.match(/API error \((\d{3})\)/i);
  const upstreamStatus = match ? Number(match[1]) : null;

  if (upstreamStatus === 429) {
    return {
      status: 429,
      userMessage: "The AI provider is rate-limited right now. Please try again in a moment.",
      retryAfterSeconds: 10,
    };
  }

  if (upstreamStatus === 401 || upstreamStatus === 403) {
    return {
      status: 502,
      userMessage: "Agent configuration needs attention. Please contact an admin or use manual add.",
    };
  }

  return DEFAULT_FAILURE;
}
