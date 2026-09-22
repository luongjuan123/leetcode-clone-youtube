import React, { useEffect, useState } from "react";
import Topbar from "@/components/Topbar/Topbar";
import { auth } from "@/firebase/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import Link from "next/link";
import OrganizationAvatar from "@/components/Organizations/OrganizationAvatar";
import {
	FaGlobe,
	FaLock,
	FaSearch,
	FaPlus,
	FaUsers,
	FaTrophy,
	FaQuestionCircle,
	FaCheckCircle,
	FaSchool,
	FaBriefcase,
	FaFolderOpen,
	FaMapMarkerAlt,
	FaLink,
	FaShieldAlt,
	FaUndoAlt,
	FaStar,
	FaRegStar,
	FaEyeSlash,
	FaEye,
	FaTimes,
	FaCheck,
	FaEnvelopeOpenText,
	FaArrowRight,
	FaRegClock,
} from "react-icons/fa";
import { useRouter } from "next/router";
import BeastCodeSelect from "@/components/UI/BeastCodeSelect";

interface OrgItem {
	slug: string;
	name: string;
	type: string;
	visibility: string;
	description: string;
	avatar?: string;
	avatarUrl: string;
	avatarStoragePath?: string;
	avatarUpdatedAt?: number;
	bannerUrl: string;
	memberCount: number;
	contestCount: number;
	problemCount: number;
	verified: boolean;
	category: string;
	country: string;
	website: string;
	isMember: boolean;
}

