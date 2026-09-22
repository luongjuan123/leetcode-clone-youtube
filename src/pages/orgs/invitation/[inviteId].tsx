import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Topbar from "@/components/Topbar/Topbar";
import { auth } from "@/firebase/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { FaCheck, FaTimes, FaUsers, FaCrown, FaShieldAlt } from "react-icons/fa";

import { apiClient } from "@/utils/apiClient";

export default function InvitationPage() {
	const router = useRouter();
	const { inviteId } = router.query;
	const [user, loadingAuth] = useAuthState(auth);

	const [invitation, setInvitation] = useState<any>(null);
	const [orgDetails, setOrgDetails] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [responding, setResponding] = useState(false);
	const [error, setError] = useState("");
	const [successMsg, setSuccessMsg] = useState("");

	useEffect(() => {
		if (!inviteId || loadingAuth || !user) return;

		const fetchInvitationDetails = async () => {
			setLoading(true);
			setError("");
			try {
				// Fetch from invitations using centralized apiClient
				const data = await apiClient.get(`/api/users/invitations`);

				if (data.success) {
					const found = data.invitations?.find((inv: any) => inv.inviteId === inviteId);
					if (found) {
						setInvitation(found);

						// Fetch target organization profile using apiClient (falls back to meta on fail)
						try {
							const orgData = await apiClient.get(`/api/organizations/${found.organizationId}`);
							if (orgData.success) {
								setOrgDetails(orgData.organization);
							}
						} catch (orgErr) {
							console.log("Could not fetch org details directly, using invitation metadata:", orgErr);
						}
					} else {
						setError("Invitation not found, already accepted/declined, or expired.");
					}
				} else {
					setError(data.error || "Failed to load invitation.");
				}
			} catch (err: any) {
				console.error("Error loading invitation details:", err);
				setError(err.message || "An error occurred while fetching invitation details.");
			} finally {
				setLoading(false);
			}
		};

		fetchInvitationDetails();
	}, [inviteId, user, loadingAuth]);

	const handleRespond = async (action: "accept" | "decline") => {
		if (!user || !invitation) return;
		setResponding(true);
		setError("");
		setSuccessMsg("");

		try {
			const data = await apiClient.post(`/api/users/invitations/${inviteId}/respond`, { action });
			if (data.success) {
				setSuccessMsg(action === "accept" ? "Successfully joined! Redirecting..." : "Invitation declined.");
				// Dispatch custom event to notify orgs list page to refresh in real-time
				window.dispatchEvent(new Event("org-joined"));
				setTimeout(() => {
					if (action === "accept") {
						const slug = orgDetails?.slug || invitation?.organizationSlug;
						if (slug) {
							router.push(`/orgs/${slug}`);
						} else {
							router.push("/orgs?tab=my-organizations");
						}
					} else {
						router.push("/orgs?tab=my-organizations");
					}
				}, 1500);
			} else {
				setError(data.error || `Failed to ${action} invitation.`);
			}
		} catch (err: any) {
			setError(err.message || "An error occurred.");
		} finally {
			setResponding(false);
		}
	};

	// Authenticate gate
	if (!loadingAuth && !user) {
		return (
			<main className="bg-dark-layer-2 min-h-screen pb-16 font-sans text-white">
				<Topbar />
				<div className="max-w-[550px] mx-auto px-6 mt-20">
					<div className="bg-dark-surface border border-gray-850 rounded-2xl p-8 text-center shadow-lg">
						<h3 className="text-base font-bold text-gray-200">Sign in to Accept Invitation</h3>
						<p className="text-xs text-gray-500 mt-2 max-w-sm mx-auto leading-relaxed">
							You must be signed in to verify and accept this workspace invitation.
						</p>
						<button
							onClick={() => router.push(`/auth?prev=${encodeURIComponent(router.asPath)}`)}
							className="mt-6 bg-brand-orange hover:bg-brand-orange-s text-bg-base font-black text-xs px-6 py-3 rounded-xl transition cursor-pointer shadow-glow-sm"
							style={{ color: "var(--bg-base)" }}
						>
							Sign In / Sign Up
						</button>
					</div>
				</div>
			</main>
		);
	}

	const displayLogo = orgDetails?.avatar || orgDetails?.avatarUrl || invitation?.organizationLogo;
	const displayNameStr = orgDetails?.displayName || orgDetails?.name || invitation?.organizationName;
	const displaySlug = orgDetails?.slug || invitation?.organizationSlug || "";
	const displayMemberCount = orgDetails?.memberCount !== undefined ? orgDetails.memberCount : (invitation?.organizationMemberCount || 0);
	const displayVisibility = orgDetails?.visibility || invitation?.organizationVisibility || "private";
	const displayType = orgDetails?.organizationType || invitation?.organizationType || "Organization";
	const displayDescription = orgDetails?.description || invitation?.organizationDescription || "You will gain standard workspace access, allowing you to view and solve internal problem sets, join contests, and coordinate announcements.";

	return (
		<main className="bg-dark-layer-2 min-h-screen pb-16 font-sans text-white">
			<Topbar />

			<div className="max-w-[550px] mx-auto px-6 mt-20">
				{loading ? (
					<div className="bg-dark-surface border border-gray-850 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 min-h-[300px] animate-pulse">
						<div className="w-20 h-20 rounded-2xl bg-dark-layer-1"></div>
						<div className="h-6 w-48 bg-dark-layer-1 rounded"></div>
						<div className="h-4 w-32 bg-dark-layer-1 rounded"></div>
						<div className="h-10 w-full bg-dark-layer-1 rounded mt-6"></div>
					</div>
				) : error ? (
					<div className="bg-dark-surface border border-red-900/30 rounded-2xl p-8 text-center shadow-lg">
						<div className="w-16 h-16 rounded-full bg-red-950/40 flex items-center justify-center mx-auto mb-4 border border-red-900/50">
							<FaTimes className="text-red-400" size={24} />
						</div>
						<h3 className="text-base font-bold text-gray-200">Unable to load invitation</h3>
						<p className="text-xs text-gray-500 mt-2 max-w-sm mx-auto leading-relaxed">{error}</p>
						<button
							onClick={() => router.push("/orgs")}
							className="mt-6 bg-dark-layer-1 hover:bg-dark-fill-3 border border-gray-850 text-gray-300 px-5 py-2.5 rounded-xl text-xs font-semibold transition"
						>
							Back to Organizations
						</button>
					</div>
				) : (
					<div className="bg-dark-surface border border-gray-850 rounded-2xl overflow-hidden shadow-2xl animate-scale-up">
						{/* Banner preview or orange glow header */}
						<div className="h-24 bg-gradient-to-r from-brand-orange/20 via-amber-500/10 to-brand-orange/20 relative border-b border-gray-850/50">
							<div className="absolute inset-0 bg-black/40" />
						</div>

						<div className="p-8 -mt-12 relative flex flex-col items-center text-center">
							{/* Logo */}
							<div className="w-24 h-24 rounded-2xl border-4 border-dark-surface bg-dark-layer-1 overflow-hidden shadow-xl mb-4 shrink-0 flex items-center justify-center">
								{displayLogo ? (
									<img
										src={displayLogo}
										alt={displayNameStr}
										className="w-full h-full object-cover"
									/>
								) : (
									<span className="text-3xl font-extrabold text-brand-orange">
										{(displayNameStr || "W").substring(0, 1).toUpperCase()}
									</span>
								)}
							</div>

							{/* Title & Badge */}
							<span className="text-[10px] text-brand-orange uppercase font-extrabold tracking-widest bg-brand-orange/10 px-2.5 py-1 rounded-full mb-3 border border-brand-orange/20">
								Workspace Invitation
							</span>

							<h2 className="text-2xl font-black text-white leading-tight">
								Join {displayNameStr}
							</h2>
							{displaySlug && <p className="text-[11px] text-gray-500 font-mono mt-1">@{displaySlug}</p>}

							{/* Type & Visibility Badges */}
							<div className="flex flex-wrap gap-2 items-center justify-center mt-2.5">
								{displayType && (
									<span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-dark-fill-3 border border-gray-850 text-gray-400">
										Type: {displayType}
									</span>
								)}
								<span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
									displayVisibility === "public"
										? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
										: displayVisibility === "private"
										? "bg-amber-500/10 text-amber-400 border-amber-500/20"
										: "bg-red-500/10 text-red-400 border-red-500/20"
								}`}>
									{displayVisibility}
								</span>
							</div>

							{/* Stats Card */}
							<div className="flex gap-4 items-center justify-center mt-5 mb-6 text-xs text-gray-400 font-semibold bg-dark-layer-1/50 border border-gray-850/60 rounded-xl px-4 py-2">
								<span className="flex items-center gap-1.5">
									<FaUsers className="text-brand-orange" size={12} />
									{displayMemberCount} members
								</span>
								<span className="w-1.5 h-1.5 rounded-full bg-gray-850" />
								<span className="flex items-center gap-1.5">
									<FaCrown className="text-yellow-500" size={12} />
									Invited By: @{invitation?.inviterName || "Admin"}
								</span>
							</div>

							{/* Role being offered info box */}
							<div className="w-full bg-dark-layer-2 border border-gray-850 rounded-xl p-4 text-left mb-6">
								<span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">Role Offered</span>
								<div className="flex items-center gap-2">
									<FaShieldAlt className="text-brand-orange" size={14} />
									<span className="text-xs font-bold text-white uppercase tracking-wider">
										{invitation?.roleId || "Member"}
									</span>
								</div>
								<p className="text-xs text-gray-400 mt-2 leading-relaxed">
									{displayDescription}
								</p>
							</div>

							{successMsg && <p className="text-xs text-green-400 font-semibold mb-4 animate-pulse">{successMsg}</p>}
							{error && <p className="text-xs text-red-500 font-semibold mb-4">{error}</p>}

							{/* Action buttons */}
							<div className="w-full flex flex-col gap-3">
								<div className="grid grid-cols-2 gap-3">
									<button
										onClick={() => handleRespond("decline")}
										disabled={responding}
										className="bg-dark-layer-1 hover:bg-dark-fill-3 border border-gray-800 text-gray-300 font-bold text-xs px-6 py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
									>
										<FaTimes size={10} /> Decline
									</button>
									<button
										onClick={() => handleRespond("accept")}
										disabled={responding}
										className="bg-brand-orange hover:bg-brand-orange-s text-bg-base font-black text-xs px-6 py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-glow-sm disabled:opacity-50 active:scale-95"
										style={{ color: "var(--bg-base)" }}
									>
										<FaCheck size={10} /> Accept & Join
									</button>
								</div>
								<button
									onClick={() => router.push("/orgs?tab=my-organizations")}
									disabled={responding}
									className="text-xs text-gray-500 hover:text-gray-300 font-semibold transition py-1.5"
								>
									Maybe Later
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</main>
	);
}
