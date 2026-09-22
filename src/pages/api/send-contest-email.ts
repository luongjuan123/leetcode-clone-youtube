import { withApiErrorHandler } from "@/utils/apiErrorHandler";
import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminAuth, getAdminFirestore } from "@/firebase/firebaseAdmin";
import { NotificationDispatcher } from "@/utils/notificationDispatcher";
import { NotificationRecipientService } from "@/utils/notificationRecipientService";
import { EmailService } from "@/utils/emailService";
import { getSiteUrl } from "@/utils/siteConfig";

type ResponseData = {
	success: boolean;
	message: string;
	recipientCount?: number;
};

async function handler(
	req: NextApiRequest,
	res: NextApiResponse<ResponseData>
) {
	if (req.method !== "POST") {
		return res.status(405).json({ success: false, message: "Method Not Allowed" });
	}

	try {
		// 1. Authorize Request (Admin check)
		let decodedToken: any = null;
		try {
			const authHeader = req.headers.authorization;
			if (!authHeader || !authHeader.startsWith("Bearer ")) {
				return res.status(401).json({ success: false, message: "Unauthorized: Missing token" });
			}
			const token = authHeader.split("Bearer ")[1];
			decodedToken = await getAdminAuth().verifyIdToken(token);
			
			const adminEmails = ["admin@leetcode.com", "juan@test.com", "admin@test.com", "dungpubgame@gmail.com", "24110215@st.vju.ac.vn", "bomemebo6996@gmail.com"];
			const db = getAdminFirestore();
			const userDoc = await db.collection("users").doc(decodedToken.uid).get();
			const userData = userDoc.data() || {};
			const isAdmin = userData.role === "admin" || userData.isAdmin === true || adminEmails.includes(decodedToken.email || "");

			if (!isAdmin) {
				return res.status(403).json({ success: false, message: "Forbidden: Not an admin" });
			}
		} catch (tokenErr: any) {
			console.warn("[Auth Warning] Admin authentication failed or skipped due to local credentials:", tokenErr.message);
			if (process.env.NODE_ENV === "development") {
				decodedToken = { email: "admin@test.com", uid: "mock_admin" };
			} else {
				return res.status(401).json({ success: false, message: `Unauthorized: ${tokenErr.message}` });
			}
		}

		// 2. Parse Request Body
		const {
			contestId,
			title,
			description,
			banner,
			startTime,
			endTime,
			duration,
			visibility,
			university,
			origin
		} = req.body;

		if (!contestId || !title || !startTime || !endTime) {
			return res.status(400).json({ success: false, message: "Missing required contest parameters" });
		}

		// 3. Fetch Registered Users dynamically
		let eligibleUsers: { uid: string; email: string; displayName: string }[] = [];
		try {
			eligibleUsers = await NotificationRecipientService.resolveRecipients("CONTEST_PUBLISHED", contestId, {
				university,
				visibility
			});
		} catch (resolveErr: any) {
			console.error("[Recipient Resolution Failure] Aborting:", resolveErr.message);
			return res.status(500).json({ success: false, message: `Recipient resolution failed: ${resolveErr.message}` });
		}

		if (eligibleUsers.length === 0) {
			return res.status(200).json({ success: true, message: "No eligible recipients found to email.", recipientCount: 0 });
		}

		// 4. Queue emails using central dispatcher in parallel and process delivery in background
		const appOrigin = (origin && !origin.includes(".run.app") && !origin.includes(".hosted.app")) ? origin : getSiteUrl();
		const contestUrl = `${appOrigin}/contests/${contestId}`;
		
		const dispatchResults = await Promise.allSettled(
			eligibleUsers.map((u) =>
				NotificationDispatcher.dispatch("CONTEST_PUBLISHED", {
					toEmail: u.email,
					toUid: u.uid,
					userName: u.displayName,
					ctaUrl: contestUrl,
					customContent: description,
					placeholders: {
						contestTitle: title,
						startTime: new Date(startTime).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" }),
						durationText: `${duration} Minutes`,
						bannerUrl: banner || undefined
					},
					eventId: `contest-published-${contestId}-${u.uid}`
				})
			)
		);

		const sentCount = dispatchResults.filter((r) => r.status === "fulfilled").length;

		// Trigger background email queue processing asynchronously without delaying the HTTP response
		setTimeout(() => {
			EmailService.processQueue().catch((err) => {
				console.error("[Contest Announcement Background Email Error]:", err);
			});
		}, 10);

		return res.status(200).json({
			success: true,
			message: `Contest announcement emails queued for ${sentCount} user(s).`,
			recipientCount: sentCount
		});

	} catch (error: any) {
		console.error("Error sending contest announcement email:", error);
		return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
	}
}

export default withApiErrorHandler(handler);
