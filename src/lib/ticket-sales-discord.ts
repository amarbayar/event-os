export type TicketSaleDiscordItem = {
  ticketTypeName: string;
  quantity: number;
  totalAmount: number;
  currency: string;
};

export type TicketSaleDiscordMessage = {
  orderId: string;
  purchaserName: string;
  purchaserEmail: string;
  totalAmount: number;
  currency: string;
  paidAt: Date;
  items: TicketSaleDiscordItem[];
};

function formatMoney(amount: number, currency: string) {
  return `${new Intl.NumberFormat("en-US").format(amount)} ${currency}`;
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

export async function postTicketSaleDiscordMessage(
  message: TicketSaleDiscordMessage,
): Promise<void> {
  const webhookUrl = process.env.DISCORD_TICKET_SALES_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const items = message.items
      .map((item) => {
        return `${item.quantity} x ${item.ticketTypeName} — ${formatMoney(
          item.totalAmount,
          item.currency,
        )}`;
      })
      .join("\n");

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "DevSummit Tickets",
        allowed_mentions: { parse: [] },
        embeds: [
          {
            title: "Ticket purchase confirmed",
            color: 0x10b981,
            fields: [
              {
                name: "Purchaser",
                value: truncate(`${message.purchaserName} <${message.purchaserEmail}>`, 1024),
                inline: false,
              },
              {
                name: "Tickets",
                value: truncate(items || "No ticket items", 1024),
                inline: false,
              },
              {
                name: "Total",
                value: formatMoney(message.totalAmount, message.currency),
                inline: true,
              },
              {
                name: "Order",
                value: message.orderId,
                inline: true,
              },
            ],
            timestamp: message.paidAt.toISOString(),
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error("Discord ticket sales webhook failed:", res.status);
    }
  } catch (error) {
    console.error("Discord ticket sales webhook failed:", error);
  }
}
