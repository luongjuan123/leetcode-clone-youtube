import { withApiErrorHandler } from "@/utils/apiErrorHandler";
import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminAuth, getAdminFirestore } from "@/firebase/firebaseAdmin";
import { NotificationDispatcher } from "@/utils/notificationDispatcher";
import { BeastNotificationEvent } from "@/utils/notificationTypes";

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
				// Fallback to mock authenticated user for local development
				decodedToken = { uid: "mock_user", email: "juan@test.com" };
			} else {
				return res.status(401).json({ success: false, message: `Unauthorized: ${tokenErr.message}` });
			}
		}

		const senderUid = decodedToken.uid;

		// 2. Parse request body
		const { eventType, recipientUid, placeholders = {}, ctaUrl, customContent, metadata = {} } = req.body;
		if (!eventType || !recipientUid) {
			return res.status(400).json({ success: false, message: "Missing required parameters: eventType, recipientUid" });
		}

		const db = getAdminFirestore();

		// 3. Fetch recipient details
		const recipientDoc = await db.collection("users").doc(recipientUid).get();
		if (!recipientDoc.exists) {
			return res.status(404).json({ success: false, message: "Recipient user not found" });
		}
		const recipientData = recipientDoc.data() || {};
		const recipientEmail = recipientData.email || "";
		const recipientName = recipientData.displayName || recipientData.username || "User";

		if (!recipientEmail) {
			return res.status(400).json({ success: false, message: "Recipient email not found in profile" });
		}

		// 4. Fetch sender details for social context
		let fromDisplayName = "BeastCode Platform";
		let fromAvatarUrl = "";

		if (senderUid && senderUid !== "system") {
			const senderDoc = await db.collection("users").doc(senderUid).get();
			if (senderDoc.exists) {
				const senderData = senderDoc.data() || {};
				fromDisplayName = senderData.displayName || senderData.username || "User";
				fromAvatarUrl = senderData.avatarUrl || "";
			}
		}

		// Add replierName or sender information to placeholders automatically if not present
		if (!placeholders.replierName && fromDisplayName) {
			placeholders.replierName = fromDisplayName;
		}

		// 5. Dispatch notification
		const result = await NotificationDispatcher.dispatch(eventType as BeastNotificationEvent, {
			toEmail: recipientEmail,
			toUid: recipientUid,
			userName: recipientName,
			placeholders,
			ctaUrl,
			customContent,
			metadata,
			fromUid: senderUid,
			fromDisplayName,
			fromAvatarUrl,
			eventId: placeholders.eventId || `${eventType}-${recipientUid}-${Date.now()}`
		});

		return res.status(200).json(result);
	} catch (error: any) {
		console.error("Error in dispatch API:", error);
		return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
	}
}

export default withApiErrorHandler(handler);
