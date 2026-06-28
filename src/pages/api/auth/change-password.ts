import { withApiErrorHandler } from "@/utils/apiErrorHandler";
import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminAuth, getAdminFirestore } from "@/firebase/firebaseAdmin";
import { EmailService } from "@/utils/emailService";
import { analysePassword, BANNED_SEQUENCES, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "@/utils/passwordPolicy";
import crypto from "crypto";

type ResponseData = { success: boolean; message: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sha256(value: string): string {
	return crypto.createHash("sha256").update(value).digest("hex");
}

function parseUA(ua: string): string {
	let os = "Unknown OS";
	if (/windows/i.test(ua))          os = "Windows";
	else if (/mac os x/i.test(ua))    os = "macOS";
	else if (/linux/i.test(ua))       os = "Linux";
	else if (/android/i.test(ua))     os = "Android";
	else if (/iphone|ipad/i.test(ua)) os = "iOS";
	let browser = "Unknown Browser";
	if      (/chrome|crios/i.test(ua) && !/edge|edg|opr/i.test(ua)) browser = "Chrome";
	else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua))        browser = "Safari";
	else if (/firefox|fxios/i.test(ua))                               browser = "Firefox";
	else if (/edge|edg/i.test(ua))                                    browser = "Edge";
	else if (/opr/i.test(ua))                                         browser = "Opera";
	return `${browser} on ${os}`;
}

// ─── Rate limit (in-memory, per IP) ──────────────────────────────────────────
const rlMap = new Map<string, number[]>();
const RL_MAX = 5;
const RL_WINDOW = 3_600_000;

function isRateLimited(ip: string): boolean {
	const now    = Date.now();
	const hits   = (rlMap.get(ip) ?? []).filter((t) => t > now - RL_WINDOW);
	if (hits.length >= RL_MAX) return true;
	rlMap.set(ip, [...hits, now]);
	return false;
}

