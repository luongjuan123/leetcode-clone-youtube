import React, { useEffect, useState } from "react";
import Topbar from "@/components/Topbar/Topbar";
import { auth } from "@/firebase/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import Link from "next/link";
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
} from "react-icons/fa";
import { useRouter } from "next/router";

interface OrgItem {
	slug: string;
	name: string;
	type: string;
	visibility: string;
	description: string;
	avatarUrl: string;
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

	useEffect(() => {
		fetchOrgs();
	}, [user, typeFilter]);

	const handleSearchSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		fetchOrgs();
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

	const getOrgIcon = (type: string) => {
		switch (type) {
			case "university":
				return <FaSchool className="text-blue-400" size={20} />;
			case "company":
				return <FaBriefcase className="text-emerald-400" size={20} />;
			default:
				return <FaFolderOpen className="text-brand-orange" size={20} />;
		}
	};

	return (
		<main className="bg-dark-layer-2 min-h-screen pb-16 font-sans text-white">
			<Topbar />

			<div className="max-w-[1200px] mx-auto px-6 mt-8 animate-fade-in">
				{/* Top Header Card */}
				<div className="relative rounded-2xl overflow-hidden border border-gray-850 bg-gradient-to-r from-dark-surface via-dark-layer-1 to-dark-surface p-8 mb-8 shadow-md">
					<div className="absolute top-0 right-0 w-80 h-80 bg-brand-orange/5 rounded-full filter blur-3xl pointer-events-none"></div>
					<div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
						<div>
							<h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-brand-orange to-amber-400">
								Coding Organizations
							</h1>
							<p className="text-sm text-gray-400 mt-2 max-w-xl leading-relaxed">
								Establish collaborative coding workspaces for universities, coding clubs, bootcamps, and teams. Link exclusive contests, practice libraries, and share resources.
							</p>
						</div>
						{user && (
							<button
								onClick={() => {
									setNewOrgName("");
									setNewOrgDesc("");
									setNewOrgWebsite("");
									setNewOrgLocation("");
									setNewOrgEmail("");
									setErrorMsg("");
									setSuccessMsg("");
									setShowCreateModal(true);
								}}
								className="bg-brand-orange hover:bg-brand-orange-s text-bg-base px-6 py-3 rounded-xl font-bold text-xs transition flex items-center gap-2 shadow-glow-sm cursor-pointer whitespace-nowrap active:scale-95"
								style={{ color: "var(--bg-base)" }}
							>
								<FaPlus size={10} /> Create Workspace
							</button>
						)}
					</div>
				</div>

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
							<select
								value={typeFilter}
								onChange={(e) => setTypeFilter(e.target.value)}
								className="flex-1 md:w-56 bg-dark-layer-2 border border-gray-850 text-xs rounded-xl px-4 py-3 text-white outline-none focus:border-brand-orange cursor-pointer"
							>
								<option value="">All Organization Types</option>
								<option value="university">University / College</option>
								<option value="company">Company / Enterprise</option>
								<option value="coding_club">Coding Club</option>
								<option value="research_lab">Research Lab</option>
								<option value="community">Public Community</option>
								<option value="private_team">Private Team</option>
							</select>

							<button
								type="submit"
								className="bg-dark-fill-3 hover:bg-dark-fill-2 text-white border border-gray-800 text-xs font-bold px-5 py-3 rounded-xl transition"
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
							className="mt-5 bg-dark-layer-1 hover:bg-dark-fill-3 border border-gray-850 text-gray-300 px-4 py-2 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5"
						>
							<FaUndoAlt size={10} /> Reset Filters
						</button>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
						{orgs.map((org) => (
							<div
								key={org.slug}
								className="bg-dark-surface border border-gray-850 rounded-2xl overflow-hidden shadow-md flex flex-col justify-between hover:border-brand-orange/40 transition-all duration-300 group hover:shadow-glow-sm"
							>
								<div>
									{/* Banner */}
									<div
										className="h-20 bg-cover bg-center relative"
										style={{
											backgroundImage: org.bannerUrl
												? `url(${org.bannerUrl})`
												: `linear-gradient(135deg, #131316 0%, #ff8c0015 100%)`,
										}}
									>
										<div className="absolute inset-0 bg-black/40" />
									</div>

									{/* Avatar placement */}
									<div className="px-5 pb-2 -mt-7 flex items-end gap-3 relative z-10">
										<div className="w-14 h-14 rounded-xl border-2 border-dark-surface bg-dark-layer-1 overflow-hidden shrink-0 flex items-center justify-center shadow-lg">
											{org.avatarUrl ? (
												<img
													src={org.avatarUrl}
													alt={org.name}
													className="w-full h-full object-cover"
												/>
											) : (
												<div className="w-full h-full flex items-center justify-center">
													{getOrgIcon(org.type)}
												</div>
											)}
										</div>
										<div className="mb-0.5 flex-1 min-w-0">
											<div className="flex items-center gap-1.5">
												<h3 className="text-sm font-bold text-white truncate group-hover:text-brand-orange transition">
													{org.name}
												</h3>
												{org.verified && (
													<FaCheckCircle className="text-blue-400 shrink-0" size={11} title="Verified workspace" />
												)}
											</div>
											<span className="text-[10px] text-gray-500 font-mono">@{org.slug}</span>
										</div>
									</div>

									{/* Body Description */}
									<div className="px-5 pt-3">
										<p className="text-xs text-gray-400 line-clamp-3 min-h-[48px] leading-relaxed">
											{org.description || "Welcome! No description uploaded yet for this organization."}
										</p>
									</div>

									{/* Statistics Row */}
									<div className="px-5 py-3 flex gap-4 text-xs font-semibold text-gray-500 border-t border-gray-850/40 mt-4">
										<span className="flex items-center gap-1.5">
											<FaUsers size={11} className="text-brand-orange" />
											{org.memberCount} members
										</span>
										<span className="flex items-center gap-1.5">
											<FaTrophy size={11} className="text-yellow-500" />
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
									<Link
										href={`/orgs/${org.slug}`}
										className="text-xs font-bold text-brand-orange hover:text-brand-orange-s transition flex items-center gap-1"
									>
										{org.isMember ? "Enter Workspace" : "View Profile"} →
									</Link>
								</div>
							</div>
						))}
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
									<select
										value={newOrgType}
										onChange={(e) => setNewOrgType(e.target.value)}
										className="w-full bg-dark-layer-2 border border-gray-850 focus:border-brand-orange text-xs rounded-xl p-3 text-white outline-none transition cursor-pointer"
									>
										<option value="university">University</option>
										<option value="company">Company</option>
										<option value="coding_club">Coding Club</option>
										<option value="research_lab">Research Lab</option>
										<option value="community">Public Community</option>
										<option value="private_team">Private Team</option>
									</select>
								</div>
								<div>
									<label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
										Visibility <span className="text-red-500">*</span>
									</label>
									<select
										value={newOrgVisibility}
										onChange={(e) => setNewOrgVisibility(e.target.value)}
										className="w-full bg-dark-layer-2 border border-gray-850 focus:border-brand-orange text-xs rounded-xl p-3 text-white outline-none transition cursor-pointer"
									>
										<option value="public">Public (Visible in directory)</option>
										<option value="private">Private (Invite only)</option>
										<option value="secret">Secret (Undiscoverable)</option>
									</select>
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
