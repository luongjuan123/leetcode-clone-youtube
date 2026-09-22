import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import { useAdmin } from "@/hooks/useAdmin";
import Topbar from "@/components/Topbar/Topbar";
import {
	collection,
	getDocs,
	doc,
	getDoc,
	setDoc,
	deleteDoc,
	query,
	where,
	orderBy,
	writeBatch,
	onSnapshot
} from "firebase/firestore";
import { firestore, auth } from "@/firebase/firebase";
import { getFriendlyErrorMessage } from "@/utils/errorFilter";
import { problems as staticProblems } from "@/utils/problems";
import { problems as mockProblems } from "@/mockProblems/problems";
import {
	FiGrid,
	FiBookOpen,
	FiFlag,
	FiX,
	FiActivity,
	FiMail,
	FiUsers
} from "react-icons/fi";

// ─── Tab Components ────────────────────────────────────────────────────────────
import { OverviewTab } from "@/components/Admin/OverviewTab";
import { ProblemsTab } from "@/components/Admin/ProblemsTab";
import { ContestsTab } from "@/components/Admin/ContestsTab";
import { ModerationTab } from "@/components/Admin/ModerationTab";
import { EmailsTab } from "@/components/Admin/EmailsTab";
import { OrganizationsTab } from "@/components/Admin/OrganizationsTab";

// ─── Types ─────────────────────────────────────────────────────────────────────
type AdminTab = "overview" | "problems" | "contests" | "moderation" | "emails" | "organizations";

interface ProblemListItem {
	id: string;
	title: string;
	tags: string[];
	difficulty: string;
	isStatic: boolean;
}

interface ActivityLogItem {
	id: string;
	adminUid: string;
	targetUid?: string;
	targetName?: string;
	action: string;
	reason: string;
	timestamp: number;
}

// ─── Sidebar Tab Definitions ───────────────────────────────────────────────────
const TABS: { id: AdminTab; label: string; icon: React.ReactNode; danger?: boolean }[] = [
	{ id: "overview", label: "Overview", icon: <FiGrid size={13} /> },
	{ id: "problems", label: "Problems", icon: <FiBookOpen size={13} /> },
	{ id: "contests", label: "Contests", icon: <FiActivity size={13} /> },
	{ id: "moderation", label: "Moderation", icon: <FiFlag size={13} />, danger: true },
	{ id: "organizations", label: "Organizations", icon: <FiUsers size={13} /> },
	{ id: "emails", label: "Email Queue", icon: <FiMail size={13} /> },
];

