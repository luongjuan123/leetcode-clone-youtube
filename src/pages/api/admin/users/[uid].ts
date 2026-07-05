import { NextApiResponse } from "next";
import { getAdminFirestore } from "@/firebase/firebaseAdmin";
import { withApiErrorHandler } from "@/utils/apiErrorHandler";
import { withAdminGuard } from "@/utils/withAdminGuard";
import { AuthenticatedRequest } from "@/utils/authMiddleware";

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
	if (req.method !== "GET") {
		return res.status(405).json({ success: false, error: "Method not allowed" });
	}

	const { uid } = req.query;
	if (!uid || typeof uid !== "string") {
		return res.status(400).json({ success: false, error: "Invalid user ID" });
	}

	try {
		const db = getAdminFirestore();

		// Fetch user doc
		const userDoc = await db.collection("users").doc(uid).get();
		if (!userDoc.exists) {
			return res.status(404).json({ success: false, error: "User not found" });
		}

		// Fetch moderation details
		const modDoc = await db.collection("userModeration").doc(uid).get();
		const modData = modDoc.exists ? modDoc.data() : null;

		// Fetch logs involving this user
		const logsSnapshot = await db.collection("moderationLogs")
			.where("targetUid", "==", uid)
			.get();

		const logs: any[] = [];
		logsSnapshot.forEach(docSnap => {
			logs.push({ id: docSnap.id, ...docSnap.data() });
		});

		// Sort logs by timestamp desc in-memory to avoid needing index for compound query during dev
		logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

		// Fetch user recent submissions
		const submissionsSnapshot = await db.collection("submissions")
			.where("uid", "==", uid)
			.limit(5)
			.get();

		const recentSubmissions: any[] = [];
		submissionsSnapshot.forEach(docSnap => {
			recentSubmissions.push({ id: docSnap.id, ...docSnap.data() });
		});
		recentSubmissions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

		const userData = userDoc.data();

		return res.status(200).json({
			success: true,
			user: {
				uid,
				...userData,
				role: userData?.role || (userData?.isAdmin ? "admin" : "user"),
			},
			moderation: modData,
			logs,
			recentSubmissions
		});
	} catch (error: any) {
		console.error("GET user details error:", error);
		return res.status(500).json({ success: false, error: error.message });
	}
}

export default withApiErrorHandler(withAdminGuard(handler));