// ─── Security notification email ──────────────────────────────────────────────
function buildChangedEmail(ip: string, country: string, device: string, time: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Your BeastCode Password Was Changed</title></head>
<body style="margin:0;padding:0;background:#0d0d0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#fff;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#0d0d0f;padding:40px 20px;">
    <tr><td align="center">
      <table border="0" cellpadding="0" cellspacing="0" width="100%"
        style="max-width:500px;background:#131316;border:1px solid rgba(239,68,68,.2);border-top:3px solid #ef4444;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.6);border-collapse:separate;">
        <tr>
          <td align="center" style="padding:28px 30px 14px;background:#0c0c0e;border-bottom:1px solid rgba(255,255,255,.04);">
            <span style="font-size:22px;font-weight:900;letter-spacing:-1px;color:#fff;">Beast<span style="color:#ef4444;">Code</span></span>
          </td>
        </tr>
        <tr><td style="padding:32px 30px;">
          <h1 style="margin:0 0 14px;font-size:17px;font-weight:800;color:#fff;">Security Notice: Password Changed</h1>
          <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#a1a1aa;">Your account password was just changed. Here are the details:</p>
          <table border="0" cellpadding="0" cellspacing="0" width="100%"
            style="margin-bottom:24px;background:#0c0c0e;border:1px solid rgba(255,255,255,.04);border-radius:8px;font-size:13px;">
            <tr><td style="padding:10px 15px;color:#71717a;font-weight:600;width:100px;">Time</td><td style="padding:10px 15px;color:#e4e4e7;font-family:monospace;">${time}</td></tr>
            <tr style="border-top:1px solid rgba(255,255,255,.03);"><td style="padding:10px 15px;color:#71717a;font-weight:600;">IP</td><td style="padding:10px 15px;color:#e4e4e7;font-family:monospace;">${ip}</td></tr>
            <tr style="border-top:1px solid rgba(255,255,255,.03);"><td style="padding:10px 15px;color:#71717a;font-weight:600;">Location</td><td style="padding:10px 15px;color:#e4e4e7;">${country}</td></tr>
            <tr style="border-top:1px solid rgba(255,255,255,.03);"><td style="padding:10px 15px;color:#71717a;font-weight:600;">Device</td><td style="padding:10px 15px;color:#e4e4e7;">${device}</td></tr>
          </table>
          <p style="margin:0;font-size:13px;color:#f43f5e;font-weight:600;">If this was not you, <a href="mailto:support@bomboclatbeastcode.codes" style="color:#f43f5e;">contact support immediately</a>.</p>
        </td></tr>
        <tr>
          <td style="padding:20px 30px;border-top:1px solid rgba(255,255,255,.04);background:#0c0c0e;text-align:center;font-size:11px;">
            <p style="margin:0 0 6px;color:#a1a1aa;font-weight:600;">Practice. Compete. Become Better.</p>
            <p style="margin:0;color:#3f3f46;">&copy; 2026 BeastCode. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
	if (req.method !== "POST") {
		return res.status(405).json({ success: false, message: "Method Not Allowed" });
	}

	const ip        = ((req.headers["x-forwarded-for"] as string) ?? req.socket.remoteAddress ?? "unknown").split(",")[0].trim();
	const userAgent = (req.headers["user-agent"] ?? "Unknown UA") as string;
	const country   = ((req.headers["cf-ipcountry"] ?? req.headers["x-country-code"] ?? "Unknown") as string);
	const now       = Date.now();

	// ── Rate limit ────────────────────────────────────────────────────────────
	if (isRateLimited(ip)) {
		const db = getAdminFirestore();
		db.collection("securityLogs").add({ action: "RATE_LIMIT_TRIGGERED", endpoint: "change-password", timestamp: now, ip, userAgent, country }).catch(() => {});
		return res.status(429).json({ success: false, message: "Too many requests. Please wait before trying again." });
	}

	const { uid, currentPassword, newPassword, confirmPassword } = req.body as {
		uid?: string;
		currentPassword?: string;
		newPassword?: string;
		confirmPassword?: string;
	};

	// ── Basic input validation ────────────────────────────────────────────────
	if (!uid || !currentPassword || !newPassword || !confirmPassword) {
		return res.status(400).json({ success: false, message: "All fields are required." });
	}

	if (newPassword !== confirmPassword) {
		return res.status(400).json({ success: false, message: "Passwords do not match." });
	}

	const db = getAdminFirestore();

	try {
		// ── Load user record ──────────────────────────────────────────────────
		let userRecord;
		try {
			userRecord = await getAdminAuth().getUser(uid);
		} catch (e: any) {
			if (e?.errorInfo?.code === "auth/user-not-found") {
				return res.status(400).json({ success: false, message: "User not found." });
			}
			throw e;
		}

		const userEmail = userRecord.email ?? "";

		// ── Verify current password via Firebase REST sign-in ─────────────────
		// Firebase Admin SDK doesn't expose verifyPassword directly, so we call
		// the Identity Toolkit REST endpoint which is the canonical approach.
		const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
		if (!apiKey) throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY is not configured.");

		const verifyRes = await fetch(
			`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: userEmail, password: currentPassword, returnSecureToken: false }),
			}
		);

		if (!verifyRes.ok) {
			const errBody = await verifyRes.json().catch(() => ({}));
			const errCode: string = errBody?.error?.message ?? "";

			// Map specific codes to safe messages
			if (errCode.includes("INVALID_PASSWORD") || errCode.includes("INVALID_LOGIN_CREDENTIALS") || errCode.includes("EMAIL_NOT_FOUND")) {
				db.collection("securityLogs").add({ action: "INVALID_CURRENT_PASSWORD", timestamp: now, ip, userAgent, country, userId: uid }).catch(() => {});
				return res.status(400).json({ success: false, message: "Current password is incorrect." });
			}
			if (errCode.includes("TOO_MANY_ATTEMPTS")) {
				return res.status(429).json({ success: false, message: "Too many failed attempts. Please try again later." });
			}
			// Unknown Firebase error — sanitize
			throw new Error(`Current password verification failed: ${errCode}`);
		}

		// ── New password policy validation ────────────────────────────────────
		const analysis = analysePassword(newPassword, { email: userEmail, displayName: userRecord.displayName ?? "" });
		if (!analysis.isValid) {
			return res.status(400).json({ success: false, message: analysis.firstError ?? "Password does not meet requirements." });
		}

		// ── Password history check (last 5 passwords) ─────────────────────────
		const historySnap = await db.collection("passwordHistory")
			.where("userId", "==", uid)
			.get();

		const historyHashes: Array<{ hash: string; createdAt: number }> = historySnap.docs
			.map((d) => d.data() as { hash: string; createdAt: number })
			.sort((a, b) => b.createdAt - a.createdAt)
			.slice(0, 5);

		const newHash = sha256(newPassword);
		const usedBefore = historyHashes.some((h) => h.hash === newHash);
		if (usedBefore) {
			return res.status(400).json({
				success: false,
				message: "You've recently used this password. Please choose a different one.",
			});
		}

		// ── Update password ───────────────────────────────────────────────────
		await getAdminAuth().updateUser(uid, { password: newPassword });

		// ── Revoke all sessions (force re-login on other devices) ─────────────
		await getAdminAuth().revokeRefreshTokens(uid);

		// ── Store new hash in password history ────────────────────────────────
		await db.collection("passwordHistory").add({
			userId: uid,
			hash: newHash,
			createdAt: now,
		});

		// Prune history to keep only last 10 (non-blocking)
		const allHistorySnap = await db.collection("passwordHistory").where("userId", "==", uid).get();
		if (allHistorySnap.size > 10) {
			const sorted = allHistorySnap.docs.sort((a, b) => (a.data().createdAt ?? 0) - (b.data().createdAt ?? 0));
			const toDelete = sorted.slice(0, allHistorySnap.size - 10);
			toDelete.forEach((d) => d.ref.delete().catch(() => {}));
		}

		// ── Audit log ─────────────────────────────────────────────────────────
		db.collection("securityLogs").add({
			action: "PASSWORD_CHANGED",
			timestamp: now,
			ip, userAgent, country,
			userId: uid,
			email: userEmail,
		}).catch(() => {});

		// ── Security notification email ───────────────────────────────────────
		const device = parseUA(userAgent);
		const time   = new Date().toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "medium" }) + " UTC";

		EmailService.sendDirectEmail(
			userEmail,
			"Your BeastCode Password Was Changed",
			buildChangedEmail(ip, country, device, time)
		).catch((e) => console.error("[Change Password] Security email failed:", e));

		return res.status(200).json({ success: true, message: "Your password has been changed successfully." });

	} catch (err: any) {
		console.error("[Change Password] Unexpected error:", err);
		throw err;
	}
}

export default withApiErrorHandler(handler);
