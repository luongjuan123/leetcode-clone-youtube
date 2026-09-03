import { withApiErrorHandler } from "@/utils/apiErrorHandler";
import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminAuth, getAdminFirestore } from "@/firebase/firebaseAdmin";
import { EmailService } from "@/utils/emailService";
import { EmailLayout, EmailHeader, EmailFooter, PrimaryButton, COLORS } from "@/utils/emailComponents";
import crypto from "crypto";

type ResponseData = {
	success: boolean;
	message: string;
};

/** SHA-256 hex hash */
function hashToken(token: string): string {
	return crypto.createHash("sha256").update(token).digest("hex");
}

/** Build the production reset URL */
function buildResetLink(token: string): string {
	return `https://www.bomboclatbeastcode.codes/reset-password?token=${token}`;
}

/** Helper to mask email for logs */
function maskEmail(email: string): string {
	const [local, domain] = email.split("@");
	if (!local || !domain) return "invalid-email";
	const maskedLocal = local.length > 2 
		? `${local[0]}***${local[local.length - 1]}`
		: `${local[0]}***`;
	const parts = domain.split(".");
	const maskedDomain = parts.map((part, idx) => {
		if (idx === parts.length - 1) return part; // keep TLD
		return part.length > 2
			? `${part[0]}***${part[part.length - 1]}`
			: `${part[0]}***`;
	}).join(".");
	return `${maskedLocal}@${maskedDomain}`;
}

// ─── Rate-limit in-memory store ───────────────────────────────────────────────
const ipWindowMap  = new Map<string, number[]>();
const emailWindowMap = new Map<string, number[]>();
const IP_MAX    = 5;
const EMAIL_MAX = 3;
const WINDOW_MS = 3_600_000; // 1 hour

function checkRateLimit(ip: string, email: string): { blocked: boolean; reason?: string } {
	const now    = Date.now();
	const cutoff = now - WINDOW_MS;

	const ipHits = (ipWindowMap.get(ip) ?? []).filter((t) => t > cutoff);
	if (ipHits.length >= IP_MAX) return { blocked: true, reason: `IP limit (${ipHits.length}/${IP_MAX}/hr)` };

	const emailHits = (emailWindowMap.get(email) ?? []).filter((t) => t > cutoff);
	if (emailHits.length >= EMAIL_MAX) return { blocked: true, reason: `email limit (${emailHits.length}/${EMAIL_MAX}/hr)` };

	// Record this attempt
	ipWindowMap.set(ip, [...ipHits, now]);
	emailWindowMap.set(email, [...emailHits, now]);
	return { blocked: false };
}

// ─── HTML email template ──────────────────────────────────────────────────────
function buildResetEmail(resetLink: string): string {
	const bodyContent = `
		${EmailHeader({ headerTitle: "PASSWORD RECOVERY", accentColor: COLORS.accent })}
		<tr>
			<td style="padding: 40px 35px 35px 35px; background-color: ${COLORS.card}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
				<h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 800; line-height: 1.3; color: ${COLORS.primaryText}; letter-spacing: -0.5px;">
					Reset Your Password
				</h1>
				
				<p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: ${COLORS.secondaryText}; font-weight: 500;">
					Hello,
				</p>
				
				<p style="margin: 0 0 30px 0; font-size: 14px; line-height: 1.6; color: ${COLORS.mutedText};">
					We received a request to reset your BeastCode password. If this was you, click the button below to choose a new password.
				</p>

				${PrimaryButton({ text: "Reset Password", url: resetLink, accentColor: COLORS.accent })}

				<p style="margin: 20px 0 0 0; font-size: 12px; color: ${COLORS.mutedText}; line-height: 1.5;">
					This link expires in 15 minutes.<br />
					If you did not request a password reset, simply ignore this email.
				</p>
			</td>
		</tr>
		${EmailFooter({})}
	`;

	return EmailLayout({
		title: "Reset Your Password – BeastCode",
		previewText: "We received a request to reset your BeastCode password.",
		bodyContent
	});
}

