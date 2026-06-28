import { withApiErrorHandler } from "@/utils/apiErrorHandler";
import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminAuth, getAdminFirestore } from "@/firebase/firebaseAdmin";
import { NotificationDispatcher, BeastNotificationEvent } from "@/utils/notificationDispatcher";

async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== "POST") {
		return res.status(405).json({ success: false, message: "Method Not Allowed" });
	}

	try {
		// 1. Authenticate Request
		let decodedToken: any = null;
		try {
			const authHeader = req.headers.authorization;
			if (!authHeader || !authHeader.startsWith("Bearer ")) {
				return res.status(401).json({ success: false, message: "Unauthorized: Missing token" });
			}
			const token = authHeader.split("Bearer ")[1];
			decodedToken = await getAdminAuth().verifyIdToken(token);
		} catch (tokenErr: any) {
			console.warn("[Auth Warning] Authentication failed or skipped due to local credentials:", tokenErr.message);
			if (process.env.NODE_ENV === "development") {
				decodedToken = { email: "admin@test.com", uid: "mock_admin" };
			} else {
				return res.status(401).json({ success: false, message: `Unauthorized: ${tokenErr.message}` });
			}
		}

		// Double check if requester is administrator
		const db = getAdminFirestore();
		if (decodedToken.uid !== "mock_admin") {
			const userDoc = await db.collection("users").doc(decodedToken.uid).get();
			if (!userDoc.exists || userDoc.data()?.role !== "admin") {
				return res.status(403).json({ success: false, message: "Forbidden: Admin access required" });
			}
		}

		// 2. Parse request arguments
		const { eventType, recipientEmail, recipientName, customContent, placeholders } = req.body;
		if (!eventType || !recipientEmail || !recipientName) {
			return res.status(400).json({ success: false, message: "Missing required parameters: eventType, recipientEmail, recipientName" });
		}

		const event = eventType as BeastNotificationEvent;

		// 3. Dispatch via central NotificationDispatcher
		const result = await NotificationDispatcher.dispatch(event, {
			toEmail: recipientEmail,
			toUid: decodedToken.uid === "mock_admin" ? "mock_admin_uid" : decodedToken.uid,
			userName: recipientName,
			customContent: customContent || "",
			placeholders: placeholders || {
				contestTitle: "Weekly Coding Cup #48",
				problemTitle: "LRU Cache Optimization",
				difficulty: "Medium",
				focus: "Dynamic Programming, Trees",
				timeLeft: "15 Minutes",
				timeLeftText: "Starts in 15 Minutes",
				startTime: new Date(Date.now() + 15 * 60 * 1000).toLocaleString(),
				endTime: new Date(Date.now() + 135 * 60 * 1000).toLocaleString(),
				durationText: "120 Minutes",
				rank: "3rd",
				ratingChange: "+45",
				solvedCount: "250",
				level: "8",
				badgeName: "Binary Search Beast",
				universityName: "Stanford University",
				inviter: "Professor Alex",
				replierName: "Dung Chi",
				threadTitle: "Optimizing Dijkstra with Fibonacci Heaps",
				excerpt: "Have you tried matching it with a d-ary heap layout instead? It performs significantly better.",
				newRole: "Moderator"
			},
			eventId: `test-trigger-${event}-${recipientEmail}-${Date.now()}`
		});

		return res.status(200).json(result);
	} catch (error: any) {
		console.error("Error triggering test event:", error);
		return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
	}
}

export default withApiErrorHandler(handler);
