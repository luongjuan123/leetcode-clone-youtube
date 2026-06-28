export interface EmailDetailsItem {
	label: string;
	value: string;
	isHighlight?: boolean;
}

export interface EmailTemplateOptions {
	headerTitle: string; // e.g. "NEW CONTEST" or "REGISTRATION CONFIRMED"
	accentColor: string; // e.g. "#f97316" (orange), "#10b981" (green), "#ef4444" (red)
	accentGlowColor: string; // e.g. "rgba(249, 115, 22, 0.4)" or hex equivalent
	title: string; // Headline title
	leadText: string; // Salutation / main intro
	description?: string; // Optional paragraph body
	details: EmailDetailsItem[];
	ctaText?: string;
	ctaUrl?: string;
	footerText?: string;
	recipientEmail?: string;
	preferenceType?: string; // e.g. "reminders", "achievements", "editorials", etc.
}

export function getEmailHtml(options: EmailTemplateOptions): string {
	const {
		headerTitle,
		accentColor,
		accentGlowColor,
		title,
		leadText,
		description = "",
		details,
		ctaText,
		ctaUrl,
		footerText = "You received this email because you are a registered developer on BeastCode.",
		recipientEmail,
		preferenceType
	} = options;

	const origin = process.env.NEXT_PUBLIC_APP_URL || "https://beastcode--beastcode-7555e.asia-southeast1.hosted.app";

	// Build details table rows
	const detailsRowsHtml = details.map((item, idx) => {
		const isLast = idx === details.length - 1;
		const paddingBottom = isLast ? "0" : "14px";
		const labelColor = accentColor;
		const valueColor = item.isHighlight ? accentColor : "#e4e4e7";
		const fontWeight = item.isHighlight ? "700" : "500";

		return `
			<tr>
				<td style="padding-bottom: ${paddingBottom}; width: 35%; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: ${labelColor}; vertical-align: top;">
					${item.label}
				</td>
				<td style="padding-bottom: ${paddingBottom}; font-size: 14px; color: ${valueColor}; font-weight: ${fontWeight}; line-height: 1.4;">
					${item.value}
				</td>
			</tr>
		`;
	}).join("");

	// Build CTA Button block
	const ctaHtml = (ctaText && ctaUrl) ? `
		<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 15px;">
			<tr>
				<td align="center">
					<table border="0" cellpadding="0" cellspacing="0" style="border-collapse: separate;">
						<tr>
							<td align="center" style="border-radius: 8px; background: ${accentColor}; box-shadow: 0 0 20px ${accentGlowColor};">
								<a href="${ctaUrl}" target="_blank" style="display: inline-block; padding: 14px 36px; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; border-radius: 8px;">
									${ctaText}
								</a>
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>
	` : "";

	return `<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #ffffff;">
	<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #09090b; padding: 40px 20px;">
		<tr>
			<td align="center">
				<table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #141417; border: 1px solid rgba(255, 255, 255, 0.08); border-top: 3px solid ${accentColor}; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6), 0 0 30px ${accentGlowColor}; border-collapse: separate;">
					
					<!-- Header Section -->
					<tr>
						<td align="center" style="padding: 40px 30px 20px 30px; background-color: #0c0c0e; border-bottom: 1px solid rgba(255, 255, 255, 0.04);">
							<table border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 15px;">
								<tr>
									<td align="center" style="vertical-align: middle;">
										<!-- Glowing Vector Logo Hexagon -->
										<svg width="52" height="52" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
											<defs>
												<linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
													<stop offset="0%" stopColor="#f97316" />
													<stop offset="100%" stopColor="#ea580c" />
												</linearGradient>
											</defs>
											<polygon points="50,6 90,28 90,72 50,94 10,72 10,28" stroke="url(#logoGrad)" stroke-width="5.5" stroke-linejoin="round" fill="#0d0d0d" fill-opacity="0.9" />
											<path d="M 37,32 L 21,50 L 37,68" stroke="#ffffff" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.9" />
											<path d="M 63,32 L 79,50 L 63,68" stroke="#ffffff" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.9" />
											<path d="M 57,26 L 43,74" stroke="url(#logoGrad)" stroke-width="8" stroke-linecap="round" />
										</svg>
									</td>
									<td style="font-size: 26px; font-weight: 900; letter-spacing: -1.5px; color: #ffffff; padding-left: 10px; vertical-align: middle;">
										Beast<span style="color: #f97316;">Code</span>
									</td>
								</tr>
							</table>
							
							<!-- Accent Badge -->
							<table border="0" cellpadding="0" cellspacing="0" style="margin-top: 15px;">
								<tr>
									<td style="border: 1px solid ${accentColor}; border-radius: 20px; padding: 5px 16px; background-color: rgba(249, 115, 22, 0.06); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: ${accentColor};">
										${headerTitle}
									</td>
								</tr>
							</table>
						</td>
					</tr>

					<!-- Content Body -->
					<tr>
						<td style="padding: 40px 35px 35px 35px;">
							<h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 800; line-height: 1.3; color: #ffffff; letter-spacing: -0.5px;">
								${title}
							</h1>
							
							<p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #e4e4e7; font-weight: 500;">
								${leadText}
							</p>
							
							${description ? `
							<p style="margin: 0 0 30px 0; font-size: 14px; line-height: 1.6; color: #a1a1aa;">
								${description}
							</p>
							` : ""}

							<!-- Details Card -->
							<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0b0b0d; border: 1px solid rgba(255, 255, 255, 0.05); border-left: 4px solid ${accentColor}; border-radius: 8px; margin-bottom: 35px; border-collapse: separate;">
								<tr>
									<td style="padding: 24px 20px;">
										<table border="0" cellpadding="0" cellspacing="0" width="100%">
											${detailsRowsHtml}
										</table>
									</td>
								</tr>
							</table>

							<!-- CTA Block -->
							${ctaHtml}

						</td>
					</tr>

					<!-- Footer Section -->
					<tr>
						<td style="padding: 30px 35px; border-top: 1px solid rgba(255, 255, 255, 0.04); background-color: #0c0c0e; text-align: center;">
							<p style="margin: 0 0 10px 0; font-size: 11px; color: #71717a; line-height: 1.5;">
								${footerText}
							</p>
							<p style="margin: 0 0 16px 0; font-size: 11px; color: #52525b; line-height: 1.5;">
								${recipientEmail ? `
								Sent to <span style="color: #71717a; font-weight: 600;">${recipientEmail}</span>. 
								<a href="${origin}/unsubscribe?email=${encodeURIComponent(recipientEmail)}${preferenceType ? `&type=${preferenceType}` : ""}" target="_blank" style="color: ${accentColor}; text-decoration: none; font-weight: 600;">Unsubscribe</a> 
								&nbsp;&bull;&nbsp; 
								<a href="${origin}/settings" target="_blank" style="color: ${accentColor}; text-decoration: none; font-weight: 600;">Notification Preferences</a>
								` : `
								<a href="${origin}/settings" target="_blank" style="color: ${accentColor}; text-decoration: none; font-weight: 600;">Manage Preferences</a>
								`}
							</p>
							<p style="margin: 0 0 16px 0; font-size: 11px; color: #52525b;">
								<a href="https://github.com" target="_blank" style="color: #71717a; text-decoration: none; margin: 0 6px;">GitHub</a> &nbsp;&bull;&nbsp;
								<a href="https://discord.gg" target="_blank" style="color: #71717a; text-decoration: none; margin: 0 6px;">Discord</a> &nbsp;&bull;&nbsp;
								<a href="mailto:support@beastcode.codes" style="color: #71717a; text-decoration: none; margin: 0 6px;">Support</a>
							</p>
							<p style="margin: 0; font-size: 10px; color: #3f3f46;">
								&copy; 2026 BeastCode Platform. All rights reserved.
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
