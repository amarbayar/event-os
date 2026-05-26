import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { InvitationsClient } from "@/app/events/[slug]/invitations/client";

describe("InvitationsClient", () => {
  it("replaces dead send actions with branded QR PDF downloads", () => {
    const html = renderToStaticMarkup(
      <InvitationsClient
        initialInvitations={[
          {
            id: "invitation-1",
            name: "Guest Buyer",
            email: "guest@example.com",
            type: "special_guest",
            status: "pending",
            invitedBy: "Organizer",
            sourceType: null,
            qrHash: "guest-qr-hash",
          },
        ]}
      />,
    );
    const source = readFileSync(
      join(process.cwd(), "src/app/events/[slug]/invitations/client.tsx"),
      "utf8",
    );

    expect(html).toContain("Download QR PDF");
    expect(html).not.toContain("Send Batch");
    expect(source).toContain("downloadInvitationTicketPdf");
    expect(source).toContain("import(\"jspdf\")");
    expect(source).toContain("import(\"qrcode\")");
    expect(source).not.toContain("<Send");
  });
});
