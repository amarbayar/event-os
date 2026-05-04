import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { postTicketSaleDiscordMessage } from "@/lib/ticket-sales-discord";

describe("ticket sales Discord webhook", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.unstubAllEnvs();
    fetchMock.mockReset().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("does nothing when no webhook URL is configured", async () => {
    await postTicketSaleDiscordMessage({
      orderId: "order-1",
      purchaserName: "Buyer",
      purchaserEmail: "buyer@example.com",
      totalAmount: 100_000,
      currency: "MNT",
      paidAt: new Date("2026-05-30T10:00:00Z"),
      items: [],
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts a safe Discord embed with mentions disabled", async () => {
    vi.stubEnv("DISCORD_TICKET_SALES_WEBHOOK_URL", "https://discord.invalid/webhook");

    await postTicketSaleDiscordMessage({
      orderId: "order-1",
      purchaserName: "@everyone Buyer",
      purchaserEmail: "buyer@example.com",
      totalAmount: 100_000,
      currency: "MNT",
      paidAt: new Date("2026-05-30T10:00:00Z"),
      items: [
        {
          ticketTypeName: "General Admission",
          quantity: 2,
          totalAmount: 100_000,
          currency: "MNT",
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://discord.invalid/webhook",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.allowed_mentions).toEqual({ parse: [] });
    expect(body.embeds[0].title).toBe("Ticket purchase confirmed");
    expect(body.embeds[0].fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Total", value: "100,000 MNT" }),
        expect.objectContaining({ name: "Order", value: "order-1" }),
      ]),
    );
  });
});
