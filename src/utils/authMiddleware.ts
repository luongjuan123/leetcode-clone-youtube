import { NextApiRequest, NextApiResponse } from "next";
import { getAdminFirestore, getAdminAuth } from "@/firebase/firebaseAdmin";

export interface AuthenticatedRequest extends NextApiRequest {
	user?: {
		uid: string;
		email?: string;
		role?: string;
		isAdmin?: boolean;
	};
}

export type AuthenticatedHandler = (
	req: AuthenticatedRequest,
	res: NextApiResponse
) => void | Promise<void>;

/**
 * Higher-Order Function to authenticate requests and reject banned users.
 */
export function withAuthAndModeration(handler: AuthenticatedHandler, options?: { requireAdmin?: boolean }) {
	return async (req: AuthenticatedRequest, res: NextApiResponse) => {
		let idToken = "";
		const authHeader = req.headers.authorization;
		if (authHeader && authHeader.startsWith("Bearer ")) {
			idToken = authHeader.substring(7);
		} else if (req.body && req.body.idToken) {
			idToken = req.body.idToken;
		} else if (req.query && req.query.idToken) {
			idToken = req.query.idToken as string;
		}

		// Support fallback for uid passed directly in the body (e.g. older submit logic)
		// But verifyIdToken is much safer, so we try to require idToken or fallback to direct checks.
		if (!idToken && req.body && req.body.uid) {
			// In some cases we don't have idToken, verify if user exists/banned via uid directly (safe if caller is authenticated)
			const uid = req.body.uid;
			const db = getAdminFirestore();
			const userDoc = await db.collection("users").doc(uid).get();
			if (!userDoc.exists) {
				return res.status(403).json({ success: false, error: "User account does not exist or has been deleted." });
			}
			
			const modDoc = await db.collection("userModeration").doc(uid).get();
			if (modDoc.exists) {
				const modData = modDoc.data() || {};
				if (modData.status === "BANNED") {
					if (modData.expiresAt && Date.now() > modData.expiresAt) {
						await db.collection("userModeration").doc(uid).update({
							status: "ACTIVE",
							expiresAt: null,
						});
						await db.collection("moderationLogs").add({
							adminUid: "SYSTEM",
							targetUid: uid,
							action: "UNBAN",
							timestamp: Date.now(),
							reason: "Temporary ban expired",
							duration: "N/A",
							ip: req.socket.remoteAddress || "127.0.0.1",
							oldState: "BANNED",
							newState: "ACTIVE"
						});
					} else {
						return res.status(403).json({
							success: false,
							error: {
								code: "BANNED",
								message: "This account has been suspended.",
								reason: modData.reason || "Violation of terms",
								duration: modData.duration || "Permanent",
								referenceId: modData.caseId || uid.substring(0, 8).toUpperCase()
							}
						});
					}
				}
				if (modData.status === "PENDING_DELETION") {
					const isAllowedRoute = req.url?.startsWith("/api/moderation/appeal") || req.url?.startsWith("/api/auth/check-status");
					if (!isAllowedRoute) {
						return res.status(403).json({
							success: false,
							error: {
								code: "PENDING_DELETION",
								message: "Your account is currently scheduled for deletion.",
								referenceId: modData.caseId || uid.substring(0, 8).toUpperCase()
							}
						});
					}
				}
			}
			req.user = {
				uid,
				email: userDoc.data()?.email || "",
				role: userDoc.data()?.role || (userDoc.data()?.isAdmin ? "admin" : "user"),
				isAdmin: !!userDoc.data()?.isAdmin
			};
			return handler(req, res);
		}

		const isPublicAttachment = req.query && req.query.path && typeof req.query.path === "string" && req.query.path.startsWith("avatars/");
		if (isPublicAttachment) {
			return handler(req, res);
		}

		if (!idToken) {
			return res.status(401).json({ success: false, error: "Authentication required" });
		}

		try {
			const adminAuth = getAdminAuth();
			const decodedToken = await adminAuth.verifyIdToken(idToken);
			const uid = decodedToken.uid;

			const db = getAdminFirestore();

			// Check if user exists in firestore
			// BeastCode uses lazy provisioning; an authenticated Firebase user might not have a
			// Firestore document yet when hitting auxiliary endpoints (e.g. session tracking).
			const userDoc = await db.collection("users").doc(uid).get();
			if (!userDoc.exists && options?.requireAdmin) {
				return res.status(403).json({ success: false, error: "Access denied. Admin role required." });
			}

			const userData = userDoc.exists ? (userDoc.data() || {}) : {};

			// Check moderation state
			const modDoc = await db.collection("userModeration").doc(uid).get();
			if (modDoc.exists) {
				const modData = modDoc.data() || {};
				if (modData.status === "BANNED") {
					if (modData.expiresAt && Date.now() > modData.expiresAt) {
						// Auto-unban
						await db.collection("userModeration").doc(uid).update({
							status: "ACTIVE",
							expiresAt: null,
						});
						await db.collection("moderationLogs").add({
							adminUid: "SYSTEM",
							targetUid: uid,
							action: "UNBAN",
							timestamp: Date.now(),
							reason: "Temporary ban expired",
							duration: "N/A",
							ip: req.socket.remoteAddress || "127.0.0.1",
							oldState: "BANNED",
							newState: "ACTIVE"
						});
					} else {
						return res.status(403).json({
							success: false,
							error: {
								code: "BANNED",
								message: "This account has been suspended.",
								reason: modData.reason || "Violation of terms",
								duration: modData.duration || "Permanent",
								referenceId: modData.caseId || uid.substring(0, 8).toUpperCase()
							}
						});
					}
				}
				if (modData.status === "PENDING_DELETION") {
					const isAllowedRoute = req.url?.startsWith("/api/moderation/appeal") || req.url?.startsWith("/api/auth/check-status");
					if (!isAllowedRoute) {
						return res.status(403).json({
							success: false,
							error: {
								code: "PENDING_DELETION",
								message: "Your account is currently scheduled for deletion.",
								referenceId: modData.caseId || uid.substring(0, 8).toUpperCase()
							}
						});
					}
				}
			}

			const isAdmin = userData.isAdmin === true || userData.role === "admin";
			if (options?.requireAdmin && !isAdmin) {
				return res.status(403).json({ success: false, error: "Access denied. Admin role required." });
			}

			req.user = {
				uid,
				email: decodedToken.email,
				role: userData.role || (isAdmin ? "admin" : "user"),
				isAdmin
			};

			return handler(req, res);
		} catch (error: any) {
			console.error("Auth & Moderation verification error:", error);
			return res.status(401).json({ success: false, error: "Invalid or expired session token." });
		}
	};
}
