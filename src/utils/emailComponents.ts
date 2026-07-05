/**
 * Centralized Email Component System for BeastCode
 * Enforces WCAG AA contrast standards, uses solid color hex values,
 * and maintains readability across Gmail, Outlook, Apple Mail, and mobile clients.
 */

// Central design colors
export const COLORS = {
	background: "#0F1117",
	card: "#171A22",
	primaryText: "#FFFFFF",
	secondaryText: "#C8D0D8",
	mutedText: "#9CA3AF",
	accent: "#F5A623",
	success: "#16C784",
	warning: "#F59E0B",
	danger: "#EF4444",
	border: "#2B313D"
};

interface EmailLayoutProps {
	previewText?: string;
	title: string;
	bodyContent: string;
}

export function EmailLayout({ previewText, title, bodyContent }: EmailLayoutProps): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${COLORS.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: ${COLORS.primaryText};">
  ${previewText ? `<div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; color: ${COLORS.background};">${previewText}</div>` : ""}
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${COLORS.background}; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: ${COLORS.card}; border: 1px solid ${COLORS.border}; border-radius: 16px; overflow: hidden; border-collapse: separate;">
          ${bodyContent}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

interface EmailHeaderProps {
	headerTitle: string;
	accentColor?: string;
}

export function EmailHeader({ headerTitle, accentColor = COLORS.accent }: EmailHeaderProps): string {
	return `
    <!-- Header Section -->
    <tr>
      <td align="center" style="padding: 40px 30px 20px 30px; background-color: ${COLORS.card}; border-bottom: 1px solid ${COLORS.border};">
        <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 15px;">
          <tr>
            <td align="center" style="vertical-align: middle;">
              <svg width="42" height="42" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                <polygon points="50,6 90,28 90,72 50,94 10,72 10,28" stroke="${COLORS.accent}" stroke-width="6" stroke-linejoin="round" fill="${COLORS.background}" />
                <path d="M 37,32 L 21,50 L 37,68" stroke="${COLORS.primaryText}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M 63,32 L 79,50 L 63,68" stroke="${COLORS.primaryText}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M 57,26 L 43,74" stroke="${COLORS.accent}" stroke-width="8" stroke-linecap="round" />
              </svg>
            </td>
            <td style="font-size: 24px; font-weight: 900; letter-spacing: -1.5px; color: ${COLORS.primaryText}; padding-left: 12px; vertical-align: middle; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
              Beast<span style="color: ${COLORS.accent};">Code</span>
            </td>
          </tr>
        </table>
        
        <!-- Accent Badge -->
        <table border="0" cellpadding="0" cellspacing="0" style="margin-top: 15px;">
          <tr>
            <td style="border: 1px solid ${accentColor}; border-radius: 20px; padding: 6px 16px; background-color: ${COLORS.background}; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: ${accentColor};">
              ${headerTitle}
            </td>
          </tr>
        </table>
      </td>
    </tr>
	`;
}

interface EmailFooterProps {
	recipientEmail?: string;
	preferenceType?: string;
}

export function EmailFooter({ recipientEmail, preferenceType }: EmailFooterProps): string {
	const origin = process.env.NEXT_PUBLIC_APP_URL || "https://beastcode--beastcode-7555e.asia-southeast1.hosted.app";

	return `
    <!-- Footer Section -->
    <tr>
      <td style="padding: 30px 35px; border-top: 1px solid ${COLORS.border}; background-color: ${COLORS.card}; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <p style="margin: 0 0 10px 0; font-size: 11px; color: ${COLORS.mutedText}; line-height: 1.5;">
          You received this email because you are a registered developer on BeastCode.
        </p>
        <p style="margin: 0 0 16px 0; font-size: 11px; color: ${COLORS.mutedText}; line-height: 1.5;">
          ${recipientEmail ? `
          Sent to <span style="color: ${COLORS.primaryText}; font-weight: 600;">${recipientEmail}</span>. 
          <a href="${origin}/unsubscribe?email=${encodeURIComponent(recipientEmail)}${preferenceType ? `&type=${preferenceType}` : ""}" target="_blank" style="color: ${COLORS.accent}; text-decoration: none; font-weight: 600;">Unsubscribe</a> 
          &nbsp;&bull;&nbsp; 
          <a href="${origin}/settings" target="_blank" style="color: ${COLORS.accent}; text-decoration: none; font-weight: 600;">Notification Preferences</a>
          ` : `
          <a href="${origin}/settings" target="_blank" style="color: ${COLORS.accent}; text-decoration: none; font-weight: 600;">Manage Preferences</a>
          `}
        </p>
        <p style="margin: 0 0 16px 0; font-size: 11px; color: ${COLORS.mutedText};">
          <a href="https://github.com" target="_blank" style="color: ${COLORS.secondaryText}; text-decoration: none; margin: 0 8px; font-weight: 500;">GitHub</a> &nbsp;&bull;&nbsp;
          <a href="https://discord.gg" target="_blank" style="color: ${COLORS.secondaryText}; text-decoration: none; margin: 0 8px; font-weight: 500;">Discord</a> &nbsp;&bull;&nbsp;
          <a href="mailto:support@beastcode.codes" style="color: ${COLORS.secondaryText}; text-decoration: none; margin: 0 8px; font-weight: 500;">Support</a>
        </p>
        <p style="margin: 0; font-size: 10px; color: ${COLORS.mutedText};">
          &copy; 2026 BeastCode Platform. All rights reserved.
        </p>
      </td>
    </tr>
	`;
}

interface ButtonProps {
	text: string;
	url: string;
	accentColor?: string;
}

export function PrimaryButton({ text, url, accentColor = COLORS.accent }: ButtonProps): string {
	// For WCAG contrast compliance, we check the button's background and use #0F1117 (dark text) for lighter accents like orange and yellow.
	const isLightBackground = accentColor === COLORS.accent || accentColor === COLORS.warning || accentColor === COLORS.success || accentColor === "#10b981";
	const textColor = isLightBackground ? COLORS.background : COLORS.primaryText;

	return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px; margin-bottom: 20px;">
      <tr>
        <td align="center">
          <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate;">
            <tr>
              <td align="center" style="border-radius: 8px; background-color: ${accentColor};">
                <a href="${url}" target="_blank" style="display: inline-block; padding: 14px 36px; color: ${textColor}; text-decoration: none; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; border-radius: 8px; border: 1px solid ${accentColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                  ${text}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
	`;
}

export function SecondaryButton({ text, url }: ButtonProps): string {
	return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px; margin-bottom: 20px;">
      <tr>
        <td align="center">
          <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate;">
            <tr>
              <td align="center" style="border-radius: 8px; background-color: ${COLORS.card}; border: 1px solid ${COLORS.border};">
                <a href="${url}" target="_blank" style="display: inline-block; padding: 14px 36px; color: ${COLORS.primaryText}; text-decoration: none; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                  ${text}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
	`;
}

interface InfoRowProps {
	label: string;
	value: string;
	isHighlight?: boolean;
	accentColor?: string;
}

export function InfoRow({ label, value, isHighlight = false, accentColor = COLORS.accent }: InfoRowProps): string {
	const labelColor = accentColor;
	const valueColor = isHighlight ? accentColor : COLORS.primaryText;
	const fontWeight = isHighlight ? "700" : "500";

	return `
    <tr>
      <td style="padding: 10px 0; width: 35%; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: ${labelColor}; vertical-align: top; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        ${label}
      </td>
      <td style="padding: 10px 0; font-size: 14px; color: ${valueColor}; font-weight: ${fontWeight}; line-height: 1.4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        ${value}
      </td>
    </tr>
	`;
}

export function InfoTable({ content, accentColor = COLORS.accent }: { content: string; accentColor?: string }): string {
	return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${COLORS.background}; border: 1px solid ${COLORS.border}; border-left: 4px solid ${accentColor}; border-radius: 8px; margin-bottom: 25px; border-collapse: separate;">
      <tr>
        <td style="padding: 20px 20px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            ${content}
          </table>
        </td>
      </tr>
    </table>
	`;
}

interface MessageBoxProps {
	title?: string;
	message: string;
}

export function AlertBox({ title, message }: MessageBoxProps): string {
	return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #121F3D; border: 1px solid #3B82F6; border-radius: 8px; margin-bottom: 20px; border-collapse: separate;">
      <tr>
        <td style="padding: 16px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          ${title ? `<h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: ${COLORS.primaryText};">${title}</h4>` : ""}
          <p style="margin: 0; font-size: 13px; line-height: 1.5; color: ${COLORS.secondaryText};">${message}</p>
        </td>
      </tr>
    </table>
	`;
}

export function SuccessBox({ title, message }: MessageBoxProps): string {
	return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0E291D; border: 1px solid ${COLORS.success}; border-radius: 8px; margin-bottom: 20px; border-collapse: separate;">
      <tr>
        <td style="padding: 16px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          ${title ? `<h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: ${COLORS.primaryText};">${title}</h4>` : ""}
          <p style="margin: 0; font-size: 13px; line-height: 1.5; color: ${COLORS.secondaryText};">${message}</p>
        </td>
      </tr>
    </table>
	`;
}

export function WarningBox({ title, message }: MessageBoxProps): string {
	return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #2F210F; border: 1px solid ${COLORS.warning}; border-radius: 8px; margin-bottom: 20px; border-collapse: separate;">
      <tr>
        <td style="padding: 16px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          ${title ? `<h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: ${COLORS.primaryText};">${title}</h4>` : ""}
          <p style="margin: 0; font-size: 13px; line-height: 1.5; color: ${COLORS.secondaryText};">${message}</p>
        </td>
      </tr>
    </table>
	`;
}

export function DangerBox({ title, message }: MessageBoxProps): string {
	return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #2D1418; border: 1px solid ${COLORS.danger}; border-radius: 8px; margin-bottom: 20px; border-collapse: separate;">
      <tr>
        <td style="padding: 16px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          ${title ? `<h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: ${COLORS.primaryText};">${title}</h4>` : ""}
          <p style="margin: 0; font-size: 13px; line-height: 1.5; color: ${COLORS.secondaryText};">${message}</p>
        </td>
      </tr>
    </table>
	`;
}
