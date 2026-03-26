/**
 * Escape HTML special characters to prevent XSS in email templates.
 * All user-provided data must pass through this before interpolation.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Wrap email content in a branded HTML layout with inline CSS.
 * Email clients strip <style> blocks, so all styles are inline.
 * Uses Event OS brand colors from DESIGN.md.
 */
export function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Event OS</title>
</head>
<body style="margin: 0; padding: 0; background-color: #fafaf9; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1c1917; font-size: 14px; line-height: 1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fafaf9;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%;">
          <!-- Header -->
          <tr>
            <td style="padding: 24px 0 16px 0;">
              <span style="font-size: 20px; font-weight: 700; color: #1c1917; letter-spacing: -0.02em;">Event OS</span>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="background-color: #ffffff; border: 1px solid #e7e5e4; border-radius: 6px; padding: 32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #a8a29e;">
                Sent by Event OS
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
