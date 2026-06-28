import { withApiErrorHandler } from "@/utils/apiErrorHandler";
import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminFirestore } from "@/firebase/firebaseAdmin";
import { NotificationDispatcher } from "@/utils/notificationDispatcher";
import { NotificationRecipientService } from "@/utils/notificationRecipientService";

type ResponseData = {
	success: boolean;
	message: string;
	processedContests?: string[];
};

async function handler(
	req: NextApiRequest,
	res: NextApiResponse<ResponseData>
) {
	if (req.method !== "GET" && req.method !== "POST") {
		return res.status(405).json({ success: false, message: "Method Not Allowed" });
	}

	try {
		// 1. Authorize Cron/Trigger (using simple secret token)
		const cronSecret = process.env.CRON_SECRET || "beastcode-cron-secret-key-12345";
		const reqSecret = req.query.secret || req.headers["x-cron-secret"];
		if (reqSecret !== cronSecret) {
			return res.status(401).json({ success: false, message: "Unauthorized: Invalid cron secret" });
		}

		const now = Date.now();
		let targetContests: any[] = [];
		let isMocked = false;

		// 2. Fetch upcoming contests
		try {
			const db = getAdminFirestore();
			const contestsSnap = await db.collection("contests")
				.where("startTime", ">", now)
				.get();

			const pendingContests = contestsSnap.docs.map(doc => ({
				id: doc.id,
				...doc.data()
			})) as any[];

			targetContests = pendingContests.filter(c => {
				const timeDiff = c.startTime - now;
				// Starts in the next 15 minutes
				const isStartingSoon = timeDiff <= 15 * 60 * 1000 && timeDiff > 0;
				return isStartingSoon && !c.reminderSent;
			});
		} catch (adminErr: any) {
			console.warn("[Firebase Admin Credential Warn] Falling back to mock reminders:", adminErr.message);
			isMocked = true;
			targetContests = [
				{
					id: "mock-contest-id",
					title: "BeastCode Tournament Grand Prix (Simulated)",
					startTime: now + 12 * 60 * 1000,
					endTime: now + 132 * 60 * 1000,
					duration: 120,
					visibility: "public",
					reminderSent: false
				}
			];
		}

		if (targetContests.length === 0) {
			return res.status(200).json({
				success: true,
				message: "No contests starting in the next 15 minutes that require reminders.",
				processedContests: []
			});
		}

		const processedContests: string[] = [];

		// 3. Process reminders for each target contest
		for (const contest of targetContests) {
			let targetedRecipients: any[] = [];
			try {
				targetedRecipients = await NotificationRecipientService.resolveRecipients("CONTEST_SOON", contest.id, {
					university: contest.university,
					visibility: contest.visibility
				});
			} catch (resolveErr: any) {
				console.error(`[Recipient Resolution Failure] Skipping contest ${contest.title}:`, resolveErr.message);
				continue;
			}

			if (targetedRecipients.length === 0) {
				if (!isMocked) {
					const db = getAdminFirestore();
					await db.collection("contests").doc(contest.id).update({ reminderSent: true });
				}
				processedContests.push(contest.title);
				continue;
			}

			const origin = req.headers.host ? `http://${req.headers.host}` : "https://beastcode.codes";
			const contestUrl = `${origin}/contests/${contest.id}`;

			// Send to each targeted recipient using central NotificationDispatcher
			for (const u of targetedRecipients) {
				try {
					await NotificationDispatcher.dispatch("CONTEST_SOON", {
						toEmail: u.email,
						toUid: u.uid,
						userName: u.displayName,
						ctaUrl: contestUrl,
						placeholders: {
							contestTitle: contest.title,
							startTime: new Date(contest.startTime).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" }),
							timeLeft: "15 Minutes"
						},
						eventId: `contest-reminder-15m-${contest.id}-${u.uid}`
					});
				} catch (sendErr: any) {
					console.error(`Failed to dispatch reminder to ${u.email}:`, sendErr.message);
				}
			}

			if (!isMocked) {
				const db = getAdminFirestore();
				await db.collection("contests").doc(contest.id).update({ reminderSent: true });
			}
			processedContests.push(contest.title);
		}

		return res.status(200).json({
			success: true,
			message: `Sent reminders for ${processedContests.length} contest(s).`,
			processedContests
		});
	} catch (error: any) {
		console.error("Error processing reminders:", error);
		return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
	}
}

export default withApiErrorHandler(handler);
