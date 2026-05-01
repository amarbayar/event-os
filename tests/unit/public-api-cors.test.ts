import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { corsHeaders } from "@/lib/public-api";

describe("public API CORS", () => {
  it("allows the local DevSummit Vite app in development", () => {
    const req = new NextRequest("http://localhost:3000/api/public/events/devsummit-2026/ticket-types", {
      headers: { origin: "http://localhost:5173" },
    });

    expect(corsHeaders(req)).toMatchObject({
      "Access-Control-Allow-Origin": "http://localhost:5173",
    });
  });
});
