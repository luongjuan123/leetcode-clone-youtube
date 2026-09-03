import { NextApiResponse } from "next";
import { getAdminFirestore } from "@/firebase/firebaseAdmin";
import { withApiErrorHandler } from "@/utils/apiErrorHandler";
import { withAuthAndModeration, AuthenticatedRequest } from "@/utils/authMiddleware";
import { randomBytes } from "crypto";
import {
	checkOrgPermission,
	resolveOrgAndMembership,
	emitOrgEvent,
	OrganizationInvitation,
} from "@/utils/orgEngine";

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
	const db = getAdminFirestore();
	const uid = req.user?.uid;
	const { id } = req.query;
	const orgIdentifier = id as string;

	if (!uid) {
		return res.status(401).json({ success: false, error: "Unauthorized" });
	}

	// Resolve organization
	const { org } = await resolveOrgAndMembership(orgIdentifier, uid);
	if (!org) {
		return res.status(404).json({ success: false, error: "Not Found: Organization does not exist" });
	}

	// GET /api/organizations/:id/invitations - List pending invitations
	if (req.method === "GET") {
		try {
			const { allowed } = await checkOrgPermission(org.id, uid, "organization.inviteMember");
			if (!allowed) {
				return res.status(403).json({ success: false, error: "Forbidden: Insufficient Permissions" });
			}

			const snapshot = await db
				.collection("organizationInvitations")
				.where("organizationId", "==", org.id)
				.where("status", "==", "Pending")
				.get();

			const list: OrganizationInvitation[] = [];
			snapshot.forEach((doc) => {
				list.push(doc.data() as OrganizationInvitation);
			});

			return res.status(200).json({ success: true, invitations: list });
		} catch (error: any) {
			console.error("GET /api/organizations/:id/invitations error:", error);
			return res.status(500).json({ success: false, error: "Internal Error" });
		}
	}

	// POST /api/organizations/:id/invitations - Create & Send Invitation
	if (req.method === "POST") {
		try {
			const { allowed } = await checkOrgPermission(org.id, uid, "organization.inviteMember");
			if (!allowed) {
				return res.status(403).json({ success: false, error: "Forbidden: Insufficient Permissions" });
			}

			const { email, roleId = "member" } = req.body;
			if (!email) {
				return res.status(400).json({ success: false, error: "Validation Error: Missing email address" });
			}

			const cleanEmail = email.toLowerCase().trim();

			// Check if target user is already a member
			let targetUid: string | null = null;
			const userSnap = await db.collection("users").where("email", "==", cleanEmail).limit(1).get();
			if (!userSnap.empty) {
				targetUid = userSnap.docs[0].id;
				const memberDoc = await db.collection("organizationMembers").doc(`${org.id}_${targetUid}`).get();
				if (memberDoc.exists && memberDoc.data()?.status === "active") {
					return res.status(409).json({ success: false, error: "Conflict: User is already a member" });
				}
			}

			// Check if a pending invitation already exists for this email
			const existingInviteSnap = await db
				.collection("organizationInvitations")
				.where("organizationId", "==", org.id)
				.where("email", "==", cleanEmail)
				.where("status", "==", "Pending")
				.limit(1)
				.get();

			if (!existingInviteSnap.empty) {
				return res.status(409).json({ success: false, error: "Conflict: User already has a pending invitation" });
			}

			const token = randomBytes(32).toString("hex");
			const inviteId = db.collection("organizationInvitations").doc().id;

			const newInvitation: OrganizationInvitation = {
				inviteId,
				organizationId: org.id,
				email: cleanEmail,
				uid: targetUid,
				token,
				roleId,
				status: "Pending",
				expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days expiration
				createdBy: uid,
				acceptedAt: null,
			};

			await db.collection("organizationInvitations").doc(inviteId).set(newInvitation);

			// Trigger invite email & system alerts
			await emitOrgEvent(
				org.id,
				uid,
				"member.invited",
				targetUid,
				"organizationInvitations",
				inviteId,
				{ email: cleanEmail, roleId },
				req.socket.remoteAddress || "127.0.0.1"
			);

			return res.status(201).json({ success: true, message: "Invitation generated and sent successfully", invitation: newInvitation });
		} catch (error: any) {
			console.error("POST /api/organizations/:id/invitations error:", error);
			return res.status(500).json({ success: false, error: "Internal Error" });
		}
	}

	return res.status(405).json({ success: false, error: "Method not allowed" });
}

export default withApiErrorHandler(withAuthAndModeration(handler));
