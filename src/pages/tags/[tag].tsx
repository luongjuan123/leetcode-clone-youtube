import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { collection, query, where, getDocs } from "firebase/firestore";
import { firestore } from "@/firebase/firebase";
import Topbar from "@/components/Topbar/Topbar";
import { DBProblem } from "@/utils/types/problem";
import { problems as staticProblems } from "@/utils/problems";
import { FaTag, FaArrowLeft, FaSpinner } from "react-icons/fa";

const DIFFICULTY_ORDER: Record<string, number> = { Easy: 1, Medium: 2, Hard: 3 };

export default function TagPage() {
	const router = useRouter();
	const { tag } = router.query;

	const [problems, setProblems] = useState<DBProblem[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!tag) return;
		const fetchProblemsByTag = async () => {
			setLoading(true);
			const tagStr = tag as string;

			// Helper to check if problem has matching tag case-insensitively and space/dash-agnostically
			const isTagMatch = (tagsArray: string[]) => {
				const normalizedQuery = tagStr.toLowerCase().replace(/[- ]+/g, "");
				return tagsArray.some(t => {
					const normalizedT = t.toLowerCase().replace(/[- ]+/g, "");
					return normalizedT === normalizedQuery;
				});
			};

			try {
				// Fetch all problems and filter client-side for case-insensitive and space/dash-agnostic matching
				const q = query(collection(firestore, "problems"));
				const querySnapshot = await getDocs(q);
				const list: DBProblem[] = [];

				querySnapshot.forEach((docSnap) => {
					const data = docSnap.data();
					const dbTags = data.tags && Array.isArray(data.tags) && data.tags.length > 0
						? data.tags
						: (data.category ? [data.category] : ["Array"]);
					
					if (isTagMatch(dbTags)) {
						list.push({ id: docSnap.id, ...data, tags: dbTags } as DBProblem);
					}
				});

				// Fallback to static problems matching the tag for seamless local testing
				const staticMatches = Object.values(staticProblems).filter((p) => {
					const pTags = p.tags && Array.isArray(p.tags) && p.tags.length > 0
						? p.tags
						: ((p as any).category ? [(p as any).category] : ["Array"]);
					return isTagMatch(pTags);
				}).map(p => ({
					id: p.id,
					title: p.title,
					difficulty: p.difficulty || "Easy",
					tags: p.tags && Array.isArray(p.tags) && p.tags.length > 0 ? p.tags : ((p as any).category ? [(p as any).category] : ["Array"]),
					likes: 0,
					dislikes: 0,
					attempts: 0,
					solved: 0,
				} as DBProblem));

				// Merge database problems and local problems (avoiding duplicates)
				const mergedList = [...list];
				staticMatches.forEach((staticProb) => {
					if (!mergedList.some((p) => p.id === staticProb.id)) {
						mergedList.push(staticProb);
					}
				});

				// Sort by title
				mergedList.sort((a, b) => a.title.localeCompare(b.title));
				setProblems(mergedList);
			} catch (err) {
				console.error("Error fetching tagged problems:", err);
				
				// Fallback purely to local problems on network error
				const staticMatches = Object.values(staticProblems).filter((p) => {
					const pTags = p.tags && Array.isArray(p.tags) && p.tags.length > 0
						? p.tags
						: ((p as any).category ? [(p as any).category] : ["Array"]);
					return isTagMatch(pTags);
				}).map(p => ({
					id: p.id,
					title: p.title,
					difficulty: p.difficulty || "Easy",
					tags: p.tags && Array.isArray(p.tags) && p.tags.length > 0 ? p.tags : ((p as any).category ? [(p as any).category] : ["Array"]),
					likes: 0,
					dislikes: 0,
					attempts: 0,
					solved: 0,
				} as DBProblem));
				setProblems(staticMatches);
			} finally {
				setLoading(false);
			}
		};

		fetchProblemsByTag();
	}, [tag]);

	return (
		<main className='bg-dark-layer-2 min-h-screen pb-16 text-white'>
			<Topbar />
			<div className='max-w-[860px] mx-auto px-4 mt-8'>
				{/* Header */}
				<div className='flex items-center gap-4 py-4 border-b border-gray-800 mb-6'>
					<button
						onClick={() => router.back()}
						className='p-2 bg-dark-fill-3 hover:bg-dark-fill-2 hover:text-white rounded-xl transition text-gray-400 shrink-0 border border-gray-800'
					>
						<FaArrowLeft size={12} />
					</button>
					<div className='flex items-center gap-2.5'>
						<div className='bg-brand-orange/10 p-2.5 rounded-xl text-brand-orange border border-brand-orange/20 shadow-md shadow-brand-orange/5'>
							<FaTag size={16} />
						</div>
						<div>
							<h1 className='text-lg font-bold text-white capitalize'>{tag} Problems</h1>
							<p className='text-xs text-gray-400'>Browse coding challenges tagged under &ldquo;{tag}&rdquo;.</p>
						</div>
					</div>
				</div>

				{loading ? (
					<div className='flex flex-col justify-center items-center py-20 gap-4'>
						<FaSpinner className='animate-spin text-brand-orange' size={32} />
						<div className='text-sm text-gray-400'>Loading problems...</div>
					</div>
				) : (
					<div className='rounded-xl overflow-hidden shadow-xl' style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
						<table className='w-full text-sm text-left' style={{ color: "var(--text-secondary)" }}>
							<thead>
								<tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
									<th className='px-6 py-4'>
										<span className='text-[10px] font-bold uppercase tracking-widest' style={{ color: "var(--text-muted)" }}>Title</span>
									</th>
									<th className='px-6 py-4 w-28'>
										<span className='text-[10px] font-bold uppercase tracking-widest' style={{ color: "var(--text-muted)" }}>Difficulty</span>
									</th>
									<th className='px-6 py-4 w-32'>
										<span className='text-[10px] font-bold uppercase tracking-widest' style={{ color: "var(--text-muted)" }}>Success Rate</span>
									</th>
									<th className='px-6 py-4'>
										<span className='text-[10px] font-bold uppercase tracking-widest' style={{ color: "var(--text-muted)" }}>Tags</span>
									</th>
								</tr>
							</thead>
							<tbody className='divide-y divide-border-subtle'>
								{problems.map((problem) => {
									const diffColor =
										problem.difficulty === "Easy" ? { color: "var(--color-success)", bg: "color-mix(in srgb, var(--color-success) 10%, transparent)", border: "color-mix(in srgb, var(--color-success) 25%, transparent)" } :
										problem.difficulty === "Medium" ? { color: "var(--color-warning)", bg: "color-mix(in srgb, var(--color-warning) 10%, transparent)", border: "color-mix(in srgb, var(--color-warning) 25%, transparent)" } :
										{ color: "var(--color-error)", bg: "color-mix(in srgb, var(--color-error) 10%, transparent)", border: "color-mix(in srgb, var(--color-error) 25%, transparent)" };

									return (
										<tr key={problem.id} className='hover:bg-dark-fill-3 transition-colors duration-150'>
											<td className='px-6 py-4 font-semibold text-sm'>
												<Link href={`/problems/${problem.id}`} className='hover:text-brand-orange transition-colors duration-150' style={{ color: "var(--text-primary)" }}>
													{problem.title}
												</Link>
											</td>
											<td className='px-6 py-4'>
												<span
													className='inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold'
													style={{
														color: diffColor.color,
														background: diffColor.bg,
														border: `1px solid ${diffColor.border}`,
													}}
												>
													{problem.difficulty}
												</span>
											</td>
											<td className='px-6 py-4'>
												{problem.attempts && problem.attempts > 0 ? (
													<span className="font-mono text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
														{Math.round(((problem.solved ?? 0) / problem.attempts) * 100)}%
													</span>
												) : (
													<span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
												)}
											</td>
											<td className='px-6 py-4'>
												<div className='flex flex-wrap gap-1.5'>
													{problem.tags.map((t) => (
														<Link
															key={t}
															href={`/tags/${encodeURIComponent(t.toLowerCase())}`}
															className='text-[10px] px-1.5 py-0.5 rounded font-bold transition hover:opacity-85 border'
															style={{
																background: "var(--bg-dark-fill-3)",
																color: "var(--text-secondary)",
																border: "1px solid var(--border-subtle)",
															}}
														>
															{t}
														</Link>
													))}
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
						{problems.length === 0 && (
							<div className='text-center py-16 text-gray-400 select-none'>
								<FaTag className='mx-auto mb-3 text-gray-500' size={24} />
								<p className='text-sm font-semibold'>No problems found</p>
								<p className='text-xs text-gray-500 mt-1'>
									We couldn&apos;t find any coding challenges tagged with &ldquo;{tag}&rdquo;.
								</p>
							</div>
						)}
					</div>
				)}
			</div>
		</main>
	);
}
