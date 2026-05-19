import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AttendeesClient } from "@/app/events/[slug]/attendees/client";

describe("AttendeesClient", () => {
  it("shows company purchaser details for ticket registrations", () => {
    const html = renderToStaticMarkup(
      <AttendeesClient
        stats={{ total: 1, checkedIn: 0, remaining: 1, percentage: 0 }}
        initialAttendees={[
          {
            id: "attendee-1",
            name: "Buyer",
            email: "buyer@example.com",
            ticketType: "regular",
            qrHash: "qr-hash",
            checkedIn: false,
            checkedInAt: null,
            source: "ticket",
            ticketOrderId: "order-1",
            purchaserType: "company",
            purchaserCompany: "DevSummit LLC",
            companyRegistrationNumber: "1234567",
          },
        ]}
      />,
    );

    expect(html).toContain("Company");
    expect(html).toContain("DevSummit LLC");
    expect(html).toContain("1234567");
  });
});
