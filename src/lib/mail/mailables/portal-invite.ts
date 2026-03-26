import type { Mailable } from "../types";
import { baseLayout, escapeHtml } from "../templates/base-layout";

type PortalInviteData = {
  name: string;
  tempPassword: string;
  portalUrl: string;
  organizationName: string;
};

export function portalInvite(data: PortalInviteData): Mailable {
  const name = escapeHtml(data.name);
  const orgName = escapeHtml(data.organizationName);
  const password = escapeHtml(data.tempPassword);
  const url = escapeHtml(data.portalUrl);

  return {
    subject: `You're invited to the ${data.organizationName} portal`,
    html: baseLayout(`
      <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1c1917;">Hello ${name},</h2>
      <p style="margin: 0 0 16px 0;">You've been invited to the <strong>${orgName}</strong> stakeholder portal. Here you can view and manage your profile, checklist items, and more.</p>
      <p style="margin: 0 0 8px 0;">Your temporary password:</p>
      <p style="margin: 0 0 24px 0; padding: 12px 16px; background-color: #fafaf9; border: 1px solid #e7e5e4; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 14px; letter-spacing: 0.05em;">${password}</p>
      <a href="${url}" style="display: inline-block; padding: 10px 24px; background-color: #eab308; color: #1c1917; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">Sign in to your portal</a>
      <p style="margin: 24px 0 0 0; font-size: 12px; color: #a8a29e;">Please change your password after your first sign-in.</p>
    `),
    text: `Hello ${data.name},\n\nYou've been invited to the ${data.organizationName} stakeholder portal.\n\nYour temporary password: ${data.tempPassword}\n\nSign in at: ${data.portalUrl}\n\nPlease change your password after your first sign-in.`,
    tags: ["portal-invite"],
  };
}
