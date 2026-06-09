import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAdmin } from "@/hooks/useAdmin";
import Topbar from "@/components/Topbar/Topbar";
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, query, orderBy, writeBatch } from "firebase/firestore";
import { firestore } from "@/firebase/firebase";
import { problems as staticProblems } from "@/utils/problems";
import { problems as mockProblems } from "@/mockProblems/problems";
import { FaEdit, FaTrash, FaPlus, FaSync, FaDatabase, FaSpinner } from "react-icons/fa";

interface ProblemListItem {
	id: string;
	title: string;
	category: string;
	difficulty: string;
	order: number;
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
			const q = query(collection(firestore, "problems"), orderBy("order", "asc"));
			const querySnapshot = await getDocs(q);
			const dbProblems: Record<string, any> = {};
			querySnapshot.forEach((doc) => {
				dbProblems[doc.id] = { id: doc.id, ...doc.data() };
			});

			const list: ProblemListItem[] = [];

			// 1. Add all problems in DB
			Object.keys(dbProblems).forEach((id) => {
				list.push({
					id,
					title: dbProblems[id].title || id,
					category: dbProblems[id].category || "Array",
					difficulty: dbProblems[id].difficulty || "Easy",
					order: Number(dbProblems[id].order) || 0,
					isStatic: id in staticProblems,
				});
			});

			// Sort by order
			list.sort((a, b) => a.order - b.order);
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
					category: mockProb?.category || "Array",
					difficulty: mockProb?.difficulty || "Easy",
					order: Number(staticProb.order) || Number(mockProb?.order) || 0,
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
		triggerStatusRibbon("info", "Recounting solved stats for all users...", 0);
		try {
			// 1. Collect all valid problem IDs (Firestore only)
			const problemsSnap = await getDocs(collection(firestore, "problems"));
			const validIds = new Set<string>();
			problemsSnap.forEach((docSnap) => validIds.add(docSnap.id));

			// 2. Fetch every user
			const usersSnap = await getDocs(collection(firestore, "users"));

			// 3. Batch-write cleaned solvedProblems (Firestore batches max 500 ops)
			const BATCH_SIZE = 400;
			let batch = writeBatch(firestore);
			let opsInBatch = 0;
			let usersUpdated = 0;
			let removedTotal = 0;

			for (const userDoc of usersSnap.docs) {
				const data = userDoc.data();
				const stored: string[] = data.solvedProblems || [];
				const cleaned = stored.filter((id) => validIds.has(id));

				if (cleaned.length !== stored.length) {
					removedTotal += stored.length - cleaned.length;
					batch.update(doc(firestore, "users", userDoc.id), {
						solvedProblems: cleaned,
					});
					usersUpdated++;
					opsInBatch++;
					if (opsInBatch >= BATCH_SIZE) {
						await batch.commit();
						batch = writeBatch(firestore);
						opsInBatch = 0;
					}
				}
			}

			if (opsInBatch > 0) {
				await batch.commit();
			}

			if (usersUpdated > 0) {
				triggerStatusRibbon(
					"success",
					`Done! Cleaned ${removedTotal} stale solved record(s) across ${usersUpdated} user(s). Valid problems in DB: ${validIds.size}`
				);
			} else {
				triggerStatusRibbon("info", `All solved records are already up-to-date. Valid problems in DB: ${validIds.size}`);
			}
		} catch (error: any) {
			console.error("Recount error:", error);
			triggerStatusRibbon("error", "Recount failed: " + error.message);
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
						<div className='text-gray-400'>Loading problems...</div>
					</div>
				) : problems.length === 0 ? (
					<div className='text-center py-20 bg-dark-layer-1 rounded-xl border border-gray-800'>
						<p className='text-gray-400 text-lg mb-4'>No problems found in the database.</p>
						<button
							onClick={handleSync}
							className='bg-brand-orange hover:bg-brand-orange-s text-white px-6 py-2 rounded-lg font-medium transition'
						>
							Sync/Seed Problems
						</button>
					</div>
				) : (
					<div className='bg-dark-layer-1 border border-gray-800 rounded-xl overflow-hidden shadow-xl'>
						<div className='overflow-x-auto'>
							<table className='w-full text-sm text-left text-gray-400'>
								<thead className='text-xs uppercase bg-dark-fill-3 text-gray-300 border-b border-gray-800'>
									<tr>
										<th scope='col' className='px-6 py-4 w-16'>Order</th>
										<th scope='col' className='px-6 py-4'>Title</th>
										<th scope='col' className='px-6 py-4 w-32'>Category</th>
										<th scope='col' className='px-6 py-4 w-28'>Difficulty</th>
										<th scope='col' className='px-6 py-4 w-28'>Type</th>
										<th scope='col' className='px-6 py-4 w-28 text-right'>Actions</th>
									</tr>
								</thead>
								<tbody className='divide-y divide-gray-800'>
									{problems.map((problem) => {
										const difficultyColor =
											problem.difficulty === "Easy"
												? "text-dark-green-s bg-dark-green-s/10"
												: problem.difficulty === "Medium"
												? "text-dark-yellow bg-dark-yellow/10"
												: "text-dark-pink bg-dark-pink/10";
										return (
											<tr key={problem.id} className='hover:bg-dark-fill-3 transition'>
												<td className='px-6 py-4 font-mono'>{problem.order}</td>
												<td className='px-6 py-4 font-medium text-white'>
													<Link
														href={`/problems/${problem.id}`}
														className='hover:text-brand-orange transition'
														target='_blank'
													>
														{problem.title}
													</Link>
												</td>
												<td className='px-6 py-4'>{problem.category}</td>
												<td className='px-6 py-4'>
													<span className={`px-2.5 py-1 rounded text-xs font-semibold ${difficultyColor}`}>
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
		</main>
	);
};

export default AdminDashboard;
