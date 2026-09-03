import { NextApiResponse } from "next";
import { getAdminFirestore } from "@/firebase/firebaseAdmin";
import { withApiErrorHandler } from "@/utils/apiErrorHandler";
import { withAuthAndModeration, AuthenticatedRequest } from "@/utils/authMiddleware";
import {
	checkRateLimit,
	resolveOrgAndMembership,
	OrganizationJoinRequest,
} from "@/utils/orgEngine";

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
	const db = getAdminFirestore();
	const uid = req.user?.uid;
	const { id } = req.query;
	const orgIdentifier = id as string;

	if (!uid) {
		return res.status(401).json({ success: false, error: "Unauthorized" });
	}

	if (req.method !== "POST") {
		return res.status(405).json({ success: false, error: "Method not allowed" });
	}

	try {
		// Cooldown rate-limit: 5 applications per day max
		const passedLimit = await checkRateLimit(uid, "org.join_request", 5, 86400);
		if (!passedLimit) {
			return res.status(429).json({ success: false, error: "Rate Limited: Maximum 5 join requests per day." });
		}

		// Resolve org and membership status
		const { org, member } = await resolveOrgAndMembership(orgIdentifier, uid);
		if (!org) {
			return res.status(404).json({ success: false, error: "Not Found: Organization does not exist" });
		}

		if (member && member.status === "active") {
			return res.status(400).json({ success: false, error: "Validation Error: You are already a member of this organization" });
		}

		const { message = "" } = req.body;

		// Check if a request already exists with status 'Pending'
		const existingReqSnap = await db
			.collection("organizationJoinRequests")
			.where("organizationId", "==", org.id)
			.where("uid", "==", uid)
			.where("status", "==", "Pending")
			.limit(1)
			.get();

		if (!existingReqSnap.empty) {
			return res.status(409).json({ success: false, error: "Conflict: You already have a pending join request" });
		}

		const requestId = `${org.id}_${uid}`;
		const newRequest: OrganizationJoinRequest = {
			requestId,
			organizationId: org.id,
			uid,
			message: message.trim().substring(0, 500),
			status: "Pending",
			submittedAt: Date.now(),
			reviewedBy: null,
			reviewedAt: null,
			adminNote: null,
		};

		await db.collection("organizationJoinRequests").doc(requestId).set(newRequest);

		return res.status(201).json({ success: true, message: "Join request submitted successfully", request: newRequest });
	} catch (error: any) {
		console.error("POST /api/organizations/:id/join error:", error);
		return res.status(500).json({ success: false, error: "Internal Error" });
	}
}

export default withApiErrorHandler(withAuthAndModeration(handler));
