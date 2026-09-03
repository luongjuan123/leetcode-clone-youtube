import { NextApiResponse } from "next";
import { getAdminFirestore } from "@/firebase/firebaseAdmin";
import { withApiErrorHandler } from "@/utils/apiErrorHandler";
import { withAuthAndModeration, AuthenticatedRequest } from "@/utils/authMiddleware";
import {
	checkOrgPermission,
	resolveOrgAndMembership,
	emitOrgEvent,
	Organization,
} from "@/utils/orgEngine";

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
	const db = getAdminFirestore();
	const uid = req.user?.uid;
	const { id } = req.query;
	const orgIdentifier = id as string;

	if (!orgIdentifier) {
		return res.status(400).json({ success: false, error: "Validation Error: Missing organization ID/slug" });
	}

	// Resolve the organization first
	let resolved;
	try {
		resolved = await resolveOrgAndMembership(orgIdentifier, uid || null);
	} catch (e: any) {
		return res.status(403).json({ success: false, error: "Forbidden: Organization is suspended" });
	}

	const { org, member, role } = resolved;
	if (!org) {
		return res.status(404).json({ success: false, error: "Not Found: Organization does not exist" });
	}

	// Security: If visibility is secret and user is not an active member, deny visibility (Not Found for obfuscation)
	if (org.visibility === "secret" && !member) {
		return res.status(404).json({ success: false, error: "Not Found" });
	}

	// GET /api/organizations/:id
	if (req.method === "GET") {
		try {
			// If private organization, hide sensitive metadata from guests/non-members
			if (org.visibility === "private" && !member) {
				const guestProfile = {
					id: org.id,
					slug: org.slug,
					name: org.name,
					displayName: org.displayName,
					shortName: org.shortName,
					description: org.description,
					avatar: org.avatar,
					banner: org.banner,
					organizationType: org.organizationType,
					visibility: org.visibility,
					country: org.country,
					city: org.city,
					website: org.website,
					memberCount: org.memberCount,
					status: org.status,
				};
				return res.status(200).json({ success: true, organization: guestProfile, userRole: null });
			}

			return res.status(200).json({
				success: true,
				organization: org,
				userRole: member ? member.roleId : null,
			});
		} catch (error: any) {
			console.error("GET /api/organizations/:id error:", error);
			return res.status(500).json({ success: false, error: "Internal Error" });
		}
	}

	// PATCH /api/organizations/:id - Update Organization Profile Settings
	if (req.method === "PATCH") {
		if (!uid) {
			return res.status(401).json({ success: false, error: "Unauthorized" });
		}

		try {
			const { allowed } = await checkOrgPermission(org.id, uid, "organization.manageSettings");
			if (!allowed) {
				return res.status(403).json({ success: false, error: "Forbidden: Insufficient Permissions" });
			}

			const {
				displayName,
				shortName,
				description,
				avatar,
				banner,
				visibility,
				website,
				country,
				city,
				location,
				email,
				contactPhone,
				socialLinks,
			} = req.body;

			const updateData: Partial<Organization> = {
				updatedAt: Date.now(),
			};

			if (displayName !== undefined) updateData.displayName = displayName.trim();
			if (shortName !== undefined) updateData.shortName = shortName.trim();
			if (description !== undefined) updateData.description = description.trim();
			if (avatar !== undefined) updateData.avatar = avatar.trim();
			if (banner !== undefined) updateData.banner = banner.trim();
			if (visibility !== undefined) updateData.visibility = visibility;
			if (website !== undefined) updateData.website = website.trim();
			if (country !== undefined) updateData.country = country.trim();
			if (city !== undefined) updateData.city = city.trim();
			if (location !== undefined) updateData.location = location.trim();
			if (email !== undefined) updateData.email = email.trim();
			if (contactPhone !== undefined) updateData.contactPhone = contactPhone.trim();
			if (socialLinks !== undefined) updateData.socialLinks = socialLinks;

			await db.collection("organizations").doc(org.id).update(updateData);

			// Log action
			await emitOrgEvent(
				org.id,
				uid,
				"organization.settings_updated",
				null,
				"organizations",
				org.id,
				updateData,
				req.socket.remoteAddress || "127.0.0.1"
			);

			return res.status(200).json({ success: true, message: "Organization updated successfully" });
		} catch (error: any) {
			console.error("PATCH /api/organizations/:id error:", error);
			return res.status(500).json({ success: false, error: "Internal Error" });
		}
	}

	// DELETE /api/organizations/:id - Soft delete organization
	if (req.method === "DELETE") {
		if (!uid) {
			return res.status(401).json({ success: false, error: "Unauthorized" });
		}

		try {
			const { allowed } = await checkOrgPermission(org.id, uid, "organization.deleteOrganization");
			if (!allowed) {
				return res.status(403).json({ success: false, error: "Forbidden: Insufficient Permissions" });
			}

			await db.collection("organizations").doc(org.id).update({
				status: "deleted",
				deletedAt: Date.now(),
			});

			await emitOrgEvent(
				org.id,
				uid,
				"organization.deleted",
				null,
				"organizations",
				org.id,
				{},
				req.socket.remoteAddress || "127.0.0.1"
			);

			return res.status(200).json({ success: true, message: "Organization soft-deleted successfully" });
		} catch (error: any) {
			console.error("DELETE /api/organizations/:id error:", error);
			return res.status(500).json({ success: false, error: "Internal Error" });
		}
	}

	return res.status(405).json({ success: false, error: "Method not allowed" });
}

export default withApiErrorHandler(withAuthAndModeration(handler));
