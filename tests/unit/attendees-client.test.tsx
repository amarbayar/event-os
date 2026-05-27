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

  it("includes a buyer type filter for individual and company registrations", () => {
    const html = renderToStaticMarkup(
      <AttendeesClient
        stats={{ total: 2, checkedIn: 0, remaining: 2, percentage: 0 }}
        initialAttendees={[
          {
            id: "attendee-1",
            name: "Individual Buyer",
            email: "individual@example.com",
            ticketType: "regular",
            qrHash: "qr-1",
            checkedIn: false,
            checkedInAt: null,
            source: "ticket",
            ticketOrderId: "order-1",
            purchaserType: "individual",
            purchaserCompany: null,
            companyRegistrationNumber: null,
          },
          {
            id: "attendee-2",
            name: "Company Buyer",
            email: "company@example.com",
            ticketType: "regular",
            qrHash: "qr-2",
            checkedIn: false,
            checkedInAt: null,
            source: "ticket",
            ticketOrderId: "order-2",
            purchaserType: "company",
            purchaserCompany: "DevSummit LLC",
            companyRegistrationNumber: "1234567",
          },
        ]}
      />,
    );

    expect(html).toContain("All Buyers");
    expect(html).toContain("Individuals");
    expect(html).toContain("Companies");
  });

  it("supports filtering by ticket type and exporting the current view to XLSX", () => {
    const html = renderToStaticMarkup(
      <AttendeesClient
        stats={{ total: 2, checkedIn: 0, remaining: 2, percentage: 0 }}
        initialAttendees={[
          {
            id: "attendee-1",
            name: "Regular Buyer",
            email: "regular@example.com",
            ticketType: "regular",
            qrHash: "qr-1",
            checkedIn: false,
            checkedInAt: null,
            source: "ticket",
            ticketOrderId: "order-1",
            purchaserType: "individual",
            purchaserCompany: null,
            companyRegistrationNumber: null,
          },
          {
            id: "attendee-2",
            name: "VIP Buyer",
            email: "vip@example.com",
            ticketType: "vip",
            qrHash: "qr-2",
            checkedIn: false,
            checkedInAt: null,
            source: "ticket",
            ticketOrderId: "order-2",
            purchaserType: "company",
            purchaserCompany: "DevSummit LLC",
            companyRegistrationNumber: "1234567",
          },
        ]}
      />,
    );

    expect(html).toContain("All Ticket Types");
    expect(html).toContain("regular");
    expect(html).toContain("vip");
    expect(html).toContain("Export XLSX");
  });
});
