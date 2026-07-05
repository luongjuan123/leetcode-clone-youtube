import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAdmin } from "@/hooks/useAdmin";
import Topbar from "@/components/Topbar/Topbar";
import { getFriendlyErrorMessage } from "@/utils/errorFilter";
import { auth } from "@/firebase/firebase";
import {
	FaUserShield,
	FaBan,
	FaUndo,
	FaTrash,
	FaSignOutAlt,
	FaChevronLeft,
	FaHistory,
	FaTerminal,
	FaInfoCircle,
	FaExclamationTriangle,
	FaSpinner,
	FaTimes,
	FaCheck,
	FaCopy
} from "react-icons/fa";

interface UserProfile {
	uid: string;
	email: string;
	displayName: string;
	role: string;
	status: "ACTIVE" | "BANNED";
	easyCount: number;
	mediumCount: number;
	hardCount: number;
	mlCount: number;
	score: number;
	createdAt: number;
	username: string;
	studentId?: string;
	school?: string;
	faculty?: string;
	class?: string;
	experienceLevel?: string;
}

interface ModerationDetails {
	status: "ACTIVE" | "BANNED";
	reason?: string;
	duration?: string;
	notes?: string;
	bannedAt?: number;
	expiresAt?: number | null;
	bannedBy?: string;
	warnings?: any[];
	banHistory?: Array<{
		action: "BAN" | "UNBAN";
		reason: string;
		duration?: string;
		timestamp: number;
		adminUid: string;
		notes?: string;
	}>;
}

interface AuditLogItem {
	id: string;
	adminUid: string;
	adminName: string;
	action: "BAN" | "UNBAN" | "DELETE" | "LOGOUT" | "WARN";
	timestamp: number;
	reason: string;
	duration: string;
	ip: string;
	oldState: string;
	newState: string;
	notes: string;
}

interface Submission {
	id: string;
	problemId: string;
	problemTitle: string;
	verdict: string;
	status: string;
	score: number;
	language: string;
	timestamp: number;
	runtime?: number;
	memory?: number;
}

