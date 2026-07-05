import { withApiErrorHandler } from "@/utils/apiErrorHandler";
import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminAuth, getAdminFirestore } from "@/firebase/firebaseAdmin";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { ProvisionResponse } from "@/utils/types";

// In-memory provisioning rate-limit: 10 attempts per UID per hour
const rlMap = new Map<string, number[]>();
const RL_MAX = 10;
const RL_WINDOW = 3_600_000;

function isRateLimited(uid: string): boolean {
	const now = Date.now();
	const hits = (rlMap.get(uid) ?? []).filter((t) => t > now - RL_WINDOW);
	if (hits.length >= RL_MAX) return true;
	rlMap.set(uid, [...hits, now]);
	return false;
}

/**
 * Derives a normalised username handle from a display name or email prefix.
 * Output is guaranteed lowercase, alphanumeric + underscores, 3-15 chars,
 * with a numeric suffix appended to ensure reasonable uniqueness.
 */
function deriveUsername(displayName: string | null, email: string | null): string {
	const raw = (displayName ?? email?.split("@")[0] ?? "user")
		.toLowerCase()
		.replace(/[^a-z0-9_]/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_|_$/g, "")
		.slice(0, 12);

	const base = raw.length >= 3 ? raw : `user_${raw}`.slice(0, 12);
	const suffix = Math.floor(1000 + Math.random() * 9000);
	return `${base}_${suffix}`.slice(0, 15);
}

async function handler(
	req: NextApiRequest,
	res: NextApiResponse<ProvisionResponse>
) {
	if (req.method !== "POST") {
		return res.status(405).json({ success: false, message: "Method Not Allowed" });
	}

	// ── Extract Bearer token ────────────────────────────────────────────────────
	const authHeader = req.headers.authorization ?? "";
	if (!authHeader.startsWith("Bearer ")) {
		return res.status(401).json({ success: false, message: "Missing or invalid Authorization header." });
	}
	const idToken = authHeader.slice(7);

	// ── Verify the Firebase ID token ────────────────────────────────────────────
	let decodedToken: DecodedIdToken | null = null;

	try {
		decodedToken = await getAdminAuth().verifyIdToken(idToken, true);
	} catch {
		return res.status(401).json({ success: false, message: "Invalid or expired session token." });
	}

	if (!decodedToken) {
		return res.status(401).json({ success: false, message: "Token verification failed." });
	}

	// ── STRICT email verification gate ─────────────────────────────────────────
	if (!decodedToken.email_verified) {
		return res.status(403).json({
			success: false,
			message: "Email verification required before provisioning.",
		});
	}

	const uid = decodedToken.uid;
	const email = decodedToken.email ?? "";
	const displayName = decodedToken.name ?? null;

	// ── Rate limit by UID ───────────────────────────────────────────────────────
	if (isRateLimited(uid)) {
		return res.status(429).json({ success: false, message: "Too many provisioning requests. Please wait." });
	}

	const db = getAdminFirestore();
	const userRef = db.collection("users").doc(uid);

	// ── Atomic idempotent write ─────────────────────────────────────────────────
	// Use a Firestore transaction to ensure we never double-write.
	let alreadyProvisioned = false;

	await db.runTransaction(async (tx) => {
		const snap = await tx.get(userRef);
		if (snap.exists) {
			alreadyProvisioned = true;
			return;
		}

		const username = deriveUsername(displayName, email);
		const now = Date.now();

		tx.set(userRef, {
			uid,
			username,
			displayName: displayName ?? username,
			email,
			experienceLevel: "Newbie",
			solvedProblems: [],
			easyCount: 0,
			mediumCount: 0,
			hardCount: 0,
			mlCount: 0,
			xp: 0,
			role: "user",
			likedProblems: [],
			dislikedProblems: [],
			starredProblems: [],
			showStudentInfo: true,
			isOnboarded: false,
			createdAt: now,
			updatedAt: now,
		});
	});

	if (alreadyProvisioned) {
		return res.status(200).json({ success: true, message: "Account already provisioned." });
	}

	// ── Audit log (non-blocking) ────────────────────────────────────────────────
	db.collection("securityLogs").add({
		action: "ACCOUNT_PROVISIONED",
		uid,
		email,
		timestamp: Date.now(),
		ip: ((req.headers["x-forwarded-for"] as string) ?? req.socket?.remoteAddress ?? "unknown")
			.split(",")[0]
			.trim(),
	}).catch(() => {});

	return res.status(201).json({ success: true, message: "Account provisioned successfully." });
}

export default withApiErrorHandler(handler);
