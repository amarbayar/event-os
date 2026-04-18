import { describe, expect, it } from "vitest";
import { readRelayError } from "@/lib/bots/relay";

describe("readRelayError", () => {
  it("uses the API's user-facing message when present", async () => {
    const response = new Response(
      JSON.stringify({
        data: { message: "Agent temporarily unavailable. Try again or use manual add." },
        error: "Z.AI API error (502): upstream timeout",
      }),
      {
        status: 502,
        statusText: "Bad Gateway",
        headers: { "Content-Type": "application/json" },
      },
    );

    const err = await readRelayError(response, "Fallback");

    expect(err.userMessage).toBe("Agent temporarily unavailable. Try again or use manual add.");
    expect(err.status).toBe(502);
    expect(err.message).toContain("Bad Gateway");
    expect(err.message).toContain("upstream timeout");
  });

  it("falls back to plain-text responses", async () => {
    const response = new Response("Temporary upstream error", {
      status: 503,
      statusText: "Service Unavailable",
      headers: { "Content-Type": "text/plain" },
    });

    const err = await readRelayError(response, "Fallback");

    expect(err.userMessage).toBe("Temporary upstream error");
    expect(err.status).toBe(503);
  });
});
