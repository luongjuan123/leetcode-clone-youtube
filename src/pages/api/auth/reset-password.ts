import { withApiErrorHandler } from "@/utils/apiErrorHandler";
import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminAuth, getAdminFirestore } from "@/firebase/firebaseAdmin";
import { EmailService } from "@/utils/emailService";
import crypto from "crypto";

type ResponseData = {
	success: boolean;
	message: string;
	email?: string;
};

function hashToken(token: string): string {
	return crypto.createHash("sha256").update(token).digest("hex");
}

function parseUA(ua: string): string {
	let os = "Unknown OS";
	if (/windows/i.test(ua))           os = "Windows";
	else if (/mac os x/i.test(ua))     os = "macOS";
	else if (/linux/i.test(ua))        os = "Linux";
	else if (/android/i.test(ua))      os = "Android";
	else if (/iphone|ipad/i.test(ua))  os = "iOS";

	let browser = "Unknown Browser";
	if      (/chrome|crios/i.test(ua) && !/edge|edg|opr/i.test(ua)) browser = "Chrome";
	else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua))        browser = "Safari";
	else if (/firefox|fxios/i.test(ua))                               browser = "Firefox";
	else if (/edge|edg/i.test(ua))                                    browser = "Edge";
	else if (/opr/i.test(ua))                                         browser = "Opera";

	return `${browser} on ${os}`;
}

const COMMON_PASSWORDS = [
	"password", "123456789", "1234567890", "password123",
	"beastcode123", "qwertyuiop", "admin12345", "welcome123",
	"letmein123", "admin123", "welcome", "beastcode",
];

function validatePassword(pwd: string): string | null {
	if (pwd.length < 10)                return "Password must be at least 10 characters long.";
	if (!/[A-Z]/.test(pwd))            return "Password must include at least one uppercase letter.";
	if (!/[a-z]/.test(pwd))            return "Password must include at least one lowercase letter.";
	if (!/[0-9]/.test(pwd))            return "Password must include at least one number.";
	if (!/[^A-Za-z0-9]/.test(pwd))    return "Password must include at least one special character.";
	if (COMMON_PASSWORDS.includes(pwd.toLowerCase().trim())) return "This password is too common. Please choose a more secure password.";
	return null;
}

const INVALID_TOKEN_MSG = "Reset Link Expired. This link is no longer valid. Request another password reset.";

