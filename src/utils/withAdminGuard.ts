import { NextApiResponse } from "next";
import { getAdminFirestore, getAdminAuth } from "@/firebase/firebaseAdmin";
import { AuthenticatedRequest, AuthenticatedHandler } from "./authMiddleware";

const superAdminEmails = [
	"admin@leetcode.com",
	"juan@test.com",
	"admin@test.com",
	"dungpubgame@gmail.com",
	"24110215@st.vju.ac.vn"
];

export function withAdminGuard(handler: AuthenticatedHandler) {
	return async (req: AuthenticatedRequest, res: NextApiResponse) => {
		try {
			const authHeader = req.headers.authorization;
			if (!authHeader || !authHeader.startsWith("Bearer ")) {
				return res.status(403).json({ success: false, error: "Forbidden: Missing or invalid authorization header" });
			}

			const token = authHeader.substring(7);
			let decodedToken;
			try {
				const adminAuth = getAdminAuth();
				decodedToken = await adminAuth.verifyIdToken(token);
			} catch (tokenErr: any) {
				console.warn("[Auth Warning] verifyIdToken failed, checking environment for local development:", tokenErr.message);
				if (process.env.NODE_ENV === "development" && !process.env.FIREBASE_SERVICE_ACCOUNT) {
					decodedToken = { uid: "mock_user", email: "juan@test.com" };
				} else {
					return res.status(403).json({ success: false, error: `Forbidden: Token verification failed (${tokenErr.message})` });
				}
			}

			const uid = decodedToken.uid;
			const db = getAdminFirestore();
			const userDoc = await db.collection("users").doc(uid).get();
			if (!userDoc.exists) {
				return res.status(403).json({ success: false, error: "Forbidden: Admin user record not found" });
			}

			const userData = userDoc.data() || {};
			const email = decodedToken.email || userData.email || "";
			const isAdmin = superAdminEmails.includes(email) || userData.role === "admin" || userData.isAdmin === true;

			if (!isAdmin) {
				return res.status(403).json({ success: false, error: "Forbidden: Administrative access required" });
			}

			req.user = {
				uid,
				email,
				role: userData.role || "admin",
				isAdmin: true
			};

			return handler(req, res);
		} catch (error: any) {
			console.error("withAdminGuard execution error:", error);
			return res.status(403).json({ success: false, error: "Forbidden: Administrative guard validation failed" });
		}
	};
}
