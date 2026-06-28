import { withApiErrorHandler } from "@/utils/apiErrorHandler";
import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminAuth, getAdminFirestore } from "@/firebase/firebaseAdmin";
import { EmailService } from "@/utils/emailService";
import crypto from "crypto";

type ResponseData = {
	success: boolean;
	message: string;
};

/** SHA-256 hex hash */
function hashToken(token: string): string {
	return crypto.createHash("sha256").update(token).digest("hex");
}

/** Build the production reset URL — reads NEXT_PUBLIC_SITE_URL or falls back to the canonical production domain */
function buildResetLink(token: string): string {
	const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.bomboclatbeastcode.codes").replace(/\/$/, "");
	return `${base}/reset-password?token=${token}`;
}

// ─── Rate-limit in-memory store ───────────────────────────────────────────────
// Process-level maps reset on cold-start. Works without any Firestore index.
const ipWindowMap  = new Map<string, number[]>();
const emailWindowMap = new Map<string, number[]>();
const IP_MAX    = 5;
const EMAIL_MAX = 3;
const WINDOW_MS = 3_600_000; // 1 hour

function checkRateLimit(ip: string, email: string): { blocked: boolean; reason?: string } {
	const now    = Date.now();
	const cutoff = now - WINDOW_MS;

	const ipHits = (ipWindowMap.get(ip) ?? []).filter((t) => t > cutoff);
	if (ipHits.length >= IP_MAX) return { blocked: true, reason: `IP limit (${IP_MAX}/hr)` };

	const emailHits = (emailWindowMap.get(email) ?? []).filter((t) => t > cutoff);
	if (emailHits.length >= EMAIL_MAX) return { blocked: true, reason: `email limit (${EMAIL_MAX}/hr)` };

	// Record this attempt
	ipWindowMap.set(ip, [...ipHits, now]);
	emailWindowMap.set(email, [...emailHits, now]);
	return { blocked: false };
}

