import { describe, expect, it } from "vitest";
import { getAgentProcessFailure } from "@/lib/agent/process-error";

describe("getAgentProcessFailure", () => {
  it("maps upstream rate limits to a user-facing 429", () => {
    const failure = getAgentProcessFailure(
      new Error('Z.AI API error (429): {"error":{"code":"1302","message":"Rate limit reached"}}')
    );

    expect(failure.status).toBe(429);
    expect(failure.userMessage).toContain("rate-limited");
    expect(failure.retryAfterSeconds).toBe(10);
  });

  it("maps upstream auth failures to a configuration message", () => {
    const failure = getAgentProcessFailure(
      new Error('Gemini API error (401): {"error":{"message":"invalid key"}}')
    );

    expect(failure.status).toBe(502);
    expect(failure.userMessage).toContain("configuration");
  });

  it("falls back to a generic upstream failure message", () => {
    const failure = getAgentProcessFailure(new Error("socket hang up"));

    expect(failure.status).toBe(502);
    expect(failure.userMessage).toContain("temporarily unavailable");
  });
});