function buildSecurityEmail(ip: string, city: string, country: string, device: string, time: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Your BeastCode Password Was Changed</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#fff;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#0d0d0f;padding:40px 20px;">
    <tr><td align="center">
      <table border="0" cellpadding="0" cellspacing="0" width="100%"
        style="max-width:500px;background:#131316;border:1px solid rgba(239,68,68,.2);border-top:3px solid #ef4444;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.6);border-collapse:separate;">

        <!-- Logo -->
        <tr>
          <td align="center" style="padding:30px 30px 15px;background:#0c0c0e;border-bottom:1px solid rgba(255,255,255,.04);">
            <table border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;">
                  <svg width="38" height="38" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs><linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#ef4444"/><stop offset="100%" stop-color="#b91c1c"/>
                    </linearGradient></defs>
                    <polygon points="50,6 90,28 90,72 50,94 10,72 10,28" stroke="url(#rg)" stroke-width="5.5" stroke-linejoin="round" fill="#0d0d0f" fill-opacity=".9"/>
                    <path d="M37,32 L21,50 L37,68" stroke="#fff" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
                    <path d="M63,32 L79,50 L63,68" stroke="#fff" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
                    <path d="M50,28 L50,56 M50,68 L50,72" stroke="url(#rg)" stroke-width="8" stroke-linecap="round"/>
                  </svg>
                </td>
                <td style="font-size:22px;font-weight:900;letter-spacing:-1px;color:#fff;padding-left:10px;vertical-align:middle;">
                  Beast<span style="color:#ef4444;">Code</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:35px 30px;">
            <h1 style="margin:0 0 16px;font-size:18px;font-weight:800;color:#fff;letter-spacing:-.5px;">Security Notice: Password Changed</h1>
            <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#a1a1aa;">Hello,</p>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#a1a1aa;">
              The password for your BeastCode account was recently updated. Here are the security details:
            </p>
            <table border="0" cellpadding="0" cellspacing="0" width="100%"
              style="margin-bottom:28px;background:#0c0c0e;border:1px solid rgba(255,255,255,.04);border-radius:8px;font-size:13px;">
              <tr><td style="padding:11px 16px;color:#71717a;font-weight:600;width:110px;">Time</td><td style="padding:11px 16px;color:#e4e4e7;font-family:monospace;">${time}</td></tr>
              <tr style="border-top:1px solid rgba(255,255,255,.03);"><td style="padding:11px 16px;color:#71717a;font-weight:600;">IP Address</td><td style="padding:11px 16px;color:#e4e4e7;font-family:monospace;">${ip}</td></tr>
              <tr style="border-top:1px solid rgba(255,255,255,.03);"><td style="padding:11px 16px;color:#71717a;font-weight:600;">Location</td><td style="padding:11px 16px;color:#e4e4e7;">${city}, ${country}</td></tr>
              <tr style="border-top:1px solid rgba(255,255,255,.03);"><td style="padding:11px 16px;color:#71717a;font-weight:600;">Device</td><td style="padding:11px 16px;color:#e4e4e7;">${device}</td></tr>
            </table>
            <p style="margin:0;font-size:13px;line-height:1.6;color:#f43f5e;font-weight:600;">
              If this was not you, please contact support immediately.
            </p>
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

	// ── GET: validate token on page load ──────────────────────────────────────
	if (req.method === "GET") {
		const { token } = req.query as { token?: string };

		if (!token || typeof token !== "string" || token.length < 60) {
			return res.status(400).json({ success: false, message: INVALID_TOKEN_MSG });
		}

		const db  = getAdminFirestore();
		const now = Date.now();

		try {
			const snap = await db.collection("passwordResetTokens")
				.where("hashedToken", "==", hashToken(token))
				.limit(1)
				.get();

			if (snap.empty) {
				return res.status(400).json({ success: false, message: INVALID_TOKEN_MSG });
			}

			const doc  = snap.docs[0];
			const data = doc.data();

			if (data.used || now > (data.expiresAt ?? 0)) {
				if (now > (data.expiresAt ?? 0)) doc.ref.delete().catch(() => {});
				return res.status(400).json({ success: false, message: INVALID_TOKEN_MSG });
			}

			return res.status(200).json({ success: true, message: "Token valid.", email: data.email });
		} catch (err) {
			console.error("[Reset Password GET] Token lookup failed:", err);
			throw err;
		}
	}

	// ── POST: submit new password ──────────────────────────────────────────────
	if (req.method !== "POST") {
		return res.status(405).json({ success: false, message: "Method Not Allowed" });
	}

	const { token, newPassword, confirmPassword } = req.body as {
		token?: string;
		newPassword?: string;
		confirmPassword?: string;
	};

	if (!token || typeof token !== "string" || token.length < 60) {
		return res.status(400).json({ success: false, message: INVALID_TOKEN_MSG });
	}

	if (!newPassword || !confirmPassword) {
		return res.status(400).json({ success: false, message: "All fields are required." });
	}

	if (newPassword !== confirmPassword) {
		return res.status(400).json({ success: false, message: "Passwords do not match." });
	}

	const pwdErr = validatePassword(newPassword);
	if (pwdErr) return res.status(400).json({ success: false, message: pwdErr });

	const ip        = ((req.headers["x-forwarded-for"] as string) ?? req.socket.remoteAddress ?? "unknown").split(",")[0].trim();
	const userAgent = (req.headers["user-agent"] ?? "Unknown UA") as string;
	const country   = ((req.headers["cf-ipcountry"] ?? req.headers["x-country-code"] ?? "Unknown") as string);
	const city      = ((req.headers["x-city-code"] ?? "Unknown") as string);
	const now       = Date.now();
	const db        = getAdminFirestore();

	try {
		// 1. Look up hashed token
		const snap = await db.collection("passwordResetTokens")
			.where("hashedToken", "==", hashToken(token))
			.limit(1)
			.get();

		if (snap.empty) {
			db.collection("securityLogs").add({ action: "INVALID_TOKEN", timestamp: now, ip, userAgent, country, city, email: "", userId: null }).catch(() => {});
			return res.status(400).json({ success: false, message: INVALID_TOKEN_MSG });
		}

		const tokenDoc  = snap.docs[0];
		const tokenData = tokenDoc.data();

		// 2. Reuse check
		if (tokenData.used) {
			db.collection("securityLogs").add({ action: "INVALID_TOKEN", timestamp: now, ip, userAgent, country, city, email: tokenData.email ?? "", userId: tokenData.userId ?? null, details: { reason: "reused" } }).catch(() => {});
			return res.status(400).json({ success: false, message: INVALID_TOKEN_MSG });
		}

		// 3. Expiry check
		if (now > (tokenData.expiresAt ?? 0)) {
			db.collection("securityLogs").add({ action: "EXPIRED_TOKEN", timestamp: now, ip, userAgent, country, city, email: tokenData.email ?? "", userId: tokenData.userId ?? null }).catch(() => {});
			tokenDoc.ref.delete().catch(() => {});
			return res.status(400).json({ success: false, message: INVALID_TOKEN_MSG });
		}

		const userId    = tokenData.userId as string;
		const userEmail = tokenData.email as string;

		// 4. Update password via Firebase Admin SDK (service-account creds, never ADC)
		await getAdminAuth().updateUser(userId, { password: newPassword });

		// 5. Revoke all active sessions
		await getAdminAuth().revokeRefreshTokens(userId);

		// 6. Delete token (single-use)
		await tokenDoc.ref.delete().catch(() => {});

		// 7. Security notification email (non-blocking — failure doesn't roll back)
		const device = parseUA(userAgent);
		const time   = new Date().toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "medium" }) + " UTC";

		EmailService.sendDirectEmail(
			userEmail,
			"Your BeastCode Password Was Changed",
			buildSecurityEmail(ip, city, country, device, time)
		).catch((e) => console.error("[Reset Password] Security email failed:", e));

		// 8. Audit log
		db.collection("securityLogs").add({ action: "PASSWORD_RESET_COMPLETED", timestamp: now, ip, userAgent, country, city, email: userEmail, userId }).catch(() => {});

		return res.status(200).json({ success: true, message: "Your password has been changed successfully." });

	} catch (err: any) {
		console.error("[Reset Password POST] Unexpected error:", err);
		throw err; // withApiErrorHandler sanitizes this before sending to client
	}
}

export default withApiErrorHandler(handler);