export default function OrgsIndexPage() {
	const [user, loadingAuth] = useAuthState(auth);
	const router = useRouter();

	const [activeViewTab, setActiveViewTab] = useState<"explore" | "my-orgs">("explore");

	const [orgs, setOrgs] = useState<OrgItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [typeFilter, setTypeFilter] = useState("");

	// Modal State
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [newOrgName, setNewOrgName] = useState("");
	const [newOrgType, setNewOrgType] = useState("coding_club");
	const [newOrgVisibility, setNewOrgVisibility] = useState("public");
	const [newOrgDesc, setNewOrgDesc] = useState("");
	const [newOrgWebsite, setNewOrgWebsite] = useState("");
	const [newOrgLocation, setNewOrgLocation] = useState("");
	const [newOrgCountry, setNewOrgCountry] = useState("Vietnam");
	const [newOrgCategory, setNewOrgCategory] = useState("Technology");
	const [newOrgEmail, setNewOrgEmail] = useState("");
	
	const [createLoading, setCreateLoading] = useState(false);
	const [errorMsg, setErrorMsg] = useState("");
	const [successMsg, setSuccessMsg] = useState("");

	// Your Organizations State
	const [memberships, setMemberships] = useState<{
		owned: any[];
		administered: any[];
		member: any[];
		favorites: any[];
		archived: any[];
		invited: any[];
		pendingRequests: any[];
	}>({
		owned: [],
		administered: [],
		member: [],
		favorites: [],
		archived: [],
		invited: [],
		pendingRequests: [],
	});
	const [loadingMyOrgs, setLoadingMyOrgs] = useState(false);
	const [actionPending, setActionPending] = useState<string | null>(null);

	const fetchOrgs = async () => {
		setLoading(true);
		try {
			let url = "/api/organizations";
			const params = new URLSearchParams();
			if (search) params.append("q", search);
			if (typeFilter) params.append("type", typeFilter);
			
			if (params.toString()) {
				url += `?${params.toString()}`;
			}

			let headers: any = {};
			if (user) {
				const idToken = await user.getIdToken();
				headers["Authorization"] = `Bearer ${idToken}`;
			}

			const res = await fetch(url, { headers });
			const data = await res.json();
			if (data.success) {
				setOrgs(data.organizations || []);
			}
		} catch (err) {
			console.error("Error fetching organizations:", err);
		} finally {
			setLoading(false);
		}
	};

	const fetchMemberships = async () => {
		if (!user) return;
		setLoadingMyOrgs(true);
		try {
			const idToken = await user.getIdToken();
			const res = await fetch("/api/users/memberships", {
				headers: { Authorization: `Bearer ${idToken}` },
			});
			const data = await res.json();
			if (data.success) {
				setMemberships({
					owned: data.owned || [],
					administered: data.administered || [],
					member: data.member || [],
					favorites: data.favorites || [],
					archived: data.archived || [],
					invited: data.invited || [],
					pendingRequests: data.pendingRequests || [],
				});
			}
		} catch (err) {
			console.error("Error fetching user memberships:", err);
		} finally {
			setLoadingMyOrgs(false);
		}
	};

	useEffect(() => {
		fetchOrgs();
	}, [user, typeFilter]);

	useEffect(() => {
		if (activeViewTab === "my-orgs" && user) {
			fetchMemberships();
		}
	}, [user, activeViewTab]);

	useEffect(() => {
		const handleOrgJoined = () => {
			fetchMemberships();
			fetchOrgs();
		};
		window.addEventListener("org-joined", handleOrgJoined);
		return () => {
			window.removeEventListener("org-joined", handleOrgJoined);
		};
	}, [user]);

	useEffect(() => {
		if (router.query.tab === "my-organizations") {
			setActiveViewTab("my-orgs");
		}
	}, [router.query.tab]);

	const handleSearchSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		fetchOrgs();
	};

	// Actions for workspace preferences
	const handleToggleFavorite = async (orgId: string, isFav: boolean) => {
		if (!user) return;
		setActionPending(orgId);
		try {
			const idToken = await user.getIdToken();
			const res = await fetch(`/api/organizations/${orgId}/preference`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${idToken}`,
				},
				body: JSON.stringify({ isFavorite: isFav }),
			});
			const data = await res.json();
			if (data.success) {
				fetchMemberships();
			}
		} catch (err) {
			console.error("Failed to toggle favorite:", err);
		} finally {
			setActionPending(null);
		}
	};

	const handleToggleHidden = async (orgId: string, isHide: boolean) => {
		if (!user) return;
		setActionPending(orgId);
		try {
			const idToken = await user.getIdToken();
			const res = await fetch(`/api/organizations/${orgId}/preference`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${idToken}`,
				},
				body: JSON.stringify({ isHidden: isHide }),
			});
			const data = await res.json();
			if (data.success) {
				fetchMemberships();
			}
		} catch (err) {
			console.error("Failed to toggle hidden:", err);
		} finally {
			setActionPending(null);
		}
	};

	const handleCancelJoinRequest = async (orgId: string) => {
		if (!user) return;
		setActionPending(orgId);
		try {
			const idToken = await user.getIdToken();
			const res = await fetch(`/api/organizations/${orgId}/join`, {
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${idToken}`,
				},
			});
			const data = await res.json();
			if (data.success) {
				fetchMemberships();
			}
		} catch (err) {
			console.error("Failed to cancel join request:", err);
		} finally {
			setActionPending(null);
		}
	};

	const handleInviteRespond = async (inviteId: string, action: "accept" | "decline") => {
		if (!user) return;
		setActionPending(inviteId);
		try {
			const idToken = await user.getIdToken();
			const res = await fetch(`/api/users/invitations/${inviteId}/respond`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${idToken}`,
				},
				body: JSON.stringify({ action }),
			});
			const data = await res.json();
			if (data.success) {
				fetchMemberships();
			}
		} catch (err) {
			console.error("Failed to respond to invitation:", err);
		} finally {
			setActionPending(null);
		}
	};

	const handleCreateOrg = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user) return;

		setCreateLoading(true);
		setErrorMsg("");
		setSuccessMsg("");

		try {
			const slug = newOrgName
				.toLowerCase()
				.replace(/[^a-z0-9\s-]/g, "")
				.trim()
				.replace(/\s+/g, "-")
				.replace(/-+/g, "-");

			const displayName = newOrgName;

			const idToken = await user.getIdToken();
			const res = await fetch("/api/organizations", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${idToken}`,
				},
				body: JSON.stringify({
					slug,
					name: newOrgName,
					displayName,
					organizationType: newOrgType,
					type: newOrgType,
					visibility: newOrgVisibility,
					description: newOrgDesc,
					website: newOrgWebsite,
					location: newOrgLocation,
					country: newOrgCountry,
					category: newOrgCategory,
					email: newOrgEmail,
					contactEmail: newOrgEmail,
				}),
			});

			const data = await res.json();
			if (data.success) {
				setSuccessMsg("Organization created successfully! Redirecting...");
				setTimeout(() => {
					setShowCreateModal(false);
					router.push(`/orgs/${data.organization.slug}`);
				}, 1500);
			} else {
				const errorVal = data.error;
				const errMsg = typeof errorVal === "object" && errorVal !== null
					? (errorVal.message || errorVal.error || JSON.stringify(errorVal))
					: (errorVal || "Failed to create organization.");
				setErrorMsg(errMsg);
			}
		} catch (err: any) {
			setErrorMsg(err.message || "An error occurred.");
		} finally {
			setCreateLoading(false);
		}
	};

	return (
		<main className="min-h-screen pb-16 font-sans text-text-primary hero-gradient" style={{ background: "var(--bg-base)" }}>
			<Topbar />

			<div className="max-w-[1240px] mx-auto px-6 pt-10 animate-fade-in">
				{/* Top Header Card */}
				<div className="relative rounded-2xl border border-border-default bg-dark-layer-1 p-8 mb-8 shadow-xl glassmorphic overflow-hidden">
					<div className="absolute top-0 right-0 w-96 h-96 bg-brand-orange/10 rounded-full filter blur-3xl pointer-events-none animate-pulse-slow"></div>
					<div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
						<div>
							<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-brand-orange/10 text-brand-orange border border-brand-orange/20 mb-3">
								<span className="w-2 h-2 rounded-full bg-brand-orange animate-pulse" />
								Enterprise & Academic Workspaces
							</div>
							<h1 className="text-3xl md:text-4xl font-black tracking-tight text-text-primary glow-text">
								Coding Organizations
							</h1>
							<p className="text-sm text-text-secondary mt-2 max-w-xl leading-relaxed">
								Build collaborative portals for universities, tech clubs, bootcamps, and engineering teams. Host custom contests, assign problem sets, and track leaderboard analytics.
							</p>
						</div>
						<div className="flex flex-wrap items-center gap-4">
							<div className="stat-card flex flex-col items-center justify-center min-w-[110px] text-center">
								<span className="text-xl font-black text-brand-orange">{orgs.length}</span>
								<span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Workspaces</span>
							</div>
							{user && (
								<button
									onClick={() => {
										setNewOrgName("");
										setNewOrgDesc("");
										setNewOrgWebsite("");
										setNewOrgLocation("");
										setNewOrgEmail("");
										setNewOrgVisibility("public");
										setErrorMsg("");
										setSuccessMsg("");
										setShowCreateModal(true);
									}}
									className="px-6 py-3 rounded-xl font-bold text-sm bg-brand-orange hover:bg-brand-orange-s text-bg-base transition duration-200 shadow-md flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95"
									style={{ color: "var(--bg-base)" }}
								>
									<FaPlus size={12} /> Create Organization
								</button>
							)}
						</div>
					</div>
				</div>

				{/* Primary Navigation Switcher */}
				<div className="flex border-b border-gray-850 mb-8 gap-6">
					<button
						onClick={() => {
							setActiveViewTab("explore");
							router.push("/orgs", undefined, { shallow: true });
						}}
						className={`pb-4 text-sm font-bold transition-all relative ${
							activeViewTab === "explore"
								? "text-brand-orange"
								: "text-gray-400 hover:text-white"
						}`}
					>
						Explore Directory
						{activeViewTab === "explore" && (
							<span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-orange rounded-full" />
						)}
					</button>
					{user && (
						<button
							onClick={() => {
								setActiveViewTab("my-orgs");
								router.push("/orgs?tab=my-organizations", undefined, { shallow: true });
							}}
							className={`pb-4 text-sm font-bold transition-all relative ${
								activeViewTab === "my-orgs"
									? "text-brand-orange"
									: "text-gray-400 hover:text-white"
							}`}
						>
							Your Organizations
							{activeViewTab === "my-orgs" && (
								<span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-orange rounded-full" />
							)}
						</button>
					)}
				</div>

				{activeViewTab === "explore" ? (
					<>
						{/* Toolbar / Search panel */}
						<div className="bg-dark-surface border border-gray-850 rounded-2xl p-5 mb-8 shadow-sm">
							<form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-4 items-center">
								<div className="relative flex-1 w-full">
									<span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-500 pointer-events-none">
										<FaSearch size={13} />
									</span>
									<input
										type="text"
										placeholder="Search organizations by title, slug, or keywords..."
										value={search}
										onChange={(e) => setSearch(e.target.value)}
										className="w-full bg-dark-layer-2 border border-gray-850 focus:border-brand-orange text-xs rounded-xl pl-10 pr-4 py-3 text-white outline-none transition"
									/>
								</div>

								<div className="flex gap-3 w-full md:w-auto">
									<BeastCodeSelect
										options={[
											{ value: "", label: "All Organization Types" },
											{ value: "university", label: "University / College" },
											{ value: "company", label: "Company / Enterprise" },
											{ value: "coding_club", label: "Coding Club" },
											{ value: "research_lab", label: "Research Lab" },
											{ value: "community", label: "Public Community" },
											{ value: "private_team", label: "Private Team" }
										]}
										value={typeFilter}
										onChange={(val) => setTypeFilter(val)}
										size="sm"
										className="flex-1 md:w-56"
									/>

									<button
										type="submit"
										className="bg-dark-fill-3 hover:bg-dark-fill-2 text-white border border-gray-800 text-xs font-bold px-5 py-3 rounded-xl transition cursor-pointer"
									>
										Filter
									</button>
								</div>
							</form>
						</div>

						{/* Directories List */}
						{loading ? (
							<div className="flex flex-col justify-center items-center py-24 gap-4">
								<div className="w-10 h-10 border-4 border-brand-orange border-t-transparent rounded-full animate-spin"></div>
								<div className="text-xs text-gray-400 font-semibold tracking-wider uppercase animate-pulse">Loading workspaces...</div>
							</div>
						) : orgs.length === 0 ? (
							<div className="text-center py-20 bg-dark-surface border border-gray-850 rounded-2xl p-8">
								<div className="w-16 h-16 rounded-full bg-dark-layer-2 flex items-center justify-center mx-auto mb-4 border border-gray-800">
									<FaFolderOpen size={24} className="text-gray-500" />
								</div>
								<h3 className="text-base font-bold text-gray-300">No workspaces found</h3>
								<p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
									We couldn&apos;t find any organizations matching your search filters. Try clearing your filters or create a new organization.
								</p>
								<button
									onClick={() => {
										setSearch("");
										setTypeFilter("");
									}}
									className="mt-5 bg-dark-layer-1 hover:bg-dark-fill-3 border border-gray-850 text-gray-300 px-4 py-2 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5 cursor-pointer"
								>
									<FaUndoAlt size={10} /> Reset Filters
								</button>
							</div>
						) : (
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
								{orgs.map((org) => (
									<div
										key={org.slug}
										className="relative bg-dark-layer-1 border border-border-default rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between hover:border-brand-orange/50 hover:shadow-glow-sm transition-all duration-300 group cursor-pointer glass-card"
									>
										<Link
											href={`/orgs/${org.slug}`}
											className="absolute inset-0 z-10"
											aria-label={`View ${org.name}`}
										/>
										<div className="relative z-0 flex flex-col justify-between h-full">
											<div>
												{/* Banner */}
												<div
													className="h-24 bg-cover bg-center relative"
													style={{
														backgroundImage: org.bannerUrl
															? `url(${org.bannerUrl})`
															: `linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(15, 23, 42, 0.9) 100%)`,
													}}
												>
													<div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
													<div className="absolute top-2.5 right-3 z-10">
														<span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/60 text-brand-orange border border-brand-orange/30 backdrop-blur-md">
															{(org.type || "coding_club").replace("_", " ")}
														</span>
													</div>
												</div>

												{/* Avatar placement */}
												<div className="px-5 pb-2 -mt-8 flex items-end gap-3 relative z-10">
													<OrganizationAvatar
														organization={org}
														size="lg"
														className="border-2 border-border-default shadow-xl"
													/>
													<div className="mb-0.5 flex-1 min-w-0">
														<div className="flex items-center gap-1.5">
															<h3 className="text-base font-extrabold text-text-primary truncate group-hover:text-brand-orange transition glow-text">
																{org.name}
															</h3>
															{org.verified && (
																<FaCheckCircle className="text-brand-orange shrink-0" size={13} title="Verified workspace" />
															)}
														</div>
														<span className="text-[11px] text-text-muted font-mono">@{org.slug}</span>
													</div>
												</div>

												{/* Body Description */}
												<div className="px-5 pt-3">
													<p className="text-xs text-text-secondary line-clamp-2 min-h-[36px] leading-relaxed">
														{org.description || "Welcome! No description uploaded yet for this organization workspace."}
													</p>
												</div>

												{/* Statistics Row */}
												<div className="px-5 py-3.5 flex items-center justify-between text-xs font-semibold text-text-muted border-t border-border-subtle mt-4 bg-dark-fill-2/40">
													<span className="flex items-center gap-1.5">
														<FaUsers size={12} className="text-brand-orange" />
														{org.memberCount} members
													</span>
													<span className="flex items-center gap-1.5">
														<FaTrophy size={12} className="text-amber-400" />
														{org.contestCount} contests
													</span>
												</div>
											</div>

											{/* Actions card footer */}
											<div className="px-5 py-3.5 bg-dark-layer-1/50 border-t border-gray-850/50 flex items-center justify-between">
												<span className="text-[9px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded bg-gray-850 text-gray-400 border border-gray-800 flex items-center gap-1">
													{org.visibility === "public" ? <FaGlobe size={8} /> : <FaLock size={8} />}
													{org.visibility}
												</span>
												<span className="text-xs font-bold text-brand-orange group-hover:text-brand-orange-s transition flex items-center gap-1">
													{org.isMember ? "Enter Workspace" : "View Profile"} →
												</span>
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</>
				) : (
					/* Your Organizations View */
					<div className="space-y-12">
						{loadingMyOrgs ? (
							<div className="flex flex-col justify-center items-center py-24 gap-4">
								<div className="w-10 h-10 border-4 border-brand-orange border-t-transparent rounded-full animate-spin"></div>
								<div className="text-xs text-gray-400 font-semibold tracking-wider uppercase animate-pulse">Retrieving your workspaces...</div>
							</div>
						) : (
							<>
								{/* 1. Pending Invitations Section */}
								{memberships.invited.length > 0 && (
									<div className="animate-fade-in bg-gradient-to-r from-brand-orange/5 via-dark-surface to-brand-orange/5 border border-brand-orange/20 rounded-2xl p-6 shadow-md">
										<h2 className="text-base font-extrabold text-white flex items-center gap-2 mb-4">
											<FaEnvelopeOpenText className="text-brand-orange" />
											Pending Invitations ({memberships.invited.length})
										</h2>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
											{memberships.invited.map((inv) => (
												<div key={inv.inviteId} className="bg-dark-layer-1/80 border border-gray-800 rounded-xl p-4 flex flex-col justify-between">
													<div className="flex gap-3">
														<OrganizationAvatar
															src={inv.orgLogo}
															name={inv.orgName}
															size={48}
															className="rounded-lg border border-gray-700 shrink-0"
														/>
														<div className="min-w-0 flex-1">
															<h4 className="text-xs font-bold text-white truncate">{inv.orgName}</h4>
															<p className="text-[10px] text-gray-500 font-mono">Role Offered: <span className="text-brand-orange font-bold uppercase">{inv.roleId}</span></p>
															<p className="text-[10px] text-gray-400 mt-1.5 line-clamp-2">{inv.description || "Workspace inviting you to join."}</p>
															<p className="text-[9px] text-gray-500 mt-1 flex items-center gap-1"><FaRegClock /> Invited by {inv.inviterName}</p>
														</div>
													</div>
													<div className="flex justify-end gap-2 mt-4 border-t border-gray-850 pt-3">
														<button
															onClick={() => handleInviteRespond(inv.inviteId, "decline")}
															disabled={actionPending === inv.inviteId}
															className="bg-dark-fill-3 hover:bg-dark-fill-2 text-gray-300 font-bold text-[10px] px-3.5 py-1.5 rounded-lg transition cursor-pointer"
														>
															Decline
														</button>
														<button
															onClick={() => handleInviteRespond(inv.inviteId, "accept")}
															disabled={actionPending === inv.inviteId}
															className="bg-brand-orange hover:bg-brand-orange-s text-bg-base font-bold text-[10px] px-3.5 py-1.5 rounded-lg transition cursor-pointer"
															style={{ color: "var(--bg-base)" }}
														>
															Accept & Join
														</button>
													</div>
												</div>
											))}
										</div>
									</div>
								)}

								{/* 2. Favorites Workspaces */}
								{memberships.favorites.length > 0 && (
									<div>
										<h2 className="text-base font-extrabold text-white flex items-center gap-2 mb-4">
											<FaStar className="text-yellow-500" />
											Favorites ({memberships.favorites.length})
										</h2>
										<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
											{memberships.favorites.map((org) => (
												<MyWorkspaceCard
													key={org.slug}
													org={org}
													onFavorite={handleToggleFavorite}
													onHide={handleToggleHidden}
													actionPending={actionPending}
												/>
											))}
										</div>
									</div>
								)}

								{/* 3. Owned Workspaces */}
								{memberships.owned.length > 0 && (
									<div>
										<h2 className="text-base font-extrabold text-white flex items-center gap-2 mb-4">
											<FaShieldAlt className="text-red-500" />
											Workspaces You Own ({memberships.owned.length})
										</h2>
										<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
											{memberships.owned.map((org) => (
												<MyWorkspaceCard
													key={org.slug}
													org={org}
													onFavorite={handleToggleFavorite}
													onHide={handleToggleHidden}
													actionPending={actionPending}
												/>
											))}
										</div>
									</div>
								)}

								{/* 4. Administered Workspaces */}
								{memberships.administered.length > 0 && (
									<div>
										<h2 className="text-base font-extrabold text-white flex items-center gap-2 mb-4">
											<FaShieldAlt className="text-yellow-500" />
											Workspaces You Administer ({memberships.administered.length})
										</h2>
										<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
											{memberships.administered.map((org) => (
												<MyWorkspaceCard
													key={org.slug}
													org={org}
													onFavorite={handleToggleFavorite}
													onHide={handleToggleHidden}
													actionPending={actionPending}
												/>
											))}
										</div>
									</div>
								)}

								{/* 5. Shared Memberships */}
								{memberships.member.length > 0 && (
									<div>
										<h2 className="text-base font-extrabold text-white flex items-center gap-2 mb-4">
											<FaUsers className="text-brand-orange" />
											Workspaces You Belong To ({memberships.member.length})
										</h2>
										<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
											{memberships.member.map((org) => (
												<MyWorkspaceCard
													key={org.slug}
													org={org}
													onFavorite={handleToggleFavorite}
													onHide={handleToggleHidden}
													actionPending={actionPending}
												/>
											))}
										</div>
									</div>
								)}

								{/* 6. Pending Join Requests Sent */}
								{memberships.pendingRequests.length > 0 && (
									<div className="bg-dark-surface border border-gray-850 rounded-2xl p-6">
										<h2 className="text-sm font-extrabold text-white flex items-center gap-2 mb-4">
											<FaRegClock className="text-gray-400" />
											Join Requests Sent ({memberships.pendingRequests.length})
										</h2>
										<div className="space-y-3">
											{memberships.pendingRequests.map((reqItem) => (
												<div key={reqItem.requestId} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-dark-layer-1/50 border border-gray-850 p-4 rounded-xl">
													<div className="flex gap-3">
														<OrganizationAvatar
															src={reqItem.orgLogo}
															name={reqItem.orgName}
															size={40}
															className="rounded-lg border border-gray-800 shrink-0"
														/>
														<div>
															<h4 className="text-xs font-bold text-white">{reqItem.orgName}</h4>
															<p className="text-[10px] text-gray-500 mt-1">Submitted: {new Date(reqItem.submittedAt).toLocaleDateString()}</p>
															{reqItem.message && <p className="text-[10px] text-gray-400 mt-1 italic">&quot;{reqItem.message}&quot;</p>}
														</div>
													</div>
													<div className="flex items-center gap-3 w-full sm:w-auto justify-between border-t sm:border-t-0 border-gray-850 pt-2 sm:pt-0 shrink-0">
														<span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
															Pending Review
														</span>
														<button
															onClick={() => handleCancelJoinRequest(reqItem.organizationId)}
															disabled={actionPending === reqItem.organizationId}
															className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold text-[10px] px-3 py-1.5 rounded-lg transition cursor-pointer"
														>
															Cancel Request
														</button>
													</div>
												</div>
											))}
										</div>
									</div>
								)}

								{/* 7. Archived / Hidden Workspaces */}
								{memberships.archived.length > 0 && (
									<div className="bg-dark-surface/50 border border-gray-850/50 rounded-2xl p-6">
										<h2 className="text-xs font-bold text-gray-400 flex items-center gap-2 mb-4">
											<FaEyeSlash size={12} />
											Hidden / Archived Workspaces ({memberships.archived.length})
										</h2>
										<div className="space-y-3">
											{memberships.archived.map((org) => (
												<div key={org.slug} className="flex justify-between items-center bg-dark-layer-1/30 p-3.5 rounded-xl border border-gray-850/40">
													<div className="flex items-center gap-3">
														<FaFolderOpen className="text-gray-600" size={16} />
														<div>
															<h4 className="text-xs font-semibold text-gray-400">{org.displayName || org.name}</h4>
															<span className="text-[9px] text-gray-600">@{org.slug}</span>
														</div>
													</div>
													<button
														onClick={() => handleToggleHidden(org.id, false)}
														disabled={actionPending === org.id}
														className="text-gray-400 hover:text-white border border-gray-800 text-[10px] px-3 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
													>
														<FaEye size={10} /> Restore
													</button>
												</div>
											))}
										</div>
									</div>
								)}

								{/* Empty State */}
								{memberships.owned.length === 0 &&
									memberships.administered.length === 0 &&
									memberships.member.length === 0 &&
									memberships.favorites.length === 0 &&
									memberships.invited.length === 0 &&
									memberships.pendingRequests.length === 0 && (
										<div className="text-center py-20 bg-dark-surface border border-gray-850 rounded-2xl p-8">
											<div className="w-16 h-16 rounded-full bg-dark-layer-2 flex items-center justify-center mx-auto mb-4 border border-gray-800">
												<FaFolderOpen size={24} className="text-gray-500" />
											</div>
											<h3 className="text-base font-bold text-gray-300">No active workspaces</h3>
											<p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
												You do not belong to any organizations yet. Find an organization in the directory or create your own.
											</p>
											<button
												onClick={() => setActiveViewTab("explore")}
												className="mt-5 bg-brand-orange hover:bg-brand-orange-s text-bg-base px-5 py-2 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer"
												style={{ color: "var(--bg-base)" }}
											>
												Explore Directory <FaArrowRight size={10} />
											</button>
										</div>
									)}
							</>
						)}
					</div>
				)}
			</div>

			{/* Create Organization Modal */}
			{showCreateModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
					<div className="bg-dark-layer-1 border border-gray-850 rounded-2xl w-full max-w-lg mx-4 overflow-hidden shadow-2xl animate-scale-up">
						<div className="bg-dark-surface px-6 py-4 border-b border-gray-850 flex justify-between items-center">
							<h3 className="text-sm font-bold text-white">Create New Workspace</h3>
							<button
								onClick={() => setShowCreateModal(false)}
								className="text-gray-500 hover:text-white transition text-lg p-1"
							>
								&times;
							</button>
						</div>

						<form onSubmit={handleCreateOrg} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
							<div>
								<label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
									Organization Name <span className="text-red-500">*</span>
								</label>
								<input
									type="text"
									placeholder="e.g. Stanford Coding Club"
									value={newOrgName}
									onChange={(e) => setNewOrgName(e.target.value)}
									className="w-full bg-dark-layer-2 border border-gray-850 focus:border-brand-orange text-xs rounded-xl p-3 text-white outline-none transition"
									required
								/>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
										Workspace Type <span className="text-red-500">*</span>
									</label>
									<BeastCodeSelect
										options={[
											{ value: "university", label: "University" },
											{ value: "company", label: "Company" },
											{ value: "coding_club", label: "Coding Club" },
											{ value: "research_lab", label: "Research Lab" },
											{ value: "community", label: "Public Community" },
											{ value: "private_team", label: "Private Team" }
										]}
										value={newOrgType}
										onChange={(val) => setNewOrgType(val)}
										size="sm"
									/>
								</div>
								<div>
									<label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
										Visibility <span className="text-red-500">*</span>
									</label>
									<BeastCodeSelect
										options={[
											{ value: "public", label: "PUBLIC (Visible, searchable, join request allowed)" },
											{ value: "private", label: "PRIVATE (Visible, searchable, requires approval to join)" },
											{ value: "secret", label: "SECRET (Undiscoverable, invite-only, no search)" }
										]}
										value={newOrgVisibility}
										onChange={(val) => setNewOrgVisibility(val)}
										size="sm"
									/>
								</div>
							</div>

							{/* Visibility Explanations directly inside UI */}
							<div className="bg-dark-layer-2 border border-gray-850 rounded-xl p-3 space-y-2.5">
								<div className="text-[10px] leading-relaxed">
									<strong className="text-white uppercase font-extrabold tracking-wider block mb-0.5">PUBLIC</strong>
									<span className="text-gray-400">Visible in directory. Searchable. Anyone can request to join immediately.</span>
								</div>
								<div className="text-[10px] leading-relaxed border-t border-gray-850/60 pt-2.5">
									<strong className="text-brand-orange uppercase font-extrabold tracking-wider block mb-0.5">PRIVATE</strong>
									<span className="text-gray-400">Visible in directory and search results. Profile is visible, but content is hidden. Requires an administrator to approve join requests.</span>
								</div>
								<div className="text-[10px] leading-relaxed border-t border-gray-850/60 pt-2.5">
									<strong className="text-red-400 uppercase font-extrabold tracking-wider block mb-0.5">SECRET</strong>
									<span className="text-gray-400">Completely hidden from search and directory lists. No discoverability. Only accessible via a direct invitation token or link.</span>
								</div>
							</div>

							<div>
								<label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
									Short Description
								</label>
								<textarea
									placeholder="Write a brief overview describing the workspace..."
									value={newOrgDesc}
									onChange={(e) => setNewOrgDesc(e.target.value)}
									className="w-full bg-dark-layer-2 border border-gray-850 focus:border-brand-orange text-xs rounded-xl p-3 text-white outline-none transition h-20"
								/>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
										Website URL
									</label>
									<input
										type="text"
										placeholder="e.g. stanford.edu"
										value={newOrgWebsite}
										onChange={(e) => setNewOrgWebsite(e.target.value)}
										className="w-full bg-dark-layer-2 border border-gray-850 focus:border-brand-orange text-xs rounded-xl p-3 text-white outline-none transition"
									/>
								</div>
								<div>
									<label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
										Industry Category
									</label>
									<input
										type="text"
										placeholder="e.g. Education"
										value={newOrgCategory}
										onChange={(e) => setNewOrgCategory(e.target.value)}
										className="w-full bg-dark-layer-2 border border-gray-850 focus:border-brand-orange text-xs rounded-xl p-3 text-white outline-none transition"
									/>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
										Workspace Location
									</label>
									<input
										type="text"
										placeholder="e.g. Stanford, CA"
										value={newOrgLocation}
										onChange={(e) => setNewOrgLocation(e.target.value)}
										className="w-full bg-dark-layer-2 border border-gray-850 focus:border-brand-orange text-xs rounded-xl p-3 text-white outline-none transition"
									/>
								</div>
								<div>
									<label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
										Contact Email
									</label>
									<input
										type="email"
										placeholder="e.g. contact@stanford.edu"
										value={newOrgEmail}
										onChange={(e) => setNewOrgEmail(e.target.value)}
										className="w-full bg-dark-layer-2 border border-gray-850 focus:border-brand-orange text-xs rounded-xl p-3 text-white outline-none transition"
									/>
								</div>
							</div>

							{errorMsg && <p className="text-xs text-red-500 font-semibold">{errorMsg}</p>}
							{successMsg && <p className="text-xs text-green-400 font-semibold">{successMsg}</p>}

							<div className="border-t border-gray-850 pt-4 flex justify-end gap-3">
								<button
									type="button"
									onClick={() => setShowCreateModal(false)}
									className="px-5 py-2.5 bg-dark-fill-3 hover:bg-dark-fill-2 text-gray-300 rounded-xl text-xs font-semibold cursor-pointer transition"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={createLoading}
									className="px-6 py-2.5 bg-brand-orange hover:bg-brand-orange-s text-bg-base rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer transition shadow-glow-sm"
									style={{ color: "var(--bg-base)" }}
								>
									{createLoading ? "Creating..." : "Create Workspace"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</main>
	);
}

const getOrgIcon = (type?: string) => {
	switch (type) {
		case "university":
			return <FaSchool className="text-blue-400" size={20} />;
		case "company":
			return <FaBriefcase className="text-emerald-400" size={20} />;
		default:
			return <FaFolderOpen className="text-brand-orange" size={20} />;
	}
};

// Sub-component for individual card in My Organizations
function MyWorkspaceCard({
	org,
	onFavorite,
	onHide,
	actionPending,
}: {
	org: any;
	onFavorite: (orgId: string, isFav: boolean) => void;
	onHide: (orgId: string, isHide: boolean) => void;
	actionPending: string | null;
}) {
	return (
		<div className="relative bg-dark-surface border border-gray-850 rounded-2xl overflow-hidden shadow-md flex flex-col justify-between hover:border-brand-orange/40 hover:scale-[1.015] hover:shadow-[0_0_15px_rgba(249,115,22,0.15)] transition-all duration-300 group cursor-pointer">
			<Link
				href={`/orgs/${org.slug}`}
				className="absolute inset-0 z-10"
				aria-label={`Enter ${org.displayName || org.name}`}
			/>
			<div className="relative z-0 flex flex-col justify-between h-full w-full">
				<div>
					{/* Banner */}
					<div
						className="h-20 bg-cover bg-center relative"
						style={{
							backgroundImage: org.banner
								? `url(${org.banner})`
								: `linear-gradient(135deg, #131316 0%, #ff8c0010 100%)`,
						}}
					>
						<div className="absolute inset-0 bg-black/40" />

						{/* Top preference buttons (Star / Unstar / Hide) */}
						<div className="absolute top-2 right-2 flex gap-1.5 z-20">
							<button
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									onFavorite(org.id, !org.isFavorite);
								}}
								disabled={actionPending === org.id}
								className="w-7 h-7 rounded-lg bg-black/50 hover:bg-black/80 text-yellow-500 border border-gray-800/40 flex items-center justify-center transition cursor-pointer"
								title={org.isFavorite ? "Unstar workspace" : "Star workspace"}
							>
								{org.isFavorite ? <FaStar size={12} /> : <FaRegStar size={12} className="text-gray-400" />}
							</button>
							<button
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									onHide(org.id, true);
								}}
								disabled={actionPending === org.id}
								className="w-7 h-7 rounded-lg bg-black/50 hover:bg-black/80 text-gray-400 hover:text-white border border-gray-800/40 flex items-center justify-center transition cursor-pointer"
								title="Hide workspace"
							>
								<FaEyeSlash size={12} />
							</button>
						</div>
					</div>

					{/* Avatar & Title */}
					<div className="px-5 pb-2 -mt-7 flex items-end gap-3 relative z-10">
						<OrganizationAvatar
							organization={org}
							size={56}
							className="rounded-xl border-2 border-dark-surface shadow-lg shrink-0"
						/>
						<div className="mb-0.5 flex-1 min-w-0">
							<h3 className="text-sm font-bold text-white truncate group-hover:text-brand-orange transition">
								{org.displayName || org.name}
							</h3>
							<span className="text-[10px] text-gray-500 font-mono">@{org.slug}</span>
						</div>
					</div>

					{/* Description */}
					<div className="px-5 pt-3">
						<p className="text-xs text-gray-400 line-clamp-2 min-h-[32px] leading-relaxed">
							{org.description || "Welcome! No description uploaded yet."}
						</p>
					</div>

					{/* Stats Row */}
					<div className="px-5 py-3 flex gap-4 text-xs font-semibold text-gray-500 border-t border-gray-850/40 mt-3">
						<span className="flex items-center gap-1">
							<FaUsers size={11} className="text-brand-orange" />
							{org.memberCount || 0} members
						</span>
						{org.contestCount !== undefined && (
							<span className="flex items-center gap-1">
								<FaTrophy size={11} className="text-yellow-500" />
								{org.contestCount} contests
							</span>
						)}
					</div>
				</div>

				{/* Action buttons footer */}
				<div className="px-5 py-3 bg-dark-layer-1/50 border-t border-gray-850/50 flex items-center justify-between">
					<span className="text-[9px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-800/80 flex items-center gap-1">
						<FaShieldAlt size={8} className="text-brand-orange" />
						{org.membershipRole || "Member"}
					</span>
					<span className="text-xs font-bold text-brand-orange group-hover:text-brand-orange-s transition flex items-center gap-1">
						Enter Workspace →
					</span>
				</div>
			</div>
		</div>
	);
}
