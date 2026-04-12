// tests/integration/api-translate.test.ts

import { POST } from "@/app/api/translate/route";
import { NextRequest } from "next/server";
import { describe, it, expect } from "vitest";

describe("POST /api/translate", () => {
  it("returns translated text", async () => {
    const req = new NextRequest("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        text: "Hello",
        target: "Mongolian",
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.translated).toBeTruthy();
  });
});
