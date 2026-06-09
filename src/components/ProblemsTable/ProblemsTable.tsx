import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { BsCheckCircle } from "react-icons/bs";
import { AiFillYoutube } from "react-icons/ai";
import { IoClose } from "react-icons/io5";
import YouTube from "react-youtube";
import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";
import { auth, firestore } from "@/firebase/firebase";
import { DBProblem } from "@/utils/types/problem";
import { useAuthState } from "react-firebase-hooks/auth";
import { problems as mockProblems } from "@/mockProblems/problems";

type ProblemsTableProps = {
	setLoadingProblems: React.Dispatch<React.SetStateAction<boolean>>;
	searchQuery?: string;
	sortBy?: string;
};

const DIFFICULTY_ORDER: Record<string, number> = { Easy: 1, Medium: 2, Hard: 3 };

const ProblemsTable: React.FC<ProblemsTableProps> = ({ setLoadingProblems, searchQuery = "", sortBy = "default" }) => {
	const [youtubePlayer, setYoutubePlayer] = useState({
		isOpen: false,
		videoId: "",
	});
	const problems = useGetProblems(setLoadingProblems);
	const solvedProblems = useGetSolvedProblems();

	const filteredAndSortedProblems = useMemo(() => {
		let result = [...problems];

		// Filter by search query
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			result = result.filter(
				(p) =>
					p.title.toLowerCase().includes(q) ||
					p.category.toLowerCase().includes(q)
			);
		}

		// Sort
		switch (sortBy) {
			case "a-z":
				result.sort((a, b) => a.title.localeCompare(b.title));
				break;
			case "z-a":
				result.sort((a, b) => b.title.localeCompare(a.title));
				break;
			case "easiest":
				result.sort(
					(a, b) =>
						(DIFFICULTY_ORDER[a.difficulty] ?? 0) - (DIFFICULTY_ORDER[b.difficulty] ?? 0)
				);
				break;
			case "hardest":
				result.sort(
					(a, b) =>
						(DIFFICULTY_ORDER[b.difficulty] ?? 0) - (DIFFICULTY_ORDER[a.difficulty] ?? 0)
				);
				break;
			case "likes":
				result.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
				break;
			case "dislikes":
				result.sort((a, b) => (b.dislikes ?? 0) - (a.dislikes ?? 0));
				break;
			default:
				result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
		}

		return result;
	}, [problems, searchQuery, sortBy]);

	const closeModal = () => {
		setYoutubePlayer({ isOpen: false, videoId: "" });
	};

	useEffect(() => {
		const handleEsc = (e: KeyboardEvent) => {
			if (e.key === "Escape") closeModal();
		};
		window.addEventListener("keydown", handleEsc);

		return () => window.removeEventListener("keydown", handleEsc);
	}, []);

	return (
		<>
			<tbody>
				{problems.length > 0 && filteredAndSortedProblems.length === 0 && (
					<tr>
						<td colSpan={5} className="px-6 py-14 text-center" style={{ color: "var(--text-muted)" }}>
							<div className="flex flex-col items-center gap-3">
								<span className="text-3xl">🔍</span>
								<p className="text-sm font-semibold">No problems match &ldquo;{searchQuery}&rdquo;</p>
								<p className="text-xs" style={{ color: "var(--text-muted)" }}>Try a different keyword or clear your search.</p>
							</div>
						</td>
					</tr>
				)}

				{filteredAndSortedProblems.map((problem, idx) => {
					const isSolved = solvedProblems?.includes(problem.id);
					const diffColor =
						problem.difficulty === "Easy"   ? { color: "#10b981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.25)"  } :
						problem.difficulty === "Medium" ? { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.25)"  } :
						                                  { color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)"   };
					return (
						<tr
							key={problem.id}
							className="group transition-all duration-150 cursor-pointer"
							style={{
								borderTop: idx > 0 ? "1px solid var(--border-subtle)" : "none",
							}}
							onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
							onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
						>
							{/* Solved indicator */}
							<td className="pl-5 pr-3 py-4 w-10">
								{isSolved ? (
									<span title="Solved" style={{ color: "#10b981" }}>
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
											<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
											<polyline points="22 4 12 14.01 9 11.01"/>
										</svg>
									</span>
								) : (
									<span className="w-4 h-4 block rounded-full" style={{ border: "1.5px solid var(--border-default)" }} />
								)}
							</td>

							{/* Title */}
							<td className="px-4 py-4">
								{problem.link ? (
									<a
										href={problem.link}
										target="_blank"
										rel="noopener noreferrer"
										className="font-semibold text-sm transition-colors duration-150"
										style={{ color: "var(--text-primary)" }}
										onMouseEnter={(e) => (e.currentTarget.style.color = "var(--brand-orange)")}
										onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
									>
										{problem.title}
									</a>
								) : (
									<a
										href={`/problems/${problem.id}`}
										className="font-semibold text-sm transition-colors duration-150"
										style={{ color: "var(--text-primary)" }}
										onMouseEnter={(e) => (e.currentTarget.style.color = "var(--brand-orange)")}
										onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
									>
										{problem.title}
									</a>
								)}
							</td>

							{/* Difficulty badge */}
							<td className="px-4 py-4">
								<span
									className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold"
									style={{
										color: diffColor.color,
										background: diffColor.bg,
										border: `1px solid ${diffColor.border}`,
									}}
								>
									{problem.difficulty}
								</span>
							</td>

							{/* Category */}
							<td className="px-4 py-4 hidden sm:table-cell">
								<span
									className="text-xs font-medium px-2 py-0.5 rounded-md"
									style={{
										color: "var(--text-secondary)",
										background: "var(--bg-dark-fill-3)",
									}}
								>
									{problem.category}
								</span>
							</td>

							{/* Solution / Video */}
							<td className="px-4 py-4 hidden md:table-cell">
								{problem.videoId ? (
									<button
										onClick={() => setYoutubePlayer({ isOpen: true, videoId: problem.videoId as string })}
										className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all duration-150"
										style={{
											color: "#ef4444",
											background: "rgba(239,68,68,0.1)",
											border: "1px solid rgba(239,68,68,0.2)",
										}}
										onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.18)")}
										onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
									>
										<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
										Watch
									</button>
								) : (
									<span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>
								)}
							</td>
						</tr>
					);
				})}
			</tbody>

			{/* ── YOUTUBE MODAL ── */}
			{youtubePlayer.isOpen && (
				<tfoot>
					<tr>
						<td>
							<div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
								{/* Backdrop */}
								<div
									className="absolute inset-0 bg-black/80 backdrop-blur-sm"
									onClick={closeModal}
								/>
								{/* Modal */}
								<div
									className="relative z-10 w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl animate-fade-in"
									style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
								>
									<div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
										<span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Video Solution</span>
										<button
											onClick={closeModal}
											className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150"
											style={{ background: "var(--bg-dark-fill-3)", color: "var(--text-secondary)" }}
											onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-dark-fill-2)")}
											onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-dark-fill-3)")}
										>
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
												<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
											</svg>
										</button>
									</div>
									<div className="relative aspect-video w-full">
										<iframe
											src={`https://www.youtube.com/embed/${youtubePlayer.videoId}?autoplay=1`}
											allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
											allowFullScreen
											className="w-full h-full"
											title="Video Solution"
										/>
									</div>
								</div>
							</div>
						</td>
					</tr>
				</tfoot>
			)}
		</>
	);
};
export default ProblemsTable;