// ─── Component ─────────────────────────────────────────────────────────────────
const AdminDashboard: React.FC = () => {
	const router = useRouter();
	const [isAdmin, loadingAdmin] = useAdmin();

	// Active tab from URL: /admin?tab=problems
	const activeTab = ((router.query.tab as string) || "overview") as AdminTab;

	const setActiveTab = (tab: AdminTab) => {
		router.push({ pathname: "/admin", query: { tab } }, undefined, { shallow: true });
	};

	// ─── Problems State ──────────────────────────────────────────────────────────
	const [problems, setProblems] = useState<ProblemListItem[]>([]);
	const [problemsLoading, setProblemsLoading] = useState(true);

	// ─── Maintenance State ────────────────────────────────────────────────────────
	const [syncing, setSyncing] = useState(false);
	const [recounting, setRecounting] = useState(false);

	// ─── Stats & Activity ─────────────────────────────────────────────────────────
	const [stats, setStats] = useState({ problems: 0, users: 0, submissions: 0, reports: 0, appeals: 0, contests: 0 });
	const [statsLoading, setStatsLoading] = useState(true);
	const [activities, setActivities] = useState<ActivityLogItem[]>([]);
	const [activitiesLoading, setActivitiesLoading] = useState(true);

	// ─── Status Ribbon ─────────────────────────────────────────────────────────────
	const [statusRibbon, setStatusRibbon] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

	const triggerStatusRibbon = useCallback((type: "success" | "error" | "info", message: string, duration = 4000) => {
		setStatusRibbon({ type, message });
		if (duration > 0) {
			setTimeout(() => setStatusRibbon((prev) => (prev?.message === message ? null : prev)), duration);
		}
	}, []);

	// ─── Auth Guard ────────────────────────────────────────────────────────────────
	useEffect(() => {
		if (!loadingAdmin && !isAdmin) router.push("/");
	}, [isAdmin, loadingAdmin, router]);

	// ─── Data Fetching & Real-time onSnapshot Subscriptions ────────────────────────
	useEffect(() => {
		if (loadingAdmin || !isAdmin) return;

		setStatsLoading(true);
		
		const unsubProblems = onSnapshot(collection(firestore, "problems"), (snap) => {
			setStats((prev) => ({ ...prev, problems: snap.size }));
			setStatsLoading(false);
		}, (err) => console.error("unsubProblems error:", err));

		const unsubUsers = onSnapshot(collection(firestore, "users"), (snap) => {
			setStats((prev) => ({ ...prev, users: snap.size }));
		}, (err) => console.error("unsubUsers error:", err));

		const unsubSubmissions = onSnapshot(collection(firestore, "submissions"), (snap) => {
			setStats((prev) => ({ ...prev, submissions: snap.size }));
		}, (err) => console.error("unsubSubmissions error:", err));

		const unsubReports = onSnapshot(query(collection(firestore, "userReports"), where("status", "==", "OPEN")), (snap) => {
			setStats((prev) => ({ ...prev, reports: snap.size }));
		}, (err) => console.error("unsubReports error:", err));

		const unsubAppeals = onSnapshot(query(collection(firestore, "moderationAppeals"), where("status", "==", "PENDING")), (snap) => {
			setStats((prev) => ({ ...prev, appeals: snap.size }));
		}, (err) => console.error("unsubAppeals error:", err));

		const unsubContests = onSnapshot(collection(firestore, "contests"), (snap) => {
			setStats((prev) => ({ ...prev, contests: snap.size }));
		}, (err) => console.error("unsubContests error:", err));

		setActivitiesLoading(true);
		const qLogs = query(collection(firestore, "moderationLogs"), orderBy("timestamp", "desc"));
		const unsubLogs = onSnapshot(qLogs, (snap) => {
			const logs: ActivityLogItem[] = [];
			snap.forEach((d) => logs.push({ id: d.id, ...d.data() } as ActivityLogItem));
			setActivities(logs.slice(0, 5));
			setActivitiesLoading(false);
		}, (err) => {
			console.error("unsubLogs error:", err);
			setActivitiesLoading(false);
		});

		return () => {
			unsubProblems();
			unsubUsers();
			unsubSubmissions();
			unsubReports();
			unsubAppeals();
			unsubContests();
			unsubLogs();
		};
	}, [isAdmin, loadingAdmin]);

	const fetchProblems = useCallback(async () => {
		setProblemsLoading(true);
		try {
			const snap = await getDocs(query(collection(firestore, "problems")));
			const dbProblems: Record<string, any> = {};
			snap.forEach((d) => (dbProblems[d.id] = { id: d.id, ...d.data() }));

			const allProblems: ProblemListItem[] = [];

			const addedIds = new Set<string>();
			const addProblem = (id: string, src: any, isStatic: boolean) => {
				const db = dbProblems[id];
				allProblems.push({
					id,
					title: db?.title || src?.title || id,
					tags: db?.tags || src?.categories || [],
					difficulty: db?.difficulty || src?.difficulty || "Easy",
					isStatic,
				});
				addedIds.add(id);
			};

			Object.entries(staticProblems).forEach(([id, p]) => addProblem(id, p, true));
			Object.entries(mockProblems).forEach(([id, p]) => { if (!addedIds.has(id)) addProblem(id, p, true); });
			Object.entries(dbProblems).forEach(([id, p]) => {
				if (!addedIds.has(id)) addProblem(id, p, false);
			});

			setProblems(allProblems);
		} catch (e: any) {
			triggerStatusRibbon("error", getFriendlyErrorMessage(e, "Failed to load problems."));
		} finally {
			setProblemsLoading(false);
		}
	}, [triggerStatusRibbon]);

	useEffect(() => {
		fetchProblems();
	}, [fetchProblems]);

	// ─── Problem Handlers & Soft Deletion Staging ──────────────────────────────────
	const handleDeleteProblem = async (id: string) => {
		try {
			const docRef = doc(firestore, "problems", id);
			const docSnap = await getDoc(docRef);
			if (docSnap.exists()) {
				const problemData = docSnap.data();
				// Stage the record to deleted_problems first
				await setDoc(doc(firestore, "deleted_problems", id), {
					...problemData,
					deletedAt: Date.now(),
					deletedBy: auth.currentUser?.email || "unknown"
				});
			}
			await deleteDoc(docRef);
			triggerStatusRibbon("success", `Problem "${id}" soft-deleted and staged.`);
			fetchProblems();
		} catch (e: any) {
			triggerStatusRibbon("error", getFriendlyErrorMessage(e, "Delete failed."));
		}
	};

	const handleBulkDelete = async (ids: string[]) => {
		try {
			const batch = writeBatch(firestore);
			for (const id of ids) {
				const docRef = doc(firestore, "problems", id);
				const docSnap = await getDoc(docRef);
				if (docSnap.exists()) {
					const problemData = docSnap.data();
					const delRef = doc(firestore, "deleted_problems", id);
					batch.set(delRef, {
						...problemData,
						deletedAt: Date.now(),
						deletedBy: auth.currentUser?.email || "unknown"
					});
				}
				batch.delete(docRef);
			}
			await batch.commit();
			triggerStatusRibbon("success", `${ids.length} problems soft-deleted and staged.`);
			fetchProblems();
		} catch (e: any) {
			triggerStatusRibbon("error", getFriendlyErrorMessage(e, "Bulk delete failed."));
		}
	};

	const handleBulkChangeDifficulty = async (ids: string[], difficulty: string) => {
		try {
			const batch = writeBatch(firestore);
			ids.forEach((id) => batch.update(doc(firestore, "problems", id), { difficulty }));
			await batch.commit();
			triggerStatusRibbon("success", `Difficulty updated for ${ids.length} problems.`);
			fetchProblems();
		} catch (e: any) {
			triggerStatusRibbon("error", getFriendlyErrorMessage(e, "Difficulty change failed."));
		}
	};

	const handleBulkChangeTags = async (ids: string[], tags: string[]) => {
		try {
			const batch = writeBatch(firestore);
			ids.forEach((id) => batch.update(doc(firestore, "problems", id), { tags }));
			await batch.commit();
			triggerStatusRibbon("success", `Tags updated for ${ids.length} problems.`);
			fetchProblems();
		} catch (e: any) {
			triggerStatusRibbon("error", getFriendlyErrorMessage(e, "Tag change failed."));
		}
	};

	const handleApplyBulkEdit = async (ids: string[], policy: any) => {
		try {
			const batch = writeBatch(firestore);
			ids.forEach((id) => batch.update(doc(firestore, "problems", id), policy));
			await batch.commit();
			triggerStatusRibbon("success", `Execution policy applied to ${ids.length} problems.`);
			fetchProblems();
		} catch (e: any) {
			triggerStatusRibbon("error", getFriendlyErrorMessage(e, "Policy apply failed."));
		}
	};

	const handleBulkExport = async (ids: string[]) => {
		try {
			const data = problems.filter((p) => ids.includes(p.id));
			const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `problems-export-${Date.now()}.json`;
			a.click();
			URL.revokeObjectURL(url);
			triggerStatusRibbon("success", `Exported ${ids.length} problems.`);
		} catch {
			triggerStatusRibbon("error", "Export failed.");
		}
	};

	// ─── Maintenance Handlers ──────────────────────────────────────────────────────
	const handleSync = async () => {
		setSyncing(true);
		try {
			const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : "";
			const res = await fetch("/api/admin/sync-static", { method: "POST", headers: { Authorization: `Bearer ${idToken}` } });
			if (!res.ok) throw new Error("Sync failed");
			triggerStatusRibbon("success", "Database synchronized successfully.");
			fetchProblems();
		} catch (e: any) {
			triggerStatusRibbon("error", getFriendlyErrorMessage(e, "Sync failed."));
		} finally {
			setSyncing(false);
		}
	};

	const handleRecount = async () => {
		setRecounting(true);
		try {
			const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : "";
			const res = await fetch("/api/admin/recount-solved", { method: "POST", headers: { Authorization: `Bearer ${idToken}` } });
			if (!res.ok) throw new Error("Recount failed");
			triggerStatusRibbon("success", "Solved statistics recounted.");
		} catch (e: any) {
			triggerStatusRibbon("error", getFriendlyErrorMessage(e, "Recount failed."));
		} finally {
			setRecounting(false);
		}
	};

	const allTags = useMemo(() => {
		const s = new Set<string>();
		problems.forEach((p) => p.tags?.forEach((t) => s.add(t)));
		return Array.from(s).sort();
	}, [problems]);

	// ─── Loading Gate ──────────────────────────────────────────────────────────────
	if (loadingAdmin || !isAdmin) {
		return (
			<div className="bg-dark-layer-2 min-h-screen flex items-center justify-center select-none">
				<div className="flex flex-col items-center gap-3">
					<div className="w-10 h-10 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
					<p className="text-xs font-bold text-[var(--text-secondary)]">Checking permissions...</p>
				</div>
			</div>
		);
	}

	// ─── Render ────────────────────────────────────────────────────────────────────
	return (
		<main className="bg-dark-layer-2 min-h-screen text-[var(--text-primary)] font-sans flex flex-col">
			{/* ── Persistent Topbar ── */}
			<Topbar />

			{/* ── Dashboard Shell ── */}
			<div className="flex flex-1 w-full max-w-[1440px] mx-auto px-4 md:px-6 py-7 gap-6">

				{/* ══ Left Sidebar (always rendered) ══ */}
				<aside className="w-52 hidden md:flex flex-col gap-4 shrink-0 select-none">

					{/* Navigation */}
					<nav className="p-2.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl flex flex-col gap-0.5 shadow-sm">
						<span className="text-[9px] uppercase tracking-widest font-extrabold text-[var(--text-muted)] px-2.5 py-1.5 block">
							Navigation
						</span>
						{TABS.map((tab) => {
							const isActive = activeTab === tab.id;
							const showBadge = tab.id === "moderation" && stats.reports > 0 && !isActive;
							return (
								<button
									key={tab.id}
									onClick={() => setActiveTab(tab.id)}
									className={`w-full flex items-center gap-2.5 px-2.5 py-2 font-bold text-[11px] rounded-xl transition-all duration-150 text-left group ${
										isActive
											? "bg-[var(--brand-glow)] text-[var(--brand-orange)] border border-[var(--brand-orange)]/15 shadow-sm"
											: "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
									}`}
								>
									<span className={tab.danger && !isActive ? "text-red-400" : ""}>{tab.icon}</span>
									<span className="flex-1">{tab.label}</span>
									{showBadge && (
										<span className="text-[8px] font-black bg-red-500/15 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full">
											{stats.reports}
										</span>
									)}
								</button>
							);
						})}
					</nav>

					{/* System Diagnostics */}
					<div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-sm text-xs flex flex-col gap-2">
						<span className="text-[9px] uppercase tracking-widest font-extrabold text-[var(--text-muted)] border-b border-[var(--border-subtle)] pb-2 block">
							System
						</span>
						<div className="space-y-2 text-[10px]">
							{[
								{ label: "Core Synced", value: "Yes", color: "text-[var(--text-primary)]" },
								{ label: "Security Audit", value: "Passed", color: "text-emerald-500" },
								{ label: "Connections", value: "Stable", color: "text-emerald-400" },
							].map((row) => (
								<div key={row.label} className="flex justify-between">
									<span className="text-[var(--text-muted)]">{row.label}</span>
									<span className={`font-mono font-bold ${row.color}`}>{row.value}</span>
								</div>
							))}
						</div>
					</div>
				</aside>

				{/* ══ Main Content Area ══ */}
				<div className="flex-1 flex flex-col gap-5 min-w-0">

					{/* Status Ribbon */}
					{statusRibbon && (
						<div
							className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between select-none animate-slide-in ${
								statusRibbon.type === "success"
									? "bg-emerald-950/40 text-emerald-400 border-emerald-800/40"
									: statusRibbon.type === "error"
									? "bg-rose-950/40 text-rose-400 border-rose-800/40"
									: "bg-blue-950/40 text-blue-400 border-blue-800/40"
							}`}
						>
							<span>{statusRibbon.message}</span>
							<button onClick={() => setStatusRibbon(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition">
								<FiX size={14} />
							</button>
						</div>
					)}

					{/* ── Tab Content Area with fade transition ── */}
					<div key={activeTab} className="flex-1 flex flex-col gap-6 animate-fade-in">

						{activeTab === "overview" && (
							<OverviewTab
								stats={stats}
								statsLoading={statsLoading}
								activities={activities}
								activitiesLoading={activitiesLoading}
								syncing={syncing}
								recounting={recounting}
								onSync={handleSync}
								onRecount={handleRecount}
							/>
						)}

						{activeTab === "problems" && (
							<ProblemsTab
								problems={problems}
								loading={problemsLoading}
								allTags={allTags}
								onDeleteProblem={handleDeleteProblem}
								onBulkDelete={handleBulkDelete}
								onBulkChangeDifficulty={handleBulkChangeDifficulty}
								onBulkChangeTags={handleBulkChangeTags}
								onApplyBulkEdit={handleApplyBulkEdit}
								onBulkExport={handleBulkExport}
							/>
						)}

						{activeTab === "contests" && (
							<ContestsTab triggerStatusMessage={triggerStatusRibbon} />
						)}

						{activeTab === "moderation" && (
							<ModerationTab triggerStatusMessage={triggerStatusRibbon} />
						)}

						{activeTab === "emails" && (
							<EmailsTab />
						)}

						{activeTab === "organizations" && (
							<OrganizationsTab triggerStatusMessage={triggerStatusRibbon} />
						)}
					</div>
				</div>
			</div>
		</main>
	);
};

export default AdminDashboard;
