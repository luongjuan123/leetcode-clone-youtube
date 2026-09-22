import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Topbar from "@/components/Topbar/Topbar";
import { auth } from "@/firebase/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { FaCheck, FaTimes, FaUsers, FaLock, FaGlobe } from "react-icons/fa";

export default function InviteLinkPage() {
	const router = useRouter();
	const { linkId } = router.query;
	const [user, loadingAuth] = useAuthState(auth);

	const [inviteLink, setInviteLink] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [joining, setJoining] = useState(false);
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [successMsg, setSuccessMsg] = useState("");

	useEffect(() => {
		if (!linkId || loadingAuth) return;

		const fetchLinkDetails = async () => {
			setLoading(true);
			setError("");
			try {
				const idToken = await user?.getIdToken();
				const headers: any = {};
				if (idToken) {
					headers["Authorization"] = `Bearer ${idToken}`;
				}

				const res = await fetch(`/api/invite-links/${linkId}`, { headers });
				const data = await res.json();

				if (data.success) {
					setInviteLink(data.inviteLink);
				} else {
					setError(data.error || "Failed to load invite link details.");
				}
			} catch (err) {
				console.error("Error loading invite link details:", err);
				setError("An error occurred while fetching invite details.");
			} finally {
				setLoading(false);
			}
		};

		fetchLinkDetails();
	}, [linkId, user, loadingAuth]);

	const handleJoin = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user || !inviteLink) return;
		setJoining(true);
		setError("");
		setSuccessMsg("");

		try {
			const idToken = await user.getIdToken();
			const res = await fetch(`/api/invite-links/${linkId}/join`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${idToken}`,
				},
				body: JSON.stringify({ password }),
			});

			const data = await res.json();
			if (data.success) {
				setSuccessMsg("Successfully joined! Redirecting to workspace...");
				setTimeout(() => {
					router.push(`/orgs/${data.slug}`);
				}, 1500);
			} else {
				setError(data.error || "Failed to join workspace.");
			}
		} catch (err: any) {
			setError(err.message || "An error occurred.");
		} finally {
			setJoining(false);
		}
	};

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
						<h3 className="text-base font-bold text-gray-200">Invalid Invite Link</h3>
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
								{inviteLink.organizationLogo ? (
									<img
										src={inviteLink.organizationLogo}
										alt={inviteLink.organizationName}
										className="w-full h-full object-cover"
									/>
								) : (
									<span className="text-3xl font-extrabold text-brand-orange">
										{inviteLink.organizationName.substring(0, 1).toUpperCase()}
									</span>
								)}
							</div>

							{/* Title & Badge */}
							<span className="text-[10px] text-brand-orange uppercase font-extrabold tracking-widest bg-brand-orange/10 px-2.5 py-1 rounded-full mb-3 border border-brand-orange/20">
								Join Workspace
							</span>

							<h2 className="text-2xl font-black text-white leading-tight">
								{inviteLink.organizationName}
							</h2>
							<p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1.5 justify-center">
								<FaUsers size={12} className="text-gray-600" /> {inviteLink.memberCount} members currently active
							</p>

							{/* Role Offered Details */}
							<div className="w-full bg-dark-layer-2 border border-gray-850 rounded-xl p-4 text-left my-6 space-y-2">
								<div className="flex justify-between items-center">
									<span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Offered Role</span>
									<span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border border-brand-orange/25 bg-brand-orange/10 text-brand-orange">
										{inviteLink.roleId}
									</span>
								</div>
								<p className="text-xs text-gray-400 leading-relaxed pt-1">
									You are invited to join this workspace as a {inviteLink.roleId}. You will be able to access private contests, internal problems, and announcements.
								</p>
							</div>

							{/* Form for Joining / Password Input */}
							<form onSubmit={handleJoin} className="w-full space-y-4">
								{inviteLink.passwordRequired && (
									<div className="text-left space-y-1.5">
										<label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
											<FaLock size={9} className="text-red-400" /> Enter Workspace Password
										</label>
										<input
											type="password"
											placeholder="Enter invite password..."
											value={password}
											onChange={(e) => setPassword(e.target.value)}
											className="w-full bg-dark-layer-1 border border-gray-850 focus:border-brand-orange text-xs rounded-xl p-3 text-white outline-none transition"
											required
										/>
									</div>
								)}

								{successMsg && <p className="text-xs text-green-400 font-semibold animate-pulse">{successMsg}</p>}
								{error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

								<div className="grid grid-cols-2 gap-3 pt-2">
									<button
										type="button"
										onClick={() => router.push("/orgs")}
										disabled={joining}
										className="bg-dark-layer-1 hover:bg-dark-fill-3 border border-gray-850 text-gray-300 font-bold text-xs px-6 py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
									>
										<FaTimes size={10} /> Decline
									</button>
									<button
										type="submit"
										disabled={joining}
										className="bg-brand-orange hover:bg-brand-orange-s text-bg-base font-black text-xs px-6 py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-glow-sm disabled:opacity-50 active:scale-95"
										style={{ color: "var(--bg-base)" }}
									>
										<FaCheck size={10} /> Join Workspace
									</button>
								</div>
							</form>
						</div>
					</div>
				)}
			</div>
		</main>
	);
}
