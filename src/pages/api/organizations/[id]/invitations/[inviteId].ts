import { NextApiResponse } from "next";
import { getAdminFirestore } from "@/firebase/firebaseAdmin";
import { withApiErrorHandler } from "@/utils/apiErrorHandler";
import { withAuthAndModeration, AuthenticatedRequest } from "@/utils/authMiddleware";
import {
	checkOrgPermission,
	resolveOrgAndMembership,
	emitOrgEvent,
} from "@/utils/orgEngine";

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
	const db = getAdminFirestore();
	const uid = req.user?.uid;
	const { id, inviteId } = req.query;

	const orgIdentifier = id as string;
	const invitationId = inviteId as string;

	if (!uid) {
		return res.status(401).json({ success: false, error: "Unauthorized" });
	}

	if (req.method !== "DELETE") {
		return res.status(405).json({ success: false, error: "Method not allowed" });
	}

	try {
		// Resolve organization
		const { org } = await resolveOrgAndMembership(orgIdentifier, uid);
		if (!org) {
			return res.status(404).json({ success: false, error: "Not Found: Organization does not exist" });
		}

		// Security Check
		const { allowed } = await checkOrgPermission(org.id, uid, "organization.inviteMember");
		if (!allowed) {
			return res.status(403).json({ success: false, error: "Forbidden: Insufficient Permissions" });
		}

		const inviteRef = db.collection("organizationInvitations").doc(invitationId);
		const inviteSnap = await inviteRef.get();
		if (!inviteSnap.exists) {
			return res.status(404).json({ success: false, error: "Not Found: Invitation not found" });
		}

		const inviteData = inviteSnap.data() || {};
		if (inviteData.organizationId !== org.id) {
			return res.status(400).json({ success: false, error: "Validation Error: Invitation does not belong to this organization" });
		}

		// Delete the invitation
		await inviteRef.delete();

		await emitOrgEvent(
			org.id,
			uid,
			"member.invitation_revoked",
			inviteData.uid,
			"organizationInvitations",
			invitationId,
			{ email: inviteData.email },
			req.socket.remoteAddress || "127.0.0.1"
		);

		return res.status(200).json({ success: true, message: "Invitation revoked successfully" });
	} catch (error: any) {
		console.error("DELETE /api/organizations/:id/invitations/:inviteId error:", error);
		return res.status(500).json({ success: false, error: "Internal Error" });
	}
}

export default withApiErrorHandler(withAuthAndModeration(handler));