export default function UserDetailPage() {
	const router = useRouter();
	const { uid } = router.query;
	const [isAdmin, loadingAdmin] = useAdmin();

	// Page Data
	const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
	const [moderation, setModeration] = useState<ModerationDetails | null>(null);
	const [logs, setLogs] = useState<AuditLogItem[]>([]);
	const [submissions, setSubmissions] = useState<Submission[]>([]);
	const [loading, setLoading] = useState(true);

	const [activeSubTab, setActiveSubTab] = useState<"submissions" | "history" | "logs">("submissions");

	// Actions / Modals
	const [statusRibbon, setStatusRibbon] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
	const [showSuspendModal, setShowSuspendModal] = useState(false);
	const [suspendDuration, setSuspendDuration] = useState("1 day");
	const [suspendReason, setSuspendReason] = useState("Spam");
	const [suspendNotes, setSuspendNotes] = useState("");
	const [submittingSuspend, setSubmittingSuspend] = useState(false);

	const [showUnsuspendModal, setShowUnsuspendModal] = useState(false);
	const [unsuspendReason, setUnsuspendReason] = useState("Appeal accepted");
	const [unsuspendNotes, setUnsuspendNotes] = useState("");
	const [submittingUnsuspend, setSubmittingUnsuspend] = useState(false);

	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [deleteConfirmText, setDeleteConfirmText] = useState("");
	const [deleteReason, setDeleteReason] = useState("Request by user");
	const [deleteNotes, setDeleteNotes] = useState("");
	const [submittingDelete, setSubmittingDelete] = useState(false);

	// Check Credentials
	useEffect(() => {
		if (!loadingAdmin && !isAdmin) {
			router.push("/");
		}
	}, [isAdmin, loadingAdmin, router]);

	const triggerStatusRibbon = (type: "success" | "error" | "info", message: string, duration = 4000) => {
		setStatusRibbon({ type, message });
		if (duration > 0) {
			setTimeout(() => {
				setStatusRibbon((prev) => prev?.message === message ? null : prev);
			}, duration);
		}
	};

	const fetchUserDetails = useCallback(async () => {
		if (!uid) return;
		setLoading(true);
		try {
			const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : "";
			const res = await fetch(`/api/admin/users/${uid}`, {
				headers: {
					"Authorization": `Bearer ${idToken}`
				}
			});

			if (!res.ok) {
				throw new Error("Failed to fetch user details");
			}

			const data = await res.json();
			setUserProfile(data.user);
			setModeration(data.moderation);
			setLogs(data.logs);
			setSubmissions(data.recentSubmissions);
		} catch (error: any) {
			console.error("Error fetching user details:", error);
			triggerStatusRibbon("error", getFriendlyErrorMessage(error, "Failed to load user information."));
		} finally {
			setLoading(false);
		}
	}, [uid]);

	useEffect(() => {
		if (isAdmin && uid) {
			fetchUserDetails();
		}
	}, [isAdmin, uid, fetchUserDetails]);

	const handleSuspend = async () => {
		if (!userProfile) return;
		setSubmittingSuspend(true);
		try {
			const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : "";
			const res = await fetch("/api/admin/moderation/ban", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${idToken}`
				},
				body: JSON.stringify({
					targetUid: userProfile.uid,
					reason: suspendReason,
					duration: suspendDuration,
					notes: suspendNotes
				})
			});

			if (!res.ok) {
				const errorData = await res.json();
				throw new Error(errorData.error || "Failed to suspend user");
			}

			triggerStatusRibbon("success", `Suspended user account successfully.`);
			setShowSuspendModal(false);
			setSuspendNotes("");
			fetchUserDetails();
		} catch (error: any) {
			console.error("Suspend error:", error);
			triggerStatusRibbon("error", error.message);
		} finally {
			setSubmittingSuspend(false);
		}
	};

	const handleUnsuspend = async () => {
		if (!userProfile) return;
		setSubmittingUnsuspend(true);
		try {
			const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : "";
			const res = await fetch("/api/admin/moderation/unban", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${idToken}`
				},
				body: JSON.stringify({
					targetUid: userProfile.uid,
					reason: unsuspendReason,
					notes: unsuspendNotes
				})
			});

			if (!res.ok) {
				const errorData = await res.json();
				throw new Error(errorData.error || "Failed to unsuspend user");
			}

			triggerStatusRibbon("success", `Unsuspended user account successfully.`);
			setShowUnsuspendModal(false);
			setUnsuspendNotes("");
			fetchUserDetails();
		} catch (error: any) {
			console.error("Unsuspend error:", error);
			triggerStatusRibbon("error", error.message);
		} finally {
			setSubmittingUnsuspend(false);
		}
	};

	const handleDeleteUser = async () => {
		if (!userProfile || deleteConfirmText !== "DELETE") return;
		setSubmittingDelete(true);
		try {
			const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : "";
			const res = await fetch("/api/admin/moderation/delete", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${idToken}`
				},
				body: JSON.stringify({
					targetUid: userProfile.uid,
					reason: deleteReason,
					notes: deleteNotes
				})
			});

			if (!res.ok) {
				const errorData = await res.json();
				throw new Error(errorData.error || "Failed to delete user");
			}

			triggerStatusRibbon("success", `Permanently deleted user account.`);
			router.push("/admin/moderation");
		} catch (error: any) {
			console.error("Delete error:", error);
			triggerStatusRibbon("error", error.message);
		} finally {
			setSubmittingDelete(false);
		}
	};

	const handleForceLogout = async () => {
		if (!userProfile) return;
		triggerStatusRibbon("info", `Revoking active sessions for ${userProfile.displayName}...`, 0);
		try {
			const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : "";
			const res = await fetch("/api/admin/moderation/ban", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${idToken}`
				},
				body: JSON.stringify({
					targetUid: userProfile.uid,
					reason: "Admin session revocation",
					duration: "1 day",
					notes: "Force logout request by admin"
				})
			});

			if (!res.ok) throw new Error("Failed to revoke session");

			await fetch("/api/admin/moderation/unban", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${idToken}`
				},
				body: JSON.stringify({
					targetUid: userProfile.uid,
					reason: "Session revoked, unbanning for fresh login"
				})
			});

			triggerStatusRibbon("success", `Successfully logged out user everywhere.`);
			fetchUserDetails();
		} catch (error: any) {
			console.error("Force logout error:", error);
			triggerStatusRibbon("error", "Failed to force logout user.");
		}
	};

	if (loadingAdmin || !isAdmin || loading) {
		return (
			<div className="bg-dark-layer-2 min-h-screen text-white flex items-center justify-center">
				<div className="text-xl font-semibold animate-pulse flex items-center gap-2">
					<FaSpinner className="animate-spin text-brand-orange" />
					Loading details...
				</div>
			</div>
		);
	}

	const isBanned = moderation?.status === "BANNED";

	return (
		<main className="bg-dark-layer-2 min-h-screen text-white font-sans">
			<Topbar />
			<div className="max-w-[1200px] mx-auto px-6 py-10">
				{/* Top Navigation */}
				<div className="mb-6">
					<Link
						href="/admin/moderation"
						className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition uppercase tracking-wider"
					>
						<FaChevronLeft size={10} />
						Back to Moderation List
					</Link>
				</div>

				{/* Status Ribbon */}
				{statusRibbon && (
					<div
						className={`mb-6 p-3 rounded-lg border text-sm font-semibold transition-all duration-300 ${
							statusRibbon.type === "success"
								? "bg-emerald-950/40 text-emerald-400 border-emerald-800/50"
								: statusRibbon.type === "error"
								? "bg-rose-950/40 text-rose-400 border-rose-800/50"
								: "bg-blue-950/40 text-blue-400 border-blue-800/50"
						}`}
					>
						{statusRibbon.message}
					</div>
				)}

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
					{/* Left Column: User Profile Summary card */}
					<div className="bg-dark-layer-1 border border-gray-850 rounded-xl p-6 shadow-xl h-fit">
						<div className="flex flex-col items-center text-center">
							<div className="w-20 h-20 rounded-full bg-red-950/20 text-red-500 font-extrabold border border-red-500/20 flex items-center justify-center text-2xl mb-4 shadow-lg">
								{userProfile?.displayName ? userProfile.displayName[0].toUpperCase() : "U"}
							</div>
							<h2 className="text-xl font-bold text-white leading-tight">
								{userProfile?.displayName || "Anonymous User"}
							</h2>
							<p className="text-sm text-gray-400 mt-1 font-mono">@{userProfile?.username || "unset"}</p>
							
							<div className="mt-3 flex gap-2">
								<span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
									userProfile?.role === "admin"
										? "bg-indigo-950/30 text-indigo-400 border-indigo-900/50"
										: "bg-gray-800 text-gray-400 border-gray-700/50"
								}`}>
									{userProfile?.role}
								</span>
								<span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
									isBanned
										? "bg-red-950/30 text-red-400 border-red-900/50"
										: "bg-emerald-950/30 text-emerald-400 border-emerald-900/50"
								}`}>
									{isBanned ? "SUSPENDED" : "ACTIVE"}
								</span>
							</div>
						</div>

						{/* Quick Stats Grid */}
						<div className="grid grid-cols-2 gap-4 mt-8 border-y border-gray-850/60 py-4 font-mono text-center">
							<div>
								<div className="text-lg font-bold text-amber-500">{userProfile?.score || 0}</div>
								<div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Score (XP)</div>
							</div>
							<div>
								<div className="text-lg font-bold text-white">
									{(userProfile?.easyCount || 0) + (userProfile?.mediumCount || 0) + (userProfile?.hardCount || 0) + (userProfile?.mlCount || 0)}
								</div>
								<div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Solved Problems</div>
							</div>
						</div>

						{/* Metadata List */}
						<div className="mt-6 space-y-3.5 text-xs">
							<div className="flex justify-between items-center bg-dark-layer-2/30 p-2 rounded border border-gray-850/50">
								<span className="text-gray-500 font-bold uppercase tracking-wider font-semibold">UID</span>
								<div className="flex items-center gap-2">
									<span className="text-gray-300 font-mono select-all truncate max-w-[140px]" title={userProfile?.uid}>
										{userProfile?.uid}
									</span>
									<button
										onClick={() => {
											if (userProfile?.uid) {
												navigator.clipboard.writeText(userProfile.uid);
												triggerStatusRibbon("success", "UID copied to clipboard");
											}
										}}
										className="text-gray-400 hover:text-white transition p-1 hover:bg-gray-800 rounded animate-fade-in"
										title="Copy UID"
									>
										<FaCopy size={11} />
									</button>
								</div>
							</div>
							<div className="flex justify-between items-center bg-dark-layer-2/30 p-2 rounded border border-gray-850/50">
								<span className="text-gray-500 font-bold uppercase tracking-wider font-semibold">Email</span>
								<div className="flex items-center gap-2">
									<span className="text-gray-300 truncate max-w-[140px]" title={userProfile?.email}>
										{userProfile?.email}
									</span>
									<button
										onClick={() => {
											if (userProfile?.email) {
												navigator.clipboard.writeText(userProfile.email);
												triggerStatusRibbon("success", "Email copied to clipboard");
											}
										}}
										className="text-gray-400 hover:text-white transition p-1 hover:bg-gray-800 rounded animate-fade-in"
										title="Copy Email"
									>
										<FaCopy size={11} />
									</button>
								</div>
							</div>
							<div className="flex justify-between items-center bg-dark-layer-2/30 p-2 rounded border border-gray-850/50">
								<span className="text-gray-500 font-bold uppercase tracking-wider font-semibold">Username</span>
								<div className="flex items-center gap-2">
									<span className="text-gray-300 truncate max-w-[140px]" title={userProfile?.username}>
										@{userProfile?.username || "unset"}
									</span>
									<button
										onClick={() => {
											if (userProfile?.username) {
												navigator.clipboard.writeText(userProfile.username);
												triggerStatusRibbon("success", "Username copied to clipboard");
											}
										}}
										className="text-gray-400 hover:text-white transition p-1 hover:bg-gray-800 rounded animate-fade-in"
										title="Copy Username"
									>
										<FaCopy size={11} />
									</button>
								</div>
							</div>
							<div className="flex justify-between items-center bg-dark-layer-2/30 p-2 rounded border border-gray-850/50">
								<span className="text-gray-500 font-bold uppercase tracking-wider font-semibold">Display Name</span>
								<div className="flex items-center gap-2">
									<span className="text-gray-300 truncate max-w-[140px]" title={userProfile?.displayName}>
										{userProfile?.displayName || "Anonymous"}
									</span>
									<button
										onClick={() => {
											if (userProfile?.displayName) {
												navigator.clipboard.writeText(userProfile.displayName);
												triggerStatusRibbon("success", "Display Name copied to clipboard");
											}
										}}
										className="text-gray-400 hover:text-white transition p-1 hover:bg-gray-800 rounded animate-fade-in"
										title="Copy Display Name"
									>
										<FaCopy size={11} />
									</button>
								</div>
							</div>
							{userProfile?.studentId && (
								<div className="flex justify-between items-center">
									<span className="text-gray-500 font-bold uppercase tracking-wider">Student ID</span>
									<span className="text-gray-300 font-mono">{userProfile.studentId}</span>
								</div>
							)}
							{userProfile?.school && (
								<div className="flex justify-between items-center">
									<span className="text-gray-500 font-bold uppercase tracking-wider">School</span>
									<span className="text-gray-300 truncate max-w-[160px]">{userProfile.school}</span>
								</div>
							)}
							<div className="flex justify-between items-center">
								<span className="text-gray-500 font-bold uppercase tracking-wider">Created At</span>
								<span className="text-gray-300">
									{userProfile?.createdAt ? new Date(userProfile.createdAt).toLocaleString() : "-"}
								</span>
							</div>
						</div>

						{/* Action Buttons */}
						<div className="mt-8 pt-6 border-t border-gray-850/60 space-y-2.5">
							{isBanned ? (
								<button
									onClick={() => setShowUnsuspendModal(true)}
									className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition duration-200 shadow-md shadow-emerald-950/40"
								>
									<FaUndo size={12} />
									Lift Suspension
								</button>
							) : (
								<button
									onClick={() => setShowSuspendModal(true)}
									className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition duration-200 shadow-md shadow-amber-950/40"
								>
									<FaBan size={12} />
									Suspend Account
								</button>
							)}

							<button
								onClick={handleForceLogout}
								className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-dark-layer-2 hover:bg-gray-800 border border-gray-800 text-gray-300 hover:text-white rounded-lg text-xs font-bold transition duration-200"
							>
								<FaSignOutAlt size={12} />
								Force Logout
							</button>

							<button
								onClick={() => setShowDeleteModal(true)}
								className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition duration-200 shadow-md shadow-red-950/40"
							>
								<FaTrash size={12} />
								Delete Account
							</button>
						</div>
					</div>

					{/* Right Column: Tabbed Activity details */}
					<div className="lg:col-span-2 flex flex-col gap-6">
						{/* Tab Switcher */}
						<div className="bg-dark-layer-1 border border-gray-850 rounded-xl p-2 flex gap-2 shadow-lg">
							<button
								onClick={() => setActiveSubTab("submissions")}
								className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition duration-200 flex items-center justify-center gap-2 ${
									activeSubTab === "submissions" ? "bg-red-600 text-white shadow" : "text-gray-400 hover:text-white hover:bg-gray-800/40"
								}`}
							>
								<FaTerminal size={12} />
								Submissions
							</button>
							<button
								onClick={() => setActiveSubTab("history")}
								className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition duration-200 flex items-center justify-center gap-2 ${
									activeSubTab === "history" ? "bg-red-600 text-white shadow" : "text-gray-400 hover:text-white hover:bg-gray-800/40"
								}`}
							>
								<FaExclamationTriangle size={12} />
								Ban History
							</button>
							<button
								onClick={() => setActiveSubTab("logs")}
								className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition duration-200 flex items-center justify-center gap-2 ${
									activeSubTab === "logs" ? "bg-red-600 text-white shadow" : "text-gray-400 hover:text-white hover:bg-gray-800/40"
								}`}
							>
								<FaHistory size={12} />
								Audit Log
							</button>
						</div>

						{/* Tab Body */}
						<div className="bg-dark-layer-1 border border-gray-850 rounded-xl p-6 shadow-xl flex-1">
							{activeSubTab === "submissions" && (
								<div>
									<h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Recent Submissions</h3>
									{submissions.length === 0 ? (
										<p className="text-gray-400 text-xs font-mono py-6 text-center">No submissions recorded for this account.</p>
									) : (
										<div className="space-y-3.5">
											{submissions.map((sub) => (
												<div
													key={sub.id}
													className="bg-dark-layer-2/60 border border-gray-850 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
												>
													<div>
														<span className="text-[10px] text-gray-500 font-mono uppercase font-bold tracking-wider">Problem</span>
														<div className="text-sm font-bold text-white mt-0.5">{sub.problemTitle}</div>
														<div className="text-[10px] text-gray-400 mt-1 font-mono">
															{sub.language.toUpperCase()} • {new Date(sub.timestamp).toLocaleString()}
														</div>
													</div>
													<div className="flex items-center gap-4 text-right">
														<div>
															<span className="text-[10px] text-gray-500 font-mono uppercase font-bold tracking-wider">Verdict</span>
															<div className={`text-xs font-bold uppercase mt-0.5 ${
																sub.status === "passed" ? "text-emerald-400" : "text-red-400"
															}`}>
																{sub.verdict}
															</div>
														</div>
														<div>
															<span className="text-[10px] text-gray-500 font-mono uppercase font-bold tracking-wider">Score</span>
															<div className="text-xs font-bold text-amber-500 mt-0.5">{sub.score} XP</div>
														</div>
													</div>
												</div>
											))}
										</div>
									)}
								</div>
							)}

							{activeSubTab === "history" && (
								<div>
									<h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Warnings & Suspension Records</h3>
									{!moderation || !moderation.banHistory || moderation.banHistory.length === 0 ? (
										<p className="text-gray-400 text-xs font-mono py-6 text-center">No warning or ban history records exist.</p>
									) : (
										<div className="space-y-4">
											{moderation.banHistory.map((item, idx) => (
												<div
													key={idx}
													className="bg-dark-layer-2/60 border border-gray-850 rounded-lg p-4 text-xs space-y-2"
												>
													<div className="flex justify-between items-center">
														<span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
															item.action === "BAN"
																? "bg-red-950/40 text-red-400 border-red-800/40"
																: "bg-emerald-950/40 text-emerald-400 border-emerald-800/40"
														}`}>
															{item.action}
														</span>
														<span className="text-gray-500 font-mono">
															{new Date(item.timestamp).toLocaleString()}
														</span>
													</div>
													<div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
														<div>
															<span className="text-gray-500 font-bold block">Reason</span>
															<span className="text-gray-300 font-medium">{item.reason}</span>
														</div>
														{item.duration && (
															<div>
																<span className="text-gray-500 font-bold block">Duration</span>
																<span className="text-amber-500 font-bold">{item.duration}</span>
															</div>
														)}
													</div>
													{item.notes && (
														<div className="border-t border-gray-850/50 pt-2 text-gray-400 font-sans mt-1">
															<strong>Admin Note:</strong> {item.notes}
														</div>
													)}
												</div>
											))}
										</div>
									)}
								</div>
							)}

							{activeSubTab === "logs" && (
								<div>
									<h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Moderation Audit Logs</h3>
									{logs.length === 0 ? (
										<p className="text-gray-400 text-xs font-mono py-6 text-center">No audit logs recorded for this user.</p>
									) : (
										<div className="space-y-3.5 font-mono text-xs">
											{logs.map((log) => (
												<div
													key={log.id}
													className="bg-dark-layer-2/60 border border-gray-850 rounded-lg p-4 space-y-2"
												>
													<div className="flex justify-between items-center text-gray-400 text-[10px]">
														<span>{new Date(log.timestamp).toLocaleString()}</span>
														<span>IP: {log.ip}</span>
													</div>
													<div className="text-gray-200 font-sans">
														Admin <strong>{log.adminName}</strong> executed a 
														<span className="text-red-400 font-bold mx-1 uppercase">{log.action}</span> 
														operation on this user.
													</div>
													<div className="text-[11px] grid grid-cols-2 gap-y-1 font-sans">
														<div className="text-gray-500">Reason:</div>
														<div className="text-gray-300">{log.reason} {log.duration !== "N/A" && `(${log.duration})`}</div>
														{log.notes && (
															<>
																<div className="text-gray-500">Notes:</div>
																<div className="text-gray-400">{log.notes}</div>
															</>
														)}
													</div>
												</div>
											))}
										</div>
									)}
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* MODALS */}

			{/* Suspend Modal */}
			{showSuspendModal && userProfile && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn">
					<div className="bg-dark-layer-1 border border-gray-850 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl relative">
						<button
							onClick={() => setShowSuspendModal(false)}
							className="absolute top-4 right-4 text-gray-500 hover:text-white transition"
						>
							<FaTimes />
						</button>
						<h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2 text-amber-500">
							<FaBan />
							Suspend User Account
						</h3>
						<p className="text-gray-400 text-xs mb-6">
							Suspend access for <span className="text-white font-bold">{userProfile.displayName}</span>. The user will be logged out immediately.
						</p>

						<div className="space-y-4 mb-6">
							<div>
								<label className="text-xs font-bold block mb-1 text-gray-400 uppercase tracking-wider">Duration</label>
								<select
									value={suspendDuration}
									onChange={(e) => setSuspendDuration(e.target.value)}
									className="w-full bg-dark-layer-2 border border-gray-850 text-sm rounded-lg px-3 py-2 text-white outline-none focus:border-red-500 transition cursor-pointer"
								>
									<option value="1 day">1 Day</option>
									<option value="7 days">7 Days</option>
									<option value="30 days">30 Days</option>
									<option value="Permanent">Permanent</option>
								</select>
							</div>

							<div>
								<label className="text-xs font-bold block mb-1 text-gray-400 uppercase tracking-wider">Reason</label>
								<select
									value={suspendReason}
									onChange={(e) => setSuspendReason(e.target.value)}
									className="w-full bg-dark-layer-2 border border-gray-850 text-sm rounded-lg px-3 py-2 text-white outline-none focus:border-red-500 transition cursor-pointer"
								>
									<option value="Spam">Spam & Advertisement</option>
									<option value="Harassment">Harassment / Abusive behavior</option>
									<option value="Plagiarism">Plagiarism / Cheating</option>
									<option value="Terms Violation">Violation of Terms of Service</option>
									<option value="Other">Other (specify in notes)</option>
								</select>
							</div>

							<div>
								<label className="text-xs font-bold block mb-1 text-gray-400 uppercase tracking-wider">Notes / Details</label>
								<textarea
									value={suspendNotes}
									onChange={(e) => setSuspendNotes(e.target.value)}
									placeholder="Provide additional details or audit notes..."
									rows={3}
									className="w-full bg-dark-layer-2 border border-gray-850 hover:border-gray-800 focus:border-red-500 text-sm rounded-lg p-3 text-white outline-none resize-none transition"
								/>
							</div>
						</div>

						<div className="flex justify-end gap-3 border-t border-gray-850 pt-4">
							<button
								type="button"
								onClick={() => setShowSuspendModal(false)}
								className="px-4 py-2 bg-dark-fill-3 hover:bg-dark-fill-2 text-gray-300 rounded-lg text-xs font-bold transition duration-200"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleSuspend}
								disabled={submittingSuspend}
								className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition duration-200 shadow-md shadow-amber-900/30 flex items-center gap-1.5"
							>
								{submittingSuspend ? <FaSpinner className="animate-spin" /> : <FaBan />}
								Confirm Suspension
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Unsuspend Modal */}
			{showUnsuspendModal && userProfile && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn">
					<div className="bg-dark-layer-1 border border-gray-850 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl relative">
						<button
							onClick={() => setShowUnsuspendModal(false)}
							className="absolute top-4 right-4 text-gray-500 hover:text-white transition"
						>
							<FaTimes />
						</button>
						<h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2 text-emerald-500">
							<FaUndo />
							Lift Account Suspension
						</h3>
						<p className="text-gray-400 text-xs mb-6">
							Reinstate access for <span className="text-white font-bold">{userProfile.displayName}</span>.
						</p>

						<div className="space-y-4 mb-6">
							<div>
								<label className="text-xs font-bold block mb-1 text-gray-400 uppercase tracking-wider">Unban Reason</label>
								<select
									value={unsuspendReason}
									onChange={(e) => setUnsuspendReason(e.target.value)}
									className="w-full bg-dark-layer-2 border border-gray-850 text-sm rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-500 transition cursor-pointer"
								>
									<option value="Appeal accepted">Appeal accepted</option>
									<option value="Suspension duration complete">Suspension duration complete</option>
									<option value="False positive check">False positive correction</option>
									<option value="Other">Other (specify in notes)</option>
								</select>
							</div>

							<div>
								<label className="text-xs font-bold block mb-1 text-gray-400 uppercase tracking-wider">Audit Notes</label>
								<textarea
									value={unsuspendNotes}
									onChange={(e) => setUnsuspendNotes(e.target.value)}
									placeholder="Provide additional details or audit notes..."
									rows={3}
									className="w-full bg-dark-layer-2 border border-gray-850 hover:border-gray-800 focus:border-emerald-500 text-sm rounded-lg p-3 text-white outline-none resize-none transition"
								/>
							</div>
						</div>

						<div className="flex justify-end gap-3 border-t border-gray-850 pt-4">
							<button
								type="button"
								onClick={() => setShowUnsuspendModal(false)}
								className="px-4 py-2 bg-dark-fill-3 hover:bg-dark-fill-2 text-gray-300 rounded-lg text-xs font-bold transition duration-200"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleUnsuspend}
								disabled={submittingUnsuspend}
								className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition duration-200 shadow-md shadow-emerald-900/30 flex items-center gap-1.5"
							>
								{submittingUnsuspend ? <FaSpinner className="animate-spin" /> : <FaCheck />}
								Confirm Unban
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Delete Modal */}
			{showDeleteModal && userProfile && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn">
					<div className="bg-dark-layer-1 border border-red-900/50 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl relative">
						<button
							onClick={() => {
								setShowDeleteModal(false);
								setDeleteConfirmText("");
							}}
							className="absolute top-4 right-4 text-gray-500 hover:text-white transition"
						>
							<FaTimes />
						</button>
						<h3 className="text-lg font-bold text-red-500 mb-2 flex items-center gap-2">
							<FaTrash />
							Delete Account Permanently
						</h3>
						<p className="text-gray-400 text-xs mb-4">
							This will <span className="text-red-500 font-bold uppercase">permanently delete</span> the account for <span className="text-white font-bold">{userProfile.displayName}</span>.
						</p>
						<div className="p-3 bg-red-950/20 border border-red-900/30 rounded-lg mb-6 text-[11px] text-red-400 leading-relaxed">
							⚠️ <strong>CRITICAL WARNING:</strong> This wipes their user profile document and Firebase Authentication login record. This action is <strong>irreversible</strong>. The user&apos;s email address will be immediately freed for registration.
						</div>

						<div className="space-y-4 mb-6">
							<div>
								<label className="text-xs font-bold block mb-1 text-gray-400 uppercase tracking-wider">Reason for Deletion</label>
								<select
									value={deleteReason}
									onChange={(e) => setDeleteReason(e.target.value)}
									className="w-full bg-dark-layer-2 border border-gray-850 text-sm rounded-lg px-3 py-2 text-white outline-none focus:border-red-500 transition cursor-pointer"
								>
									<option value="Request by user">Requested by user (Right to be Forgotten)</option>
									<option value="Terms Violation">Severe / Repeated platform abuse</option>
									<option value="Duplicate Account">Cleanup of duplicate account</option>
									<option value="Other">Other (specify in notes)</option>
								</select>
							</div>

							<div>
								<label className="text-xs font-bold block mb-1 text-gray-400 uppercase tracking-wider">Audit Notes</label>
								<textarea
									value={deleteNotes}
									onChange={(e) => setDeleteNotes(e.target.value)}
									placeholder="Provide additional details or audit notes..."
									rows={2}
									className="w-full bg-dark-layer-2 border border-gray-850 hover:border-gray-800 focus:border-red-500 text-sm rounded-lg p-3 text-white outline-none resize-none transition"
								/>
							</div>

							<div>
								<label className="text-xs font-bold block mb-1 text-gray-400">
									Type <span className="text-red-500 font-bold font-mono">DELETE</span> to confirm:
								</label>
								<input
									type="text"
									value={deleteConfirmText}
									onChange={(e) => setDeleteConfirmText(e.target.value)}
									placeholder="DELETE"
									className="w-full bg-dark-layer-2 border border-gray-850 focus:border-red-500 text-sm rounded-lg px-3 py-2 text-white outline-none font-mono text-center tracking-widest"
								/>
							</div>
						</div>

						<div className="flex justify-end gap-3 border-t border-gray-850 pt-4">
							<button
								type="button"
								onClick={() => {
									setShowDeleteModal(false);
									setDeleteConfirmText("");
								}}
								className="px-4 py-2 bg-dark-fill-3 hover:bg-dark-fill-2 text-gray-300 rounded-lg text-xs font-bold transition duration-200"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleDeleteUser}
								disabled={deleteConfirmText !== "DELETE" || submittingDelete}
								className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition duration-200 shadow-md shadow-red-950/40 flex items-center gap-1.5"
							>
								{submittingDelete ? <FaSpinner className="animate-spin" /> : <FaTrash />}
								Delete Account
							</button>
						</div>
					</div>
				</div>
			)}
		</main>
	);
}

export async function getServerSideProps() {
	return {
		props: {},
	};
}
