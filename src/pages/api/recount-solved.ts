/**
 * POST /api/recount-solved
 *
 * Admin-only endpoint that:
 * 1. Verifies the caller is an authenticated admin via their Firebase ID token
 * 2. Fetches all currently-existing problem IDs from Firestore
 * 3. For every user, removes stale (deleted) problem IDs from their solvedProblems array
 * 4. Writes cleaned arrays back using the Admin SDK (bypasses client security rules)
 *
 * Body: { idToken: string }
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminFirestore, getAdminAuth } from "@/firebase/firebaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	const { idToken } = req.body as { idToken?: string };
	if (!idToken) {
		return res.status(401).json({ error: "Missing idToken" });
	}

	try {
		// 1. Verify the caller's identity and admin status
		const adminAuth = getAdminAuth();
		const decoded = await adminAuth.verifyIdToken(idToken);
		const callerUid = decoded.uid;

		const db = getAdminFirestore();

		// Check the caller is an admin in Firestore
		const callerDoc = await db.collection("users").doc(callerUid).get();
		if (!callerDoc.exists || callerDoc.data()?.isAdmin !== true) {
			return res.status(403).json({ error: "Caller is not an admin" });
		}

		// 2. Collect all valid problem IDs from Firestore
		const problemsSnap = await db.collection("problems").get();
		const validIds = new Set<string>();
		problemsSnap.forEach((doc) => validIds.add(doc.id));

		// 3. Fetch all users
		const usersSnap = await db.collection("users").get();

		// 4. Batch-write cleaned solvedProblems (Admin SDK has no security rule restrictions)
		const BATCH_SIZE = 400;
		let batch = db.batch();
		let opsInBatch = 0;
		let usersUpdated = 0;
		let removedTotal = 0;

		for (const userDoc of usersSnap.docs) {
			const data = userDoc.data();
			const stored: string[] = data.solvedProblems || [];
			const cleaned = stored.filter((id) => validIds.has(id));

			if (cleaned.length !== stored.length) {
				removedTotal += stored.length - cleaned.length;
				batch.update(userDoc.ref, { solvedProblems: cleaned });
				usersUpdated++;
				opsInBatch++;

				if (opsInBatch >= BATCH_SIZE) {
					await batch.commit();
					batch = db.batch();
					opsInBatch = 0;
				}
			}
		}

		if (opsInBatch > 0) {
			await batch.commit();
		}

		return res.status(200).json({
			success: true,
			validProblemCount: validIds.size,
			usersUpdated,
			removedTotal,
		});
	} catch (err: any) {
		console.error("recount-solved error:", err);
		return res.status(500).json({ error: err.message || "Internal server error" });
	}
}
