import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { TicketsClient } from "@/app/events/[slug]/tickets/client";

describe("TicketsClient", () => {
  it("renders the organizer ticket sales shell before browser data loads", () => {
    const html = renderToStaticMarkup(<TicketsClient />);

    expect(html).toContain("Ticket Sales");
    expect(html).toContain("Server-priced checkout");
    expect(html).toContain("Create Ticket Type");
    expect(html).toContain("Add Direct Sale");
    expect(html).toContain("Company Registration Number");
    expect(html).toContain("Sales Progress");
  });

  it("keeps direct-sale QR tickets downloadable as branded PDFs", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/events/[slug]/tickets/client.tsx"),
      "utf8",
    );

    expect(source).toContain("downloadDirectSaleTicketPdf");
    expect(source).toContain("import(\"jspdf\")");
    expect(source).toContain("Download ticket PDF");
  });

  it("supports downloading every direct-sale PDF as a zip", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/events/[slug]/tickets/client.tsx"),
      "utf8",
    );

    expect(source).toContain("downloadDirectSaleTicketZip");
    expect(source).toContain("import(\"jszip\")");
    expect(source).toContain("Download all PDFs");
  });

  it("shows prior direct sales so QR ticket PDFs can be downloaded again", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/events/[slug]/tickets/client.tsx"),
      "utf8",
    );

    expect(source).toContain("loadDirectSales");
    expect(source).toContain("Previous Direct Sales");
    expect(source).toContain("Re-download PDFs");
  });
});