// ─── Handler ──────────────────────────────────────────────────────────────────
async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
	if (req.method !== "POST") {
		return res.status(405).json({ success: false, message: "Method Not Allowed" });
	}

	const { email } = req.body as { email?: string };
	if (!email) {
		return res.status(400).json({ success: false, message: "Email is required." });
	}

	const emailLower = email.toLowerCase().trim();
	if (!/\S+@\S+\.\S+/.test(emailLower)) {
		return res.status(400).json({ success: false, message: "Please enter a valid email address." });
	}

	const requestId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
	const ip        = ((req.headers["x-forwarded-for"] as string) ?? req.socket.remoteAddress ?? "unknown").split(",")[0].trim();
	const userAgent = (req.headers["user-agent"] ?? "Unknown UA") as string;
	const country   = ((req.headers["cf-ipcountry"] ?? req.headers["x-country-code"] ?? "Unknown") as string);
	const city      = ((req.headers["x-city-code"] ?? "Unknown") as string);
	const now       = Date.now();

	const SAFE_RESPONSE = { success: true as const, message: "If an account with that email exists, a password reset link has been sent." };

	// Initialize status flags for internal logging
	let dbStatus = "PENDING";
	let tokenStatus = "PENDING";
	let smtpStatus = "PENDING";

	// ── Rate limit ────────────────────────────────────────────────────────────
	const rl = checkRateLimit(ip, emailLower);
	if (rl.blocked) {
		console.warn(`[Forgot Password] [ReqID: ${requestId}] [Time: ${new Date(now).toISOString()}] Rate limit — IP:${ip} email:${maskEmail(emailLower)} reason:${rl.reason}`);
		try {
			const db = getAdminFirestore();
			db.collection("securityLogs").add({ action: "RATE_LIMIT_TRIGGERED", timestamp: now, ip, userAgent, country, city, email: emailLower, userId: null, details: { reason: rl.reason } }).catch(() => {});
		} catch (dbErr: any) {
			console.error(`[Forgot Password] [ReqID: ${requestId}] Failed to write rate limit log to Firestore:`, dbErr.message);
		}
		return res.status(200).json(SAFE_RESPONSE);
	}

	let db;
	try {
		db = getAdminFirestore();
		dbStatus = "CONNECTED";
	} catch (dbInitErr: any) {
		dbStatus = "FAILED_INITIALIZATION";
		console.error(`[Forgot Password] [ReqID: ${requestId}] [Time: ${new Date(now).toISOString()}] Email: ${maskEmail(emailLower)} | DB Status: ${dbStatus} | Token Status: ${tokenStatus} | SMTP Status: ${smtpStatus} | Error:`, dbInitErr);
		return res.status(200).json(SAFE_RESPONSE);
	}

	try {
		// ── User lookup ───────────────────────────────────────────────────────
		let userId: string;
		try {
			const record = await getAdminAuth().getUserByEmail(emailLower);
			userId = record.uid;
		} catch (authErr: any) {
			if (authErr?.errorInfo?.code === "auth/user-not-found" || authErr?.code === "auth/user-not-found") {
				console.log(`[Forgot Password] [ReqID: ${requestId}] [Time: ${new Date(now).toISOString()}] Email not found: ${maskEmail(emailLower)}`);
				db.collection("securityLogs").add({ action: "PASSWORD_RESET_SKIMMED", timestamp: now, ip, userAgent, country, city, email: emailLower, userId: null }).catch(() => {});
				return res.status(200).json(SAFE_RESPONSE);
			}
			throw authErr;
		}

		// ── Token generation ──────────────────────────────────────────────────
		const token       = crypto.randomBytes(32).toString("hex");
		const hashedToken = hashToken(token);
		const expiresAt   = now + 15 * 60 * 1000;
		tokenStatus = "GENERATED";

		// ── Store hashed token in database ────────────────────────────────────
		try {
			await db.collection("passwordResetTokens").add({
				userId,
				email: emailLower,
				hashedToken,
				createdAt: now,
				expiresAt,
				used: false,
				usedAt: null,
				requestIP: ip,
				userAgent,
				country,
				city,
			});
			dbStatus = "WRITE_SUCCESS";
		} catch (dbWriteErr: any) {
			dbStatus = "WRITE_FAILED";
			console.error(`[Forgot Password] [ReqID: ${requestId}] [Time: ${new Date(now).toISOString()}] Email: ${maskEmail(emailLower)} | DB Status: ${dbStatus} | Token Status: ${tokenStatus} | SMTP Status: ${smtpStatus} | Write Error:`, dbWriteErr);
			// Security: If database write fails, we MUST NOT send the email
			return res.status(200).json(SAFE_RESPONSE);
		}

		// ── Verify SMTP connection ────────────────────────────────────────────
		const { transporter, mailFrom } = await EmailService.getTransporter();
		if (transporter) {
			try {
				const verifyPromise = transporter.verify();
				const timeoutPromise = new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error("SMTP verification timeout")), 3000)
				);
				await Promise.race([verifyPromise, timeoutPromise]);
				smtpStatus = "VERIFIED";
			} catch (smtpVerifyErr: any) {
				smtpStatus = "VERIFY_FAILED";
				console.error(`[Forgot Password] [ReqID: ${requestId}] [Time: ${new Date(now).toISOString()}] Email: ${maskEmail(emailLower)} | DB Status: ${dbStatus} | Token Status: ${tokenStatus} | SMTP Status: ${smtpStatus} | Verification Error:`, smtpVerifyErr);
				// Log to Firestore if online
				db.collection("securityLogs").add({
					action: "SMTP_OFFLINE",
					timestamp: now,
					ip,
					userAgent,
					country,
					city,
					email: emailLower,
					userId,
					details: { error: smtpVerifyErr.message }
				}).catch(() => {});

				// Fallback to queueing the email in Firestore 'mail' collection
				try {
					await db.collection("mail").add({
						to: emailLower,
						message: {
							subject: "Reset Your Password – BeastCode",
							html: buildResetEmail(buildResetLink(token))
						},
						queuedAt: Date.now()
					});
					smtpStatus = "BACKUP_MAIL_WRITTEN";
				} catch (fallbackErr: any) {
					console.error(`[Forgot Password] [ReqID: ${requestId}] Failed to write fallback mail document:`, fallbackErr.message);
				}

				// Print final consolidated internal log
				console.log(`[Forgot Password] [ReqID: ${requestId}] [Time: ${new Date(now).toISOString()}] Email: ${maskEmail(emailLower)} | DB Status: ${dbStatus} | Token Status: ${tokenStatus} | SMTP Status: ${smtpStatus}`);
				return res.status(200).json(SAFE_RESPONSE);
			}
		} else {
			smtpStatus = "NO_TRANSPORTER";
			console.warn(`[Forgot Password] [ReqID: ${requestId}] No SMTP transporter configured. Writing backup mail document.`);
		}

		// ── Send email ────────────────────────────────────────────────────────
		const emailSent = await EmailService.sendDirectEmail(
			emailLower,
			"Reset Your Password – BeastCode",
			buildResetEmail(buildResetLink(token))
		);

		if (emailSent) {
			smtpStatus = smtpStatus === "NO_TRANSPORTER" ? "BACKUP_MAIL_WRITTEN" : "DELIVERED";
		} else {
			smtpStatus = "DELIVERY_FAILED";
			console.error(`[Forgot Password] [ReqID: ${requestId}] SMTP failed to deliver email to: ${maskEmail(emailLower)}`);
		}

		// ── Audit log ─────────────────────────────────────────────────────────
		db.collection("securityLogs").add({ action: "PASSWORD_RESET_REQUESTED", timestamp: now, ip, userAgent, country, city, email: emailLower, userId }).catch(() => {});

		// Print final consolidated internal log
		console.log(`[Forgot Password] [ReqID: ${requestId}] [Time: ${new Date(now).toISOString()}] Email: ${maskEmail(emailLower)} | DB Status: ${dbStatus} | Token Status: ${tokenStatus} | SMTP Status: ${smtpStatus}`);

		return res.status(200).json(SAFE_RESPONSE);

	} catch (err: any) {
		console.error(`[Forgot Password Unhandled] [ReqID: ${requestId}] [Time: ${new Date(now).toISOString()}] Email: ${maskEmail(emailLower)} | DB Status: ${dbStatus} | Token Status: ${tokenStatus} | SMTP Status: ${smtpStatus} | Error:`, err);
		// Return generic success to users, but log full stack trace internally
		return res.status(200).json(SAFE_RESPONSE);
	}
}

export default withApiErrorHandler(handler);