// ─── HTML email template ──────────────────────────────────────────────────────
function buildResetEmail(resetLink: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Reset Your Password – BeastCode</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#fff;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#0d0d0f;padding:40px 20px;">
    <tr><td align="center">
      <table border="0" cellpadding="0" cellspacing="0" width="100%"
        style="max-width:500px;background:#131316;border:1px solid rgba(255,255,255,.08);border-top:3px solid #f59e0b;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.6);border-collapse:separate;">

        <!-- Logo -->
        <tr>
          <td align="center" style="padding:30px 30px 15px;background:#0c0c0e;border-bottom:1px solid rgba(255,255,255,.04);">
            <table border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;">
                  <svg width="38" height="38" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs><linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#d97706"/>
                    </linearGradient></defs>
                    <polygon points="50,6 90,28 90,72 50,94 10,72 10,28" stroke="url(#lg)" stroke-width="5.5" stroke-linejoin="round" fill="#0d0d0f" fill-opacity=".9"/>
                    <path d="M37,32 L21,50 L37,68" stroke="#fff" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
                    <path d="M63,32 L79,50 L63,68" stroke="#fff" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
                    <path d="M57,26 L43,74" stroke="url(#lg)" stroke-width="8" stroke-linecap="round"/>
                  </svg>
                </td>
                <td style="font-size:22px;font-weight:900;letter-spacing:-1px;color:#fff;padding-left:10px;vertical-align:middle;">
                  Beast<span style="color:#f59e0b;">Code</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:35px 30px;">
            <h1 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#fff;letter-spacing:-.5px;">Reset Your Password</h1>
            <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#a1a1aa;">Hello,</p>
            <p style="margin:0 0 28px;font-size:14px;line-height:1.6;color:#a1a1aa;">
              We received a request to reset your BeastCode password. If this was you, click the button below.
            </p>
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px;">
              <tr><td align="center">
                <a href="${resetLink}" target="_blank"
                  style="display:inline-block;padding:13px 32px;background:#f59e0b;color:#0d0d0f;text-decoration:none;font-size:13px;font-weight:800;letter-spacing:1px;text-transform:uppercase;border-radius:8px;box-shadow:0 0 20px rgba(245,158,11,.25);">
                  Reset Password
                </a>
              </td></tr>
            </table>
            <p style="margin:0 0 6px;font-size:12px;color:#52525b;">This link expires in 15&nbsp;minutes.</p>
            <p style="margin:0;font-size:12px;color:#52525b;">If you did not request a password reset, simply ignore this email.</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:22px 30px;border-top:1px solid rgba(255,255,255,.04);background:#0c0c0e;text-align:center;">
            <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#a1a1aa;letter-spacing:.5px;">Practice. Compete. Become Better.</p>
            <p style="margin:0 0 10px;font-size:11px;color:#52525b;">
              Need help? <a href="mailto:support@bomboclatbeastcode.codes" style="color:#f59e0b;text-decoration:none;font-weight:600;">support@bomboclatbeastcode.codes</a>
            </p>
            <p style="margin:0;font-size:11px;color:#3f3f46;">&copy; 2026 BeastCode. All rights reserved.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
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

	const ip        = ((req.headers["x-forwarded-for"] as string) ?? req.socket.remoteAddress ?? "unknown").split(",")[0].trim();
	const userAgent = (req.headers["user-agent"] ?? "Unknown UA") as string;
	const country   = ((req.headers["cf-ipcountry"] ?? req.headers["x-country-code"] ?? "Unknown") as string);
	const city      = ((req.headers["x-city-code"] ?? "Unknown") as string);
	const now       = Date.now();

	const SAFE_RESPONSE = { success: true as const, message: "If an account exists, a password reset email has been sent." };

	// ── Rate limit ────────────────────────────────────────────────────────────
	const rl = checkRateLimit(ip, emailLower);
	if (rl.blocked) {
		const db = getAdminFirestore();
		console.warn(`[Forgot Password] Rate limit — IP:${ip} email:${emailLower} reason:${rl.reason}`);
		db.collection("securityLogs").add({ action: "RATE_LIMIT_TRIGGERED", timestamp: now, ip, userAgent, country, city, email: emailLower, userId: null, details: { reason: rl.reason } }).catch(() => {});
		return res.status(200).json(SAFE_RESPONSE);
	}

	const db = getAdminFirestore();

	try {
		// ── User lookup ───────────────────────────────────────────────────────
		let userId: string;
		try {
			const record = await getAdminAuth().getUserByEmail(emailLower);
			userId = record.uid;
		} catch (authErr: any) {
			if (authErr?.errorInfo?.code === "auth/user-not-found") {
				console.log(`[Forgot Password] Email not found: ${emailLower}`);
				db.collection("securityLogs").add({ action: "PASSWORD_RESET_SKIMMED", timestamp: now, ip, userAgent, country, city, email: emailLower, userId: null }).catch(() => {});
				return res.status(200).json(SAFE_RESPONSE);
			}
			throw authErr; // unexpected — let withApiErrorHandler sanitize
		}

		// ── Token generation & storage ────────────────────────────────────────
		const token       = crypto.randomBytes(32).toString("hex");
		const hashedToken = hashToken(token);
		const expiresAt   = now + 15 * 60 * 1000;

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

		// ── Send email ────────────────────────────────────────────────────────
		await EmailService.sendDirectEmail(
			emailLower,
			"Reset Your Password – BeastCode",
			buildResetEmail(buildResetLink(token))
		);

		// ── Audit log ─────────────────────────────────────────────────────────
		db.collection("securityLogs").add({ action: "PASSWORD_RESET_REQUESTED", timestamp: now, ip, userAgent, country, city, email: emailLower, userId }).catch(() => {});

		return res.status(200).json(SAFE_RESPONSE);

	} catch (err: any) {
		console.error("[Forgot Password] Unexpected error:", err);
		throw err; // withApiErrorHandler sanitizes this
	}
}

export default withApiErrorHandler(handler);
