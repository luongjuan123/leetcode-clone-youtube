import {
	EmailLayout,
	EmailHeader,
	EmailFooter,
	PrimaryButton,
	InfoRow,
	InfoTable,
	COLORS
} from "./emailComponents";

export interface EmailDetailsItem {
	label: string;
	value: string;
	isHighlight?: boolean;
}

export interface EmailTemplateOptions {
	headerTitle: string; // e.g. "NEW CONTEST" or "REGISTRATION CONFIRMED"
	accentColor: string; // e.g. "#f97316" (orange), "#10b981" (green), "#ef4444" (red)
	accentGlowColor?: string; // Kept for backwards compatibility
	title: string; // Headline title
	leadText: string; // Salutation / main intro
	description?: string; // Optional paragraph body
	details: EmailDetailsItem[];
	ctaText?: string;
	ctaUrl?: string;
	footerText?: string; // Kept for backwards compatibility
	recipientEmail?: string;
	preferenceType?: string; // e.g. "reminders", "achievements", "editorials", etc.
}

export function getEmailHtml(options: EmailTemplateOptions): string {
	const {
		headerTitle,
		accentColor,
		title,
		leadText,
		description = "",
		details,
		ctaText,
		ctaUrl,
		recipientEmail,
		preferenceType
	} = options;

	// Render details using InfoRow
	const detailsRowsHtml = details
		.map((item) =>
			InfoRow({
				label: item.label,
				value: item.value,
				isHighlight: item.isHighlight,
				accentColor: accentColor || COLORS.accent
			})
		)
		.join("");

	// Build the complete inside-card body layout
	const bodyContent = `
		${EmailHeader({ headerTitle, accentColor })}
		
		<!-- Content Body -->
		<tr>
			<td style="padding: 40px 35px 35px 35px; background-color: ${COLORS.card}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
				<h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 800; line-height: 1.3; color: ${COLORS.primaryText}; letter-spacing: -0.5px;">
					${title}
				</h1>
				
				<p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: ${COLORS.secondaryText}; font-weight: 500;">
					${leadText}
				</p>
				
				${description ? `
				<p style="margin: 0 0 30px 0; font-size: 14px; line-height: 1.6; color: ${COLORS.mutedText};">
					${description}
				</p>
				` : ""}

				<!-- Details Card -->
				${details.length > 0 ? InfoTable({ content: detailsRowsHtml, accentColor }) : ""}

				<!-- CTA Block -->
				${ctaText && ctaUrl ? PrimaryButton({ text: ctaText, url: ctaUrl, accentColor }) : ""}
			</td>
		</tr>

		${EmailFooter({ recipientEmail, preferenceType })}
	`;

	return EmailLayout({
		title,
		previewText: leadText,
		bodyContent
	});
}
