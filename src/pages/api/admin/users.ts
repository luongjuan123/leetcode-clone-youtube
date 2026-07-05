import { NextApiResponse } from "next";
import { getAdminFirestore } from "@/firebase/firebaseAdmin";
import { withApiErrorHandler } from "@/utils/apiErrorHandler";
import { withAdminGuard } from "@/utils/withAdminGuard";
import { AuthenticatedRequest } from "@/utils/authMiddleware";

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
	if (req.method !== "GET") {
		return res.status(405).json({ success: false, error: "Method not allowed" });
	}

	try {
		const db = getAdminFirestore();
		const { search, role, status, sortBy, sortOrder } = req.query;

		const usersSnap = await db.collection("users").get();
		const moderationSnap = await db.collection("userModeration").get();
		const moderationMap = new Map();
		moderationSnap.forEach(doc => {
			moderationMap.set(doc.id, doc.data());
		});

		let list: any[] = [];
		usersSnap.forEach(docSnap => {
			const data = docSnap.data();
			const uid = docSnap.id;
			const modData = moderationMap.get(uid) || { status: "ACTIVE" };

			list.push({
				uid,
				email: data.email || "",
				displayName: data.displayName || "Anonymous",
				role: data.role || (data.isAdmin ? "admin" : "user"),
				status: modData.status,
				bannedReason: modData.reason || "",
				bannedDuration: modData.duration || "",
				bannedAt: modData.bannedAt || null,
				expiresAt: modData.expiresAt || null,
				easyCount: data.easyCount || 0,
				mediumCount: data.mediumCount || 0,
				hardCount: data.hardCount || 0,
				mlCount: data.mlCount || 0,
				solvedCount: (data.easyCount || 0) + (data.mediumCount || 0) + (data.hardCount || 0) + (data.mlCount || 0),
				score: data.score || 0,
				createdAt: data.createdAt || 0,
				username: data.username || ""
			});
		});

		// Apply filters
		if (search) {
			const q = (search as string).toLowerCase().trim();
			list = list.filter(u => 
				u.displayName.toLowerCase().includes(q) || 
				u.email.toLowerCase().includes(q) || 
				u.username.toLowerCase().includes(q) || 
				u.uid.toLowerCase().includes(q)
			);
		}

		if (role) {
			list = list.filter(u => u.role === role);
		}

		if (status) {
			list = list.filter(u => u.status === status);
		}

		// Sorting
		const field = (sortBy as string) || "createdAt";
		const direction = (sortOrder as string) || "desc";

		list.sort((a, b) => {
			let valA = a[field];
			let valB = b[field];

			if (field === "solved") {
				valA = a.solvedCount;
				valB = b.solvedCount;
			}

			if (valA < valB) return direction === "asc" ? -1 : 1;
			if (valA > valB) return direction === "asc" ? 1 : -1;
			return 0;
		});

		return res.status(200).json({ success: true, users: list });
	} catch (error: any) {
		console.error("GET admin users error:", error);
		return res.status(500).json({ success: false, error: error.message });
	}
}

export default withApiErrorHandler(withAdminGuard(handler));
