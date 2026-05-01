import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TicketsClient } from "@/app/events/[slug]/tickets/client";

describe("TicketsClient", () => {
  it("renders the organizer ticket sales shell before browser data loads", () => {
    const html = renderToStaticMarkup(<TicketsClient />);

    expect(html).toContain("Ticket Sales");
    expect(html).toContain("Server-priced checkout");
    expect(html).toContain("Create Ticket Type");
    expect(html).toContain("Sales Progress");
  });
});
