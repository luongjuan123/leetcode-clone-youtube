import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAdmin } from "@/hooks/useAdmin";
import Topbar from "@/components/Topbar/Topbar";
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, query, orderBy, writeBatch } from "firebase/firestore";
import { firestore, auth } from "@/firebase/firebase";
import { getFriendlyErrorMessage } from "@/utils/errorFilter";
import { problems as staticProblems } from "@/utils/problems";
import { problems as mockProblems } from "@/mockProblems/problems";
import { FaEdit, FaTrash, FaPlus, FaSync, FaDatabase, FaSpinner } from "react-icons/fa";

interface ProblemListItem {
	id: string;
	title: string;
	tags: string[];
	difficulty: string;
	isStatic: boolean;
}

const AdminDashboard: React.FC = () => {
	const router = useRouter();
	const [isAdmin, loadingAdmin] = useAdmin();
	const [problems, setProblems] = useState<ProblemListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [syncing, setSyncing] = useState(false);
	const [recounting, setRecounting] = useState(false);
	const [problemToDelete, setProblemToDelete] = useState<string | null>(null);

	const [statusRibbon, setStatusRibbon] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

	// Bulk edit states
	const [selectedProblemIds, setSelectedProblemIds] = useState<string[]>([]);
	const [showBulkModal, setShowBulkModal] = useState(false);
	const [bulkProfile, setBulkProfile] = useState("normal");
	const [bulkTimeoutMs, setBulkTimeoutMs] = useState(5000);
	const [bulkMemoryLimitMb, setBulkMemoryLimitMb] = useState(256);
	const [bulkMaxOutputSizeChars, setBulkMaxOutputSizeChars] = useState(65536);
	const [bulkCpuCount, setBulkCpuCount] = useState(1);
	const [bulkDiskLimitMb, setBulkDiskLimitMb] = useState(50);
	const [bulkProcessLimit, setBulkProcessLimit] = useState(15);
	const [bulkSubmitting, setBulkSubmitting] = useState(false);

	const handleApplyBulkEdit = async () => {
		if (selectedProblemIds.length === 0) return;
		setBulkSubmitting(true);
		triggerStatusRibbon("info", `Applying execution policy to ${selectedProblemIds.length} problems...`, 0);
		try {
			const batch = writeBatch(firestore);
			selectedProblemIds.forEach((pid) => {
				const docRef = doc(firestore, "problems", pid);
				batch.update(docRef, {
					executionProfile: bulkProfile,
					customTimeoutMs: Number(bulkTimeoutMs) || 5000,
					customMemoryLimitMb: Number(bulkMemoryLimitMb) || 256,
					customMaxOutputSizeChars: Number(bulkMaxOutputSizeChars) || 65536,
					customCpuCount: Number(bulkCpuCount) || 1,
					customDiskLimitMb: Number(bulkDiskLimitMb) || 50,
					customProcessLimit: Number(bulkProcessLimit) || 15,
				});
			});
			await batch.commit();
			triggerStatusRibbon("success", `Successfully updated execution policy for ${selectedProblemIds.length} problem(s).`);
			setSelectedProblemIds([]);
			setShowBulkModal(false);
			fetchProblems();
		} catch (error: any) {
			console.error("Bulk edit error:", error);
			triggerStatusRibbon("error", getFriendlyErrorMessage(error, "Failed to apply bulk execution policy. Please try again."));
		} finally {
			setBulkSubmitting(false);
		}
	};

	const triggerStatusRibbon = (type: "success" | "error" | "info", message: string, duration = 4000) => {
		setStatusRibbon({ type, message });
		if (duration > 0) {
			setTimeout(() => {
				setStatusRibbon((prev) => prev?.message === message ? null : prev);
			}, duration);
		}
	};

	useEffect(() => {
		if (!loadingAdmin && !isAdmin) {
			router.push("/");
		}
	}, [isAdmin, loadingAdmin, router]);

	const fetchProblems = useCallback(async () => {
		setLoading(true);
		try {
			// Get problems in Firestore
			const q = query(collection(firestore, "problems"));
			const querySnapshot = await getDocs(q);
			const dbProblems: Record<string, any> = {};
			querySnapshot.forEach((doc) => {
				dbProblems[doc.id] = { id: doc.id, ...doc.data() };
			});

			const list: ProblemListItem[] = [];

			// 1. Add all problems in DB
			Object.keys(dbProblems).forEach((id) => {
				const dbTags = dbProblems[id].tags && Array.isArray(dbProblems[id].tags) && dbProblems[id].tags.length > 0
					? dbProblems[id].tags
					: (dbProblems[id].category ? [dbProblems[id].category] : ["Array"]);
				list.push({
					id,
					title: dbProblems[id].title || id,
					tags: dbTags,
					difficulty: dbProblems[id].difficulty || "Easy",
					isStatic: id in staticProblems,
				});
			});

			// Sort by title
			list.sort((a, b) => a.title.localeCompare(b.title));
			setProblems(list);
		} catch (error: any) {
			console.error("Error fetching problems:", error);
			triggerStatusRibbon("error", "Failed to load problems. Please try again.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (isAdmin) {
			fetchProblems();
		}
	}, [isAdmin, fetchProblems]);

	const handleSync = async () => {
		setSyncing(true);
		triggerStatusRibbon("info", "Syncing static problems to Firestore...", 0);
		try {
			let added = 0;
			let skipped = 0;

			// Fetch deleted static problems list
			const deletedSnapshot = await getDocs(collection(firestore, "deleted_problems"));
			const deletedIds = new Set<string>();
			deletedSnapshot.forEach((docSnap) => {
				deletedIds.add(docSnap.id);
			});

			for (const id of Object.keys(staticProblems)) {
				// Skip if problem was manually deleted by admin
				if (deletedIds.has(id)) {
					skipped++;
					continue;
				}

				// Only add if NOT already in Firestore (respect manual deletions)
				const existing = await getDoc(doc(firestore, "problems", id));
				if (existing.exists()) {
					skipped++;
					continue;
				}

				const staticProb = staticProblems[id];
				const mockProb = mockProblems.find((p) => p.id === id);

				const docData = {
					id,
					title: staticProb.title,
					tags: mockProb?.category ? [mockProb.category] : ["Array"],
					difficulty: mockProb?.difficulty || "Easy",
					videoId: mockProb?.videoId || "",
					likes: 0,
					dislikes: 0,
					problemStatement: staticProb.problemStatement,
					examples: staticProb.examples,
					constraints: staticProb.constraints,
					starterCode: staticProb.starterCode,
					starterFunctionName: staticProb.starterFunctionName,
					handlerFunction: staticProb.handlerFunction.toString(),
				};

				await setDoc(doc(firestore, "problems", id), docData);
				added++;
			}
			if (added > 0) {
				triggerStatusRibbon("success", `Synced ${added} new problem(s). ${skipped} already existed (skipped).`);
			} else {
				triggerStatusRibbon("info", `No new problems to sync. ${skipped} already in database.`);
			}
			fetchProblems();
		} catch (error: any) {
			console.error("Error syncing:", error);
			triggerStatusRibbon("error", "Sync failed. Please check database configuration.");
		} finally {
			setSyncing(false);
		}
	};

	/**
	 * Recount solved stats:
	 * Fetches all currently valid problem IDs from Firestore,
	 * then for every user, strips deleted problem IDs from their
	 * solvedProblems array and writes the cleaned list back.
	 * Requires isAdmin == true in Firestore (enforced by security rules).
	 */
	const handleRecountSolved = async () => {
		setRecounting(true);
		triggerStatusRibbon("info", "Recounting and seeding solved stats for all users server-side...", 0);
		try {
			const idToken = await auth.currentUser?.getIdToken();
			if (!idToken) throw new Error("Please log in again.");

			const res = await fetch("/api/recount-solved", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ idToken }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Recount failed");

			triggerStatusRibbon(
				"success",
				`Done! Recounted, seeded ratings/countries, and updated stats for ${data.usersUpdated} user(s). Valid problems in DB: ${data.validProblemCount}`
			);
		} catch (error: any) {
			console.error("Recount error:", error);
			triggerStatusRibbon("error", getFriendlyErrorMessage(error, "Recount failed. Please try again."));
		} finally {
			setRecounting(false);
		}
	};

	const handleDeleteClick = (id: string) => {
		setProblemToDelete(id);
	};

	const handleConfirmDelete = async () => {
		if (!problemToDelete) return;
		try {
			await deleteDoc(doc(firestore, "problems", problemToDelete));

			// If it's a static problem, track it so sync doesn't recreate it
			const prob = problems.find((p) => p.id === problemToDelete);
			if (prob?.isStatic) {
				await setDoc(doc(firestore, "deleted_problems", problemToDelete), {
					deletedAt: Date.now(),
				});
			}

			triggerStatusRibbon("success", "Problem deleted successfully");
			setProblemToDelete(null);
			fetchProblems();
		} catch (error: any) {
			console.error("Error deleting problem:", error);
			triggerStatusRibbon("error", "Failed to delete problem. Please try again.");
		}
	};

	if (loadingAdmin || !isAdmin) {
		return (
			<div className='bg-dark-layer-2 min-h-screen text-white flex items-center justify-center'>
				<div className='text-xl font-semibold animate-pulse'>Checking credentials...</div>
			</div>
		);
	}

	return (
		<main className='bg-dark-layer-2 min-h-screen text-white'>
			<Topbar />
			<div className='max-w-[1200px] mx-auto px-6 py-10'>
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
				<div className='flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4'>
					<div>
						<h1 className='text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-brand-orange to-yellow-500'>
							Admin Dashboard
						</h1>
						<p className='text-gray-400 mt-1 text-sm'>
							Manage coding problems, test cases, and starter code templates.
						</p>
					</div>

					<div className='flex flex-wrap gap-3'>
						<Link
							href='/admin/contests'
							className='flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition duration-200 shadow-md'
						>
							Manage Contests
						</Link>
						<button
							onClick={handleRecountSolved}
							disabled={recounting}
							title='Remove deleted problem IDs from every user&#39;s solvedProblems array in Firestore'
							className='flex items-center gap-2 bg-dark-fill-3 hover:bg-dark-fill-2 text-green-400 px-4 py-2 rounded-lg font-medium transition duration-200 border border-green-500/30 disabled:opacity-50'
						>
							<FaDatabase className={recounting ? "animate-pulse" : ""} />
							{recounting ? "Recounting..." : "Recount Solved Stats"}
						</button>
						<button
							onClick={handleSync}
							disabled={syncing}
							className='flex items-center gap-2 bg-dark-fill-3 hover:bg-dark-fill-2 text-brand-orange px-4 py-2 rounded-lg font-medium transition duration-200 border border-brand-orange/30 disabled:opacity-50'
						>
							<FaSync className={syncing ? "animate-spin" : ""} />
							Sync Static Problems
						</button>
						{selectedProblemIds.length > 0 && (
							<button
								onClick={() => setShowBulkModal(true)}
								className='flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-s text-white px-4 py-2 rounded-lg font-medium transition duration-200 shadow-md animate-scale-up border border-brand-orange'
								style={{ boxShadow: "var(--shadow-glow-sm)" }}
							>
								Bulk Edit Policy ({selectedProblemIds.length})
							</button>
						)}
						<Link
							href='/admin/problems/new'
							className='flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-s text-white px-4 py-2 rounded-lg font-medium transition duration-200 shadow-md'
						>
							<FaPlus />
							Add Problem
						</Link>
					</div>
				</div>

				{loading ? (
					<div className='flex flex-col justify-center items-center py-20 gap-4'>
						<div className='w-12 h-12 border-4 border-brand-orange border-t-transparent rounded-full animate-spin'></div>
						<div className='text-gray-400' style={{ color: "var(--text-secondary)" }}>Loading problems...</div>
					</div>
				) : problems.length === 0 ? (
					<div className='text-center py-20 rounded-xl border' style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
						<p className='text-lg mb-4' style={{ color: "var(--text-secondary)" }}>No problems found in the database.</p>
						<button
							onClick={handleSync}
							className='bg-brand-orange hover:bg-brand-orange-s text-white px-6 py-2 rounded-lg font-medium transition'
						>
							Sync/Seed Problems
						</button>
					</div>
				) : (
					<div className='rounded-xl overflow-hidden shadow-xl' style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
						<div className='overflow-x-auto'>
							<table className='w-full text-sm text-left' style={{ color: "var(--text-secondary)" }}>
								<thead>
									<tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
										<th scope='col' className='px-6 py-4 w-12'>
											<input
												type='checkbox'
												checked={problems.length > 0 && selectedProblemIds.length === problems.length}
												onChange={(e) => {
													if (e.target.checked) {
														setSelectedProblemIds(problems.map((p) => p.id));
													} else {
														setSelectedProblemIds([]);
													}
												}}
												className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 shadow-sm'
											/>
										</th>
										<th scope='col' className='px-6 py-4'>
											<span className='text-[10px] font-bold uppercase tracking-widest' style={{ color: "var(--text-muted)" }}>Title</span>
										</th>
										<th scope='col' className='px-6 py-4 w-32'>
											<span className='text-[10px] font-bold uppercase tracking-widest' style={{ color: "var(--text-muted)" }}>Tags</span>
										</th>
										<th scope='col' className='px-6 py-4 w-28'>
											<span className='text-[10px] font-bold uppercase tracking-widest' style={{ color: "var(--text-muted)" }}>Difficulty</span>
										</th>
										<th scope='col' className='px-6 py-4 w-28'>
											<span className='text-[10px] font-bold uppercase tracking-widest' style={{ color: "var(--text-muted)" }}>Type</span>
										</th>
										<th scope='col' className='px-6 py-4 w-28 text-right'>
											<span className='text-[10px] font-bold uppercase tracking-widest' style={{ color: "var(--text-muted)" }}>Actions</span>
										</th>
									</tr>
								</thead>
								<tbody className='divide-y divide-border-subtle'>
									{problems.map((problem) => {
										const diffColor =
											problem.difficulty === "Easy"
												? { color: "var(--color-success)", bg: "color-mix(in srgb, var(--color-success) 10%, transparent)", border: "color-mix(in srgb, var(--color-success) 25%, transparent)" }
												: problem.difficulty === "Medium"
												? { color: "var(--color-warning)", bg: "color-mix(in srgb, var(--color-warning) 10%, transparent)", border: "color-mix(in srgb, var(--color-warning) 25%, transparent)" }
												: { color: "var(--color-error)", bg: "color-mix(in srgb, var(--color-error) 10%, transparent)", border: "color-mix(in srgb, var(--color-error) 25%, transparent)" };
										return (
											<tr key={problem.id} className='hover:bg-dark-fill-3 transition'>
												<td className='px-6 py-4 w-12'>
													<input
														type='checkbox'
														checked={selectedProblemIds.includes(problem.id)}
														onChange={(e) => {
															if (e.target.checked) {
																setSelectedProblemIds((prev) => [...prev, problem.id]);
															} else {
																setSelectedProblemIds((prev) => prev.filter((id) => id !== problem.id));
															}
														}}
														className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 shadow-sm'
													/>
												</td>
												<td className='px-6 py-4 font-medium text-white'>
													<Link
														href={`/problems/${problem.id}`}
														className='hover:text-brand-orange transition'
														target='_blank'
													>
														{problem.title}
													</Link>
												</td>
												<td className='px-6 py-4'>
													<div className='flex flex-wrap gap-1'>
														{problem.tags.map((t) => (
															<span
																key={t}
																className='text-[10px] px-1.5 py-0.5 rounded font-bold'
																style={{
																	background: "var(--bg-dark-fill-3)",
																	color: "var(--text-secondary)",
																	border: "1px solid var(--border-subtle)",
																}}
															>
																{t}
															</span>
														))}
													</div>
												</td>
												<td className='px-6 py-4'>
													<span
														className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border'
														style={{
															color: diffColor.color,
															background: diffColor.bg,
															borderColor: diffColor.border,
														}}
													>
														{problem.difficulty}
													</span>
												</td>
												<td className='px-6 py-4'>
													{problem.isStatic ? (
														<span className='text-xs text-gray-500 bg-gray-500/10 px-2 py-1 rounded'>
															Static / Core
														</span>
													) : (
														<span className='text-xs text-brand-orange bg-brand-orange/10 px-2 py-1 rounded'>
															Database Only
														</span>
													)}
												</td>
												<td className='px-6 py-4 text-right'>
													<div className='flex justify-end gap-2'>
														<Link
															href={`/admin/problems/${problem.id}`}
															className='p-2 hover:bg-dark-fill-2 text-blue-400 hover:text-blue-300 rounded transition'
															title='Edit Problem'
														>
															<FaEdit />
														</Link>
														<button
															type='button'
															onClick={() => handleDeleteClick(problem.id)}
															className='p-2 hover:bg-dark-fill-2 text-red-400 hover:text-red-300 rounded transition'
															title='Delete Problem'
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

			{problemToDelete && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn'>
					<div className='bg-dark-layer-1 border border-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl transform scale-100 transition-all duration-300'>
						<h3 className='text-xl font-bold text-white mb-2'>Delete Problem</h3>
						<p className='text-gray-400 text-sm mb-6'>
							Are you sure you want to delete problem <span className='text-brand-orange font-semibold'>&quot;{problemToDelete}&quot;</span>? This action is permanent and cannot be undone.
						</p>
						<div className='flex justify-end gap-3'>
							<button
								type='button'
								onClick={() => setProblemToDelete(null)}
								className='px-4 py-2 bg-dark-fill-3 hover:bg-dark-fill-2 text-gray-300 rounded-lg text-sm font-medium transition duration-200'
							>
								Cancel
							</button>
							<button
								type='button'
								onClick={handleConfirmDelete}
								className='px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition duration-200 shadow-md shadow-red-900/30'
							>
								Delete
							</button>
						</div>
					</div>
				</div>
			)}

			{showBulkModal && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn'>
					<div className='bg-dark-layer-1 border border-gray-800 rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-2xl transform scale-100 transition-all duration-300' style={{ background: "var(--bg-dark-layer-1)", borderColor: "var(--border-default)" }}>
						<h3 className='text-xl font-bold text-white mb-2' style={{ color: "var(--text-primary)" }}>Bulk Edit Execution Policy</h3>
						<p className='text-gray-400 text-xs mb-6' style={{ color: "var(--text-muted)" }}>
							Update execution profiles and resource limits for the <span className='text-brand-orange font-bold'>{selectedProblemIds.length}</span> selected problem(s).
						</p>

						<div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-6'>
							<div>
								<label htmlFor='bulkProfile' className='text-xs font-bold block mb-2' style={{ color: "var(--text-secondary)" }}>
									Execution Profile
								</label>
								<select
									id='bulkProfile'
									value={bulkProfile}
									onChange={(e) => setBulkProfile(e.target.value)}
									className='border outline-none rounded p-2 text-xs w-full focus:border-brand-orange transition shadow-sm'
									style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
								>
									<option value='fast'>Fast (Short algorithmic problems)</option>
									<option value='normal'>Normal (Standard competitive programming)</option>
									<option value='long'>Long (Heavy computations)</option>
									<option value='machine_learning'>Machine Learning (Model training / AI challenges)</option>
									<option value='custom'>Custom (Expose individual limits)</option>
								</select>
							</div>

							{/* Preview */}
							<div className='p-4 rounded-lg border' style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)" }}>
								<span className='text-xs font-bold uppercase block mb-3' style={{ color: "var(--brand-orange)" }}>
									Effective Limits Preview
								</span>
								<div className='grid grid-cols-2 gap-y-1.5 text-xs'>
									<div style={{ color: "var(--text-secondary)" }}>Timeout:</div>
									<div className='font-mono font-bold' style={{ color: "var(--text-primary)" }}>
										{bulkProfile === "custom" ? bulkTimeoutMs : (bulkProfile === "fast" ? 1000 : (bulkProfile === "long" ? 15000 : (bulkProfile === "machine_learning" ? 60000 : 5000)))} ms
									</div>
									
									<div style={{ color: "var(--text-secondary)" }}>Memory:</div>
									<div className='font-mono font-bold' style={{ color: "var(--text-primary)" }}>
										{bulkProfile === "custom" ? bulkMemoryLimitMb : (bulkProfile === "fast" ? 64 : (bulkProfile === "long" ? 512 : (bulkProfile === "machine_learning" ? 2048 : 256)))} MB
									</div>

									<div style={{ color: "var(--text-secondary)" }}>Max Output:</div>
									<div className='font-mono font-bold' style={{ color: "var(--text-primary)" }}>
										{bulkProfile === "custom" ? bulkMaxOutputSizeChars : (bulkProfile === "fast" ? 16384 : (bulkProfile === "long" ? 262144 : (bulkProfile === "machine_learning" ? 1048576 : 65536)))} chars
									</div>
								</div>
							</div>
						</div>

						{bulkProfile === "custom" && (
							<div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 rounded-lg border animate-scale-up' style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)" }}>
								<div>
									<label htmlFor='bulkTimeoutMs' className='text-xs font-bold block mb-1' style={{ color: "var(--text-secondary)" }}>
										Timeout (ms)
									</label>
									<input
										type='number'
										id='bulkTimeoutMs'
										value={bulkTimeoutMs}
										onChange={(e) => setBulkTimeoutMs(Number(e.target.value) || 0)}
										className='border outline-none rounded p-2 text-xs w-full focus:border-brand-orange'
										style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
									/>
								</div>

								<div>
									<label htmlFor='bulkMemoryLimitMb' className='text-xs font-bold block mb-1' style={{ color: "var(--text-secondary)" }}>
										Memory (MB)
									</label>
									<input
										type='number'
										id='bulkMemoryLimitMb'
										value={bulkMemoryLimitMb}
										onChange={(e) => setBulkMemoryLimitMb(Number(e.target.value) || 0)}
										className='border outline-none rounded p-2 text-xs w-full focus:border-brand-orange'
										style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
									/>
								</div>

								<div>
									<label htmlFor='bulkMaxOutputSizeChars' className='text-xs font-bold block mb-1' style={{ color: "var(--text-secondary)" }}>
										Max Output (chars)
									</label>
									<input
										type='number'
										id='bulkMaxOutputSizeChars'
										value={bulkMaxOutputSizeChars}
										onChange={(e) => setBulkMaxOutputSizeChars(Number(e.target.value) || 0)}
										className='border outline-none rounded p-2 text-xs w-full focus:border-brand-orange'
										style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
									/>
								</div>
							</div>
						)}

						<div className='flex justify-end gap-3'>
							<button
								type='button'
								onClick={() => setShowBulkModal(false)}
								className='px-4 py-2 hover:bg-dark-fill-2 text-gray-300 rounded-lg text-sm font-medium transition duration-200 border border-border-default'
								style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
							>
								Cancel
							</button>
							<button
								type='button'
								onClick={handleApplyBulkEdit}
								disabled={bulkSubmitting}
								className='px-5 py-2 bg-brand-orange hover:bg-brand-orange-s text-white rounded-lg text-sm font-semibold transition duration-200 shadow-md flex items-center gap-2 disabled:opacity-50'
								style={{ background: "var(--brand-orange)", color: "var(--bg-base)" }}
							>
								{bulkSubmitting && <FaSpinner className='animate-spin' size={12} />}
								Apply to Selected
							</button>
						</div>
					</div>
				</div>
			)}
		</main>
	);
};

export default AdminDashboard;