function useGetProblems(setLoadingProblems: React.Dispatch<React.SetStateAction<boolean>>) {
	const [problems, setProblems] = useState<DBProblem[]>([]);

	useEffect(() => {
		const getProblems = async () => {
			setLoadingProblems(true);
			try {
				const q = query(collection(firestore, "problems"), orderBy("order", "asc"));
				const querySnapshot = await getDocs(q);
				const tmp: DBProblem[] = [];
				querySnapshot.forEach((doc) => {
					tmp.push({ id: doc.id, ...doc.data() } as DBProblem);
				});
				setProblems(tmp);
			} catch (error) {
				console.error("Error fetching problems from firestore, falling back to mock problems:", error);
				const tmp: DBProblem[] = mockProblems.map(p => ({
					id: p.id,
					title: p.title,
					difficulty: p.difficulty,
					category: p.category,
					order: p.order,
					videoId: p.videoId,
					likes: 0,
					dislikes: 0,
					attempts: 0,
					solved: 0,
					version: 1,
				} as DBProblem));
				setProblems(tmp);
			} finally {
				setLoadingProblems(false);
			}
		};

		getProblems();
	}, [setLoadingProblems]);
	return problems;
}

function useGetSolvedProblems() {
	const [solvedProblems, setSolvedProblems] = useState<string[]>([]);
	const [user] = useAuthState(auth);

	useEffect(() => {
		const getSolvedProblems = async () => {
			const userRef = doc(firestore, "users", user!.uid);
			const userDoc = await getDoc(userRef);

			if (userDoc.exists()) {
				setSolvedProblems(userDoc.data().solvedProblems || []);
			}
		};

		if (user) getSolvedProblems();
		if (!user) setSolvedProblems([]);
	}, [user]);

	return solvedProblems;
}
