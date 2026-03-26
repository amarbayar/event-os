import type { Mailable } from "../types";
import { baseLayout, escapeHtml } from "../templates/base-layout";

type PortalAddedData = {
  name: string;
  portalUrl: string;
  organizationName: string;
};

export function portalAdded(data: PortalAddedData): Mailable {
  const name = escapeHtml(data.name);
  const orgName = escapeHtml(data.organizationName);
  const url = escapeHtml(data.portalUrl);

  return {
    subject: `You've been added to ${data.organizationName}`,
    html: baseLayout(`
      <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1c1917;">Hello ${name},</h2>
      <p style="margin: 0 0 16px 0;">You've been added as a stakeholder for <strong>${orgName}</strong>. You can now access their portal using your existing account.</p>
      <a href="${url}" style="display: inline-block; padding: 10px 24px; background-color: #eab308; color: #1c1917; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">Go to your portal</a>
    `),
    text: `Hello ${data.name},\n\nYou've been added as a stakeholder for ${data.organizationName}. You can now access their portal using your existing account.\n\nSign in at: ${data.portalUrl}`,
    tags: ["portal-added"],
  };
}
