import React, { useEffect, useState, useCallback } from "react";
import { getServerTime, getContestStatus, syncContestStatus } from "@/utils/contestStatusService";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAdmin } from "@/hooks/useAdmin";
import Topbar from "@/components/Topbar/Topbar";
import {
	collection, getDocs, doc, getDoc, setDoc, deleteDoc,
	query, orderBy, writeBatch, updateDoc, where
} from "firebase/firestore";
import { firestore } from "@/firebase/firebase";
import { getFriendlyErrorMessage } from "@/utils/errorFilter";
import {
	FaEdit, FaTrash, FaPlus, FaClone, FaArchive,
	FaSpinner, FaLock, FaGlobe, FaSearch, FaHistory
} from "react-icons/fa";

interface ContestListItem {
	id: string; // Slug
	title: string;
	description: string;
	startTime: number;
	endTime: number;
	duration: number;
	visibility: string;
	securityLevel: string;
	status: string;
	createdAt: number;
	leaderboardFreeze: number;
	registrationEnabled: boolean;
}

const AdminContestsDashboard: React.FC = () => {
	const router = useRouter();
	const [isAdmin, loadingAdmin] = useAdmin();
	const [contests, setContests] = useState<ContestListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [cloningId, setCloningId] = useState<string | null>(null);
	const [contestToDelete, setContestToDelete] = useState<ContestListItem | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");

	const [statusRibbon, setStatusRibbon] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

	const triggerStatusRibbon = (type: "success" | "error" | "info", message: string, duration = 4000) => {
		setStatusRibbon({ type, message });
		if (duration > 0) {
			setTimeout(() => {
				setStatusRibbon((prev) => prev?.message === message ? null : prev);
			}, duration);
		}
	};

	const fetchContests = useCallback(async () => {
		setLoading(true);
		try {
			const q = query(collection(firestore, "contests"), orderBy("createdAt", "desc"));
			const querySnapshot = await getDocs(q);
			const list: ContestListItem[] = [];
			const now = getServerTime();
			querySnapshot.forEach((doc) => {
				const data = doc.data();
				const contestData = {
					id: doc.id,
					startTime: data.startTime || 0,
					endTime: data.endTime || 0,
					leaderboardFreeze: data.leaderboardFreeze || 0,
					status: data.status || "draft",
					registrationEnabled: data.registrationEnabled !== false,
				};

				const computedStatus = getContestStatus(contestData, now);

				// Sync database in background if status drifted
				if (data.status !== computedStatus) {
					syncContestStatus(doc.id, data.status || "draft", computedStatus);
				}

				list.push({
					id: doc.id,
					title: data.title || doc.id,
					description: data.description || "",
					startTime: contestData.startTime,
					endTime: contestData.endTime,
					duration: data.duration || 120,
					visibility: data.visibility || "public",
					securityLevel: data.securityLevel || "standard",
					status: computedStatus,
					createdAt: data.createdAt || 0,
					leaderboardFreeze: contestData.leaderboardFreeze,
					registrationEnabled: contestData.registrationEnabled
				});
			});
			setContests(list);
		} catch (error: any) {
			console.error("Error fetching contests:", error);
			triggerStatusRibbon("error", "Failed to load contests.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (!loadingAdmin && !isAdmin) {
			router.push("/");
		}
	}, [isAdmin, loadingAdmin, router]);

	useEffect(() => {
		if (isAdmin) {
			fetchContests();
		}
	}, [isAdmin, fetchContests]);

	// Auto-transition contests dynamically in-memory every 5 seconds
	useEffect(() => {
		if (contests.length === 0) return;

		const interval = setInterval(() => {
			const now = getServerTime();
			let hasChanges = false;
			const updated = contests.map((c) => {
				const contestData = {
					id: c.id,
					startTime: c.startTime,
					endTime: c.endTime,
					leaderboardFreeze: c.leaderboardFreeze || 0,
					status: c.status,
					registrationEnabled: c.registrationEnabled,
				};
				const computed = getContestStatus(contestData, now);
				if (computed !== c.status) {
					hasChanges = true;
					syncContestStatus(c.id, c.status, computed);
					return { ...c, status: computed };
				}
				return c;
			});

			if (hasChanges) {
				setContests(updated);
			}
		}, 5000);

		return () => clearInterval(interval);
	}, [contests]);

	// Archive Contest
	const handleArchive = async (id: string) => {
		try {
			const contestRef = doc(firestore, "contests", id);
			await updateDoc(contestRef, { status: "archived" });
			triggerStatusRibbon("success", "Contest status set to Archived");
			fetchContests();
		} catch (error: any) {
			console.error("Error archiving contest:", error);
			triggerStatusRibbon("error", "Failed to archive contest.");
		}
	};

	// Clone Contest
	const handleClone = async (original: ContestListItem) => {
		setCloningId(original.id);
		triggerStatusRibbon("info", `Cloning contest "${original.title}"...`, 0);

		try {
			const uniqueId = Math.random().toString(36).substring(2, 6);
			const newId = `${original.id}-clone-${uniqueId}`;
			const newTitle = `${original.title} (Clone)`;

			const originalDoc = await getDoc(doc(firestore, "contests", original.id));
			if (!originalDoc.exists()) {
				triggerStatusRibbon("error", "Original contest not found.");
				setCloningId(null);
				return;
			}

			const origData = originalDoc.data();
			const clonedContestData = {
				...origData,
				id: newId,
				title: newTitle,
				status: "draft",
				createdAt: Date.now()
			};

			// 1. Save new contest
			await setDoc(doc(firestore, "contests", newId), clonedContestData);

			// 2. Clone associated contest problems
			const cpQuery = query(collection(firestore, "contest_problems"), where("contestId", "==", original.id));
			const cpSnapshot = await getDocs(cpQuery);
			
			const batch = writeBatch(firestore);
			cpSnapshot.forEach((docSnap) => {
				const cpData = docSnap.data();
				const newCpId = `${newId}_${cpData.problemId}`;
				const cpRef = doc(firestore, "contest_problems", newCpId);
				batch.set(cpRef, {
					...cpData,
					id: newCpId,
					contestId: newId
				});
			});
			await batch.commit();

			// 3. Initialize blank statistics
			const statsRef = doc(firestore, "contest_statistics", newId);
			await setDoc(statsRef, {
				id: newId,
				participantsCount: 0,
				submissionsCount: 0,
				averageScore: 0,
				solveRates: {},
				mostDifficultProblem: "",
				fastestAccepted: {}
			});

			triggerStatusRibbon("success", `Contest cloned successfully as "${newTitle}"!`);
			fetchContests();
		} catch (error: any) {
			console.error("Error cloning contest:", error);
			triggerStatusRibbon("error", getFriendlyErrorMessage(error, "Cloning failed. Please try again."));
		} finally {
			setCloningId(null);
		}
	};

	// Delete Contest
	const handleConfirmDelete = async () => {
		if (!contestToDelete) return;
		try {
			// 1. Delete contest doc
			await deleteDoc(doc(firestore, "contests", contestToDelete.id));

			// 2. Delete contest problems mapping
			const cpQuery = query(collection(firestore, "contest_problems"), where("contestId", "==", contestToDelete.id));
			const cpSnapshot = await getDocs(cpQuery);
			const batch = writeBatch(firestore);
			cpSnapshot.forEach((docSnap) => {
				batch.delete(doc(firestore, "contest_problems", docSnap.id));
			});
			await batch.commit();

			// 3. Delete statistics
			await deleteDoc(doc(firestore, "contest_statistics", contestToDelete.id));

			triggerStatusRibbon("success", "Contest deleted successfully");
			setContestToDelete(null);
			fetchContests();
		} catch (error: any) {
			console.error("Error deleting contest:", error);
			triggerStatusRibbon("error", "Failed to delete contest.");
		}
	};

	// Filter and Search logic
	const filteredContests = contests.filter((c) => {
		const matchesSearch =
			c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			c.id.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesStatus = statusFilter === "all" || c.status === statusFilter;
		return matchesSearch && matchesStatus;
	});

	if (loadingAdmin || !isAdmin) {
		return (
			<div className='bg-dark-layer-2 min-h-screen text-white flex items-center justify-center'>
				<div className='text-xl font-semibold animate-pulse'>Checking credentials...</div>
			</div>
		);
	}

	return (
		<main className='bg-dark-layer-2 min-h-screen text-white font-sans'>
			<Topbar />
			<div className='max-w-[1200px] mx-auto px-6 py-10'>
				
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

				<div className='flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4'>
					<div>
						<h1 className='text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-brand-orange to-yellow-500'>
							Manage Contests
						</h1>
						<p className='text-gray-400 mt-1 text-sm'>
							Create, configure, clone, and monitor competitive programming contests.
						</p>
					</div>

					<div className='flex gap-3'>
						<Link
							href='/admin'
							className='flex items-center gap-2 bg-dark-fill-3 hover:bg-dark-fill-2 text-gray-300 px-4 py-2 rounded-lg font-medium transition duration-200 border border-border-default'
						>
							Manage Challenges
						</Link>
						<Link
							href='/admin/contests/new'
							className='flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-s text-white px-4 py-2 rounded-lg font-medium transition duration-200 shadow-md'
						>
							<FaPlus />
							Create Contest
						</Link>
					</div>
				</div>

				{/* Search & Filter bar */}
				<div className='flex flex-col sm:flex-row gap-4 mb-6 items-center justify-between'>
					{/* Search */}
					<div className='relative w-full sm:max-w-xs'>
						<FaSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-500' size={12} />
						<input
							type='text'
							placeholder='Search contests...'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className='w-full pl-9 pr-4 py-2 text-sm rounded-xl outline-none border border-border-default bg-dark-layer-1 focus:border-brand-orange'
						/>
					</div>

					{/* Filter status */}
					<div className='flex gap-2 w-full sm:w-auto justify-end'>
						{["all", "draft", "scheduled", "running", "ended", "archived"].map((st) => (
							<button
								key={st}
								onClick={() => setStatusFilter(st)}
								className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize border transition ${
									statusFilter === st
										? "bg-brand-orange/15 border-brand-orange text-brand-orange"
										: "border-border-default bg-dark-fill-3 text-gray-400 hover:text-white"
								}`}
							>
								{st}
							</button>
						))}
					</div>
				</div>

				{loading ? (
					<div className='flex flex-col justify-center items-center py-20 gap-4'>
						<div className='w-12 h-12 border-4 border-brand-orange border-t-transparent rounded-full animate-spin'></div>
						<div className='text-gray-400'>Loading contests...</div>
					</div>
				) : filteredContests.length === 0 ? (
					<div className='text-center py-20 rounded-xl border border-border-default' style={{ backgroundColor: "var(--bg-surface)" }}>
						<p className='text-lg mb-4 text-gray-400'>No contests found.</p>
						<Link
							href='/admin/contests/new'
							className='bg-brand-orange hover:bg-brand-orange-s text-white px-6 py-2 rounded-lg font-medium transition'
						>
							Create First Contest
						</Link>
					</div>
				) : (
					<div className='rounded-xl overflow-hidden shadow-xl border border-border-default' style={{ backgroundColor: "var(--bg-surface)" }}>
						<div className='overflow-x-auto'>
							<table className='w-full text-sm text-left text-gray-300'>
								<thead>
									<tr style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-dark-layer-1)" }}>
										<th className='px-6 py-4'>Title</th>
										<th className='px-6 py-4 w-40'>Schedule</th>
										<th className='px-6 py-4 w-28'>Visibility</th>
										<th className='px-6 py-4 w-28'>Security</th>
										<th className='px-6 py-4 w-28'>Status</th>
										<th className='px-6 py-4 w-40 text-right'>Actions</th>
									</tr>
								</thead>
								<tbody className='divide-y divide-border-subtle'>
									{filteredContests.map((c) => {
										const statusColor =
											c.status === "running" ? "text-emerald-400 bg-emerald-400/10" :
											c.status === "frozen" ? "text-cyan-400 bg-cyan-400/10" :
											c.status === "scheduled" || c.status === "registration_open" ? "text-blue-400 bg-blue-400/10" :
											c.status === "draft" ? "text-gray-400 bg-gray-400/10" :
											"text-amber-400 bg-amber-400/10";
										return (
											<tr key={c.id} className='hover:bg-dark-fill-3 transition'>
												<td className='px-6 py-4 font-semibold text-white'>
													<Link
														href={`/admin/contests/${c.id}/edit`}
														className='hover:text-brand-orange transition'
													>
														{c.title}
													</Link>
													<p className='text-[10px] text-gray-500 font-mono mt-0.5'>{c.id}</p>
												</td>
												<td className='px-6 py-4 text-xs space-y-0.5'>
													<p><span className='text-gray-500'>Start:</span> {new Date(c.startTime).toLocaleDateString()} {new Date(c.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
													<p><span className='text-gray-500'>Dur:</span> {c.duration} mins</p>
												</td>
												<td className='px-6 py-4'>
													<span className='flex items-center gap-1.5 text-xs font-semibold capitalize'>
														{c.visibility === "public" ? <FaGlobe className='text-emerald-400' /> : <FaLock className='text-yellow-400' />}
														{c.visibility}
													</span>
												</td>
												<td className='px-6 py-4 text-xs font-semibold capitalize'>{c.securityLevel}</td>
												<td className='px-6 py-4'>
													<span className={`px-2.5 py-1 rounded text-xs font-bold capitalize ${statusColor}`}>
														{c.status}
													</span>
												</td>
												<td className='px-6 py-4 text-right'>
													<div className='flex justify-end gap-1.5'>
														<Link
															href={`/admin/contests/${c.id}/edit`}
															className='p-2 hover:bg-dark-fill-2 text-blue-400 hover:text-blue-300 rounded transition'
															title='Edit Contest'
														>
															<FaEdit />
														</Link>
														<button
															type='button'
															onClick={() => handleClone(c)}
															disabled={cloningId === c.id}
															className='p-2 hover:bg-dark-fill-2 text-indigo-400 hover:text-indigo-300 rounded transition disabled:opacity-50'
															title='Clone Contest'
														>
															{cloningId === c.id ? <FaSpinner className='animate-spin' /> : <FaClone />}
														</button>
														{c.status !== "archived" && c.status !== "draft" && (
															<button
																type='button'
																onClick={() => handleArchive(c.id)}
																className='p-2 hover:bg-dark-fill-2 text-amber-400 hover:text-amber-300 rounded transition'
																title='Archive Contest'
															>
																<FaArchive />
															</button>
														)}
														<button
															type='button'
															onClick={() => setContestToDelete(c)}
															className='p-2 hover:bg-dark-fill-2 text-red-400 hover:text-red-300 rounded transition'
															title='Delete Contest'
														>
															<FaTrash />
														</button>
													</div>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</div>
				)}
			</div>

			{/* Delete Contest Modal */}
			{contestToDelete && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm'>
					<div className='bg-dark-layer-1 border border-border-default rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl'>
						<h3 className='text-xl font-bold text-white mb-2'>Delete Contest</h3>
						<p className='text-gray-400 text-sm mb-6'>
							Are you sure you want to delete contest <span className='text-brand-orange font-semibold'>&quot;{contestToDelete.title}&quot;</span>? This will remove the contest and all associated problem parameters and submissions. This action is permanent.
						</p>
						<div className='flex justify-end gap-3'>
							<button
								type='button'
								onClick={() => setContestToDelete(null)}
								className='px-4 py-2 bg-dark-fill-3 hover:bg-dark-fill-2 text-gray-300 rounded-lg text-sm font-medium transition duration-200'
							>
								Cancel
							</button>
							<button
								type='button'
								onClick={handleConfirmDelete}
								className='px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition duration-200 shadow-md'
							>
								Delete Contest
							</button>
						</div>
					</div>
				</div>
			)}
		</main>
	);
};

export default AdminContestsDashboard;
