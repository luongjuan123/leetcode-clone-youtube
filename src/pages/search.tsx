import React, { useState, useEffect, useMemo } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, firestore } from "@/firebase/firebase";
import { collection, getDocs, doc, setDoc, deleteDoc, onSnapshot, query, where } from "firebase/firestore";
import Topbar from "@/components/Topbar/Topbar";

import ThreadCard from "@/components/Threads/ThreadCard";
import { FaSearch, FaUser, FaHashtag, FaComments, FaCheckCircle, FaSpinner, FaTag } from "react-icons/fa";
import Link from "next/link";
import Avatar from "@/components/Threads/Avatar";
import { problems as staticProblems } from "@/utils/problems";

interface SearchUser {
	uid: string;
	displayName: string;
	avatarUrl?: string;
	bio?: string;
	email?: string;
	followerCount?: number;
}

interface SearchThread {
	id: string;
	uid: string;
	displayName: string;
	avatarUrl?: string;
	content: string;
	createdAt: number;
	likes: string[];
	replies: any[];
}

interface SearchProblem {
	id: string;
	title: string;
	difficulty: string;
	tags: string[];
	attempts?: number;
	solved?: number;
}

export default function SearchPage() {
	const [user] = useAuthState(auth);
	const [searchQuery, setSearchQuery] = useState("");
	const [activeCategory, setActiveCategory] = useState<"problems" | "users" | "threads" | "hashtags">("problems");

	// DB state
	const [usersList, setUsersList] = useState<SearchUser[]>([]);
	const [threadsList, setThreadsList] = useState<SearchThread[]>([]);
	const [problemsList, setProblemsList] = useState<SearchProblem[]>([]);
	const [loading, setLoading] = useState(true);

	// Follow state for current user
	const [followingUids, setFollowingUids] = useState<string[]>([]);

	// Fetch data for client-side search
	useEffect(() => {
		const fetchData = async () => {
			setLoading(true);
			try {
				const usersSnap = await getDocs(collection(firestore, "users"));
				const uList: SearchUser[] = [];
				usersSnap.forEach((d) => {
					uList.push({ uid: d.id, ...d.data() } as SearchUser);
				});
				setUsersList(uList);

				// Query threads
				const threadsSnap = await getDocs(collection(firestore, "threads"));
				const tList: SearchThread[] = [];
				threadsSnap.forEach((d) => {
					const data = d.data();
					if (!data.parentThreadId) {
						tList.push({ id: d.id, ...data } as SearchThread);
					}
				});
				tList.sort((a, b) => b.createdAt - a.createdAt);
				setThreadsList(tList);

				// Query problems
				const problemsSnap = await getDocs(collection(firestore, "problems"));
				const pList: SearchProblem[] = [];
				problemsSnap.forEach((d) => {
					const data = d.data();
					const dbTags = data.tags && Array.isArray(data.tags) && data.tags.length > 0
						? data.tags
						: (data.category ? [data.category] : ["Array"]);
					pList.push({ id: d.id, ...data, tags: dbTags } as SearchProblem);
				});

				const staticList = Object.values(staticProblems).map(p => ({
					id: p.id,
					title: p.title,
					difficulty: p.difficulty || "Easy",
					tags: p.tags && Array.isArray(p.tags) && p.tags.length > 0 ? p.tags : ((p as any).category ? [(p as any).category] : ["Array"]),
					attempts: 0,
					solved: 0,
				}));
				
				staticList.forEach((staticProb) => {
					if (!pList.some((p) => p.id === staticProb.id)) {
						pList.push(staticProb);
					}
				});

				setProblemsList(pList);
			} catch (e) {
				console.error("Search data load error:", e);
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, []);

	// Subscribe to follows list
	useEffect(() => {
		if (!user) {
			setFollowingUids([]);
			return;
		}
		const q = query(
			collection(firestore, "follows"),
			where("followerId", "==", user.uid)
		);
		const unsub = onSnapshot(q, (snap) => {
			const list: string[] = [];
			snap.forEach((d) => {
				list.push(d.data().followingId);
			});
			setFollowingUids(list);
		});
		return () => unsub();
	}, [user]);

	// Simple typo-tolerant edit distance score helper
	const checkMatch = (source: string, query: string) => {
		if (!source) return 0;
		const s = source.toLowerCase();
		const q = query.toLowerCase();

		if (s.includes(q)) return 10; // direct substring match

		let score = 0;
		const words = s.split(/\s+/);
		for (const word of words) {
			if (word.startsWith(q)) score += 5;
			else if (q.includes(word)) score += 2;
		}
		return score;
	};

	// Filter and rank search results
	const filteredResults = useMemo(() => {
		const qTrim = searchQuery.trim();
		if (!qTrim) {
			return { users: [], threads: [], hashtags: [], problems: [] };
		}

		// 1. Filter Users
		const users = usersList
			.map((u) => {
				const nameScore = checkMatch(u.displayName, qTrim);
				const bioScore = checkMatch(u.bio || "", qTrim);
				const totalScore = nameScore + bioScore;
				return { user: u, score: totalScore };
			})
			.filter((item) => item.score > 0)
			.sort((a, b) => b.score - a.score)
			.map((item) => item.user);

		// 2. Filter Threads
		const threads = threadsList
			.map((t) => {
				const contentScore = checkMatch(t.content, qTrim);
				const authorScore = checkMatch(t.displayName, qTrim);
				const totalScore = contentScore + authorScore;
				return { thread: t, score: totalScore };
			})
			.filter((item) => item.score > 0)
			.sort((a, b) => b.score - a.score)
			.map((item) => item.thread);

		// 3. Filter Hashtags
		const tagsMap: Record<string, number> = {};
		threadsList.forEach((t) => {
			const matches = t.content.match(/#(\w+)/g);
			if (matches) {
				matches.forEach((m) => {
					const tag = m.substring(1).toLowerCase();
					if (tag.includes(qTrim.toLowerCase().replace("#", ""))) {
						tagsMap[tag] = (tagsMap[tag] || 0) + 1;
					}
				});
			}
		});
		const hashtags = Object.entries(tagsMap)
			.map(([tag, count]) => ({ tag, count }))
			.sort((a, b) => b.count - a.count);

		// 4. Filter Problems by title and tags
		const problems = problemsList
			.map((p) => {
				const titleScore = checkMatch(p.title, qTrim);
				const tagsScore = p.tags ? p.tags.reduce((acc, tag) => acc + checkMatch(tag, qTrim), 0) : 0;
				const totalScore = titleScore + tagsScore;
				return { problem: p, score: totalScore };
			})
			.filter((item) => item.score > 0)
			.sort((a, b) => b.score - a.score)
			.map((item) => item.problem);

		return { users, threads, hashtags, problems };
	}, [searchQuery, usersList, threadsList, problemsList]);

	// Suggestions Autocomplete
	const suggestions = useMemo(() => {
		const q = searchQuery.trim();
		if (!q) return [];
		const list: { text: string; category: "users" | "threads" | "hashtags" | "problems"; path: string }[] = [];

		// Matches in problems
		problemsList.forEach((p) => {
			if (p.title.toLowerCase().startsWith(q.toLowerCase())) {
				list.push({
					text: p.title,
					category: "problems",
					path: `/problems/${p.id}`,
				});
			}
		});

		// Matches in users
		usersList.forEach((u) => {
			if (u.displayName.toLowerCase().startsWith(q.toLowerCase())) {
				list.push({
					text: u.displayName,
					category: "users",
					path: `/profile?uid=${u.uid}`,
				});
			}
		});

		// Matches in hashtags
		const hashtagsSet = new Set<string>();
		threadsList.forEach((t) => {
			const matches = t.content.match(/#(\w+)/g);
			if (matches) {
				matches.forEach((m) => hashtagsSet.add(m.substring(1).toLowerCase()));
			}
		});
		hashtagsSet.forEach((tag) => {
			if (tag.startsWith(q.toLowerCase().replace("#", ""))) {
				list.push({
					text: `#${tag}`,
					category: "hashtags",
					path: `/tags/${tag}`,
				});
			}
		});

		return list.slice(0, 4);
	}, [searchQuery, usersList, threadsList, problemsList]);

	// Follow Toggle
	const handleFollowUser = async (targetUser: SearchUser, e: React.MouseEvent) => {
		e.stopPropagation();
		if (!user) return;

		const isFollowing = followingUids.includes(targetUser.uid);
		const followId = `${user.uid}_${targetUser.uid}`;
		const followRef = doc(firestore, "follows", followId);

		try {
			if (isFollowing) {
				await deleteDoc(followRef);
			} else {
				await setDoc(followRef, {
					followerId: user.uid,
					followingId: targetUser.uid,
					createdAt: Date.now(),
				});
			}
		} catch (error) {
			console.error("Follow error:", error);
		}
	};

	return (
		<main className='bg-dark-layer-2 min-h-screen pb-16 text-dark-gray-8'>
			<Topbar />
			<div className='max-w-[700px] mx-auto px-4 mt-8'>

				{/* Search Input Box */}
				<div className='mt-4 space-y-4 rounded-2xl p-5' style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
					<div className='relative flex items-center rounded-xl px-4 py-2.5 transition duration-150' style={{ background: "var(--bg-dark-fill-3)", border: "1px solid var(--border-default)" }}>
						<FaSearch className='text-dark-gray-7 mr-3 shrink-0' size={14} />
						<input
							type='text'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder='Search problems, tags, threads, or creators...'
							className='bg-transparent text-sm text-dark-gray-8 outline-none flex-1 placeholder:text-dark-gray-7'
						/>
						{loading && <FaSpinner className='animate-spin text-brand-orange shrink-0' size={14} />}
					</div>

					{/* Suggestions Popover */}
					{suggestions.length > 0 && searchQuery.trim() !== "" && (
						<div className='rounded-xl p-2 shadow-2xl select-none animate-fade-in' style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
							<span className='text-[10px] font-bold text-dark-gray-7 uppercase tracking-wider px-3 py-1.5 block'>
								Suggestions
							</span>
							<div className='space-y-1'>
								{suggestions.map((sug, idx) => (
									<Link key={idx} href={sug.path}>
										<div className='flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition text-xs font-semibold hover:bg-dark-fill-2' style={{ color: "var(--text-secondary)" }}>
											<span className='text-dark-gray-8'>{sug.text}</span>
											<span className='text-[10px] bg-dark-fill-3 text-dark-gray-7 px-2 py-0.5 rounded uppercase'>
												{sug.category}
											</span>
										</div>
									</Link>
								))}
							</div>
						</div>
					)}
				</div>

				{/* Tabs Switcher */}
				{searchQuery.trim() !== "" && (
					<div className='flex flex-wrap gap-2.5 justify-center mt-6 select-none'>
						<button
							onClick={() => setActiveCategory("problems")}
							className={`px-5 py-2 text-xs font-bold rounded-2xl border transition duration-200 flex items-center gap-1.5 ${
								activeCategory === "problems"
									? "border-brand-orange bg-brand-orange/5 text-brand-orange"
									: "text-dark-gray-7 hover:text-dark-gray-8 bg-transparent"
							}`}
						>
							<FaTag size={10} /> Problems
						</button>
						<button
							onClick={() => setActiveCategory("users")}
							className={`px-5 py-2 text-xs font-bold rounded-2xl border transition duration-200 flex items-center gap-1.5 ${
								activeCategory === "users"
									? "border-brand-orange bg-brand-orange/5 text-brand-orange"
									: "text-dark-gray-7 hover:text-dark-gray-8 bg-transparent" 
							}`}
						>
							<FaUser size={10} /> Users
						</button>
						<button
							onClick={() => setActiveCategory("threads")}
							className={`px-5 py-2 text-xs font-bold rounded-2xl border transition duration-200 flex items-center gap-1.5 ${
								activeCategory === "threads"
									? "border-brand-orange bg-brand-orange/5 text-brand-orange"
									: "text-dark-gray-7 hover:text-dark-gray-8 bg-transparent"
							}`}
						>
							<FaComments size={10} /> Threads
						</button>
						<button
							onClick={() => setActiveCategory("hashtags")}
							className={`px-5 py-2 text-xs font-bold rounded-2xl border transition duration-200 flex items-center gap-1.5 ${
								activeCategory === "hashtags"
									? "border-brand-orange bg-brand-orange/5 text-brand-orange"
									: "text-dark-gray-7 hover:text-dark-gray-8 bg-transparent"
							}`}
						>
							<FaHashtag size={10} /> Hashtags
						</button>
					</div>
				)}

				{/* Search Results Display Area */}
				<div className='mt-6 space-y-4'>
					{searchQuery.trim() === "" ? (
						<div className='text-center py-16 text-dark-gray-7 select-none'>
							<FaSearch className='mx-auto mb-3 text-dark-gray-7' size={24} />
							<p className='text-sm font-semibold'>Search anything on BeastCode</p>
							<p className='text-xs text-dark-gray-7 mt-1 max-w-xs mx-auto'>
								Type problem names, tags, developer names, or threads keywords.
							</p>
						</div>
					) : (
						<>
							{/* Coding Problems Results */}
							{activeCategory === "problems" && (
								<div className='space-y-3'>
									{filteredResults.problems.map((problem) => {
										const diffColor =
											problem.difficulty === "Easy" ? { color: "var(--color-success)", bg: "color-mix(in srgb, var(--color-success) 10%, transparent)", border: "color-mix(in srgb, var(--color-success) 25%, transparent)" } :
											problem.difficulty === "Medium" ? { color: "var(--color-warning)", bg: "color-mix(in srgb, var(--color-warning) 10%, transparent)", border: "color-mix(in srgb, var(--color-warning) 25%, transparent)" } :
											{ color: "var(--color-error)", bg: "color-mix(in srgb, var(--color-error) 10%, transparent)", border: "color-mix(in srgb, var(--color-error) 25%, transparent)" };

										return (
											<div
												key={problem.id}
												className='flex items-center justify-between gap-4 p-4 rounded-xl transition duration-150 cursor-pointer hover:bg-dark-hover'
												style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
											>
												<Link href={`/problems/${problem.id}`} className='flex-1 min-w-0'>
													<div>
														<div className='flex items-center gap-2.5'>
															<span className='font-bold text-sm hover:text-brand-orange hover:underline truncate max-w-[250px]' style={{ color: "var(--text-primary)" }}>
																{problem.title}
															</span>
															<span
																className='inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold'
																style={{
																	color: diffColor.color,
																	background: diffColor.bg,
																	border: `1px solid ${diffColor.border}`,
																}}
															>
																{problem.difficulty}
															</span>
															{problem.attempts !== undefined && problem.attempts > 0 && (
																<span
																	className='inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono'
																	style={{
																		color: "var(--text-secondary)",
																		background: "var(--bg-dark-fill-3)",
																		border: "1px solid var(--border-subtle)",
																	}}
																>
																	{Math.round(((problem.solved ?? 0) / problem.attempts) * 100)}% success
																</span>
															)}
														</div>
														<div className='flex flex-wrap gap-1.5 mt-2'>
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
													</div>
												</Link>
											</div>
										);
									})}
									{filteredResults.problems.length === 0 && (
										<p className='text-center text-xs italic py-8' style={{ color: "var(--text-muted)" }}>
											No coding problems found matching &quot;{searchQuery}&quot;.
										</p>
									)}
								</div>
							)}

							{/* Users Category Results */}
							{activeCategory === "users" && (
								<div className='space-y-3'>
									{filteredResults.users.map((targetUser) => {
										const isSelf = user?.uid === targetUser.uid;
										const isFollowing = followingUids.includes(targetUser.uid);

										return (
											<div
												key={targetUser.uid}
												className='flex items-center justify-between gap-4 p-4 rounded-xl transition duration-150 cursor-pointer hover:bg-dark-hover' style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
											>
												<Link href={`/profile?uid=${targetUser.uid}`} className='flex items-center gap-3.5 min-w-0'>
													<Avatar
														src={targetUser.avatarUrl}
														displayName={targetUser.displayName}
														size={44}
													/>
													<div className='min-w-0'>
														<div className='flex items-center gap-1.5'>
															<span className='font-bold text-sm hover:text-brand-orange hover:underline truncate max-w-[150px]' style={{ color: "var(--text-primary)" }}>
																{targetUser.displayName}
															</span>
															<FaCheckCircle className='text-brand-orange shrink-0' size={11} />
														</div>
														<p className='text-xs truncate max-w-[200px] mt-0.5' style={{ color: "var(--text-muted)" }}>
															{targetUser.bio || "No biography details."}
														</p>
													</div>
												</Link>

												{!isSelf && user && (
													<button
														onClick={(e) => handleFollowUser(targetUser, e)}
														className={`px-4.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 shadow-md border ${
															isFollowing
																? "bg-dark-fill-3 border-border-strong text-text-secondary"
																: "bc-btn-brand border-transparent"
														}`}
													>
														{isFollowing ? "Following" : "Follow"}
													</button>
												)}
											</div>
										);
									})}
									{filteredResults.users.length === 0 && (
										<p className='text-center text-xs italic py-8' style={{ color: "var(--text-muted)" }}>
											No users found matching &quot;{searchQuery}&quot;.
										</p>
									)}
								</div>
							)}

							{/* Threads Category Results */}
							{activeCategory === "threads" && (
								<div className='space-y-4'>
									{filteredResults.threads.map((thread) => (
										<Link key={thread.id} href={`/threads?threadId=${thread.id}`}>
											<div className='cursor-pointer'>
												<ThreadCard thread={thread} />
											</div>
										</Link>
									))}
									{filteredResults.threads.length === 0 && (
										<p className='text-center text-xs italic py-8' style={{ color: "var(--text-muted)" }}>
											No threads found matching &quot;{searchQuery}&quot;.
										</p>
									)}
								</div>
							)}

							{/* Hashtags Category Results */}
							{activeCategory === "hashtags" && (
								<div className='space-y-2.5 max-w-md mx-auto'>
									{filteredResults.hashtags.map(({ tag, count }) => (
										<Link key={tag} href={`/tags/${tag}`}>
											<div className='flex items-center justify-between p-3.5 rounded-xl transition duration-150 cursor-pointer select-none border border-border-subtle hover:border-border-accent' style={{ background: "var(--bg-surface)" }}>
												<div className='flex items-center gap-3 text-xs font-semibold'>
													<div className='bg-brand-orange/10 p-2.5 rounded-xl text-brand-orange'>
														<FaHashtag size={12} />
													</div>
													<span style={{ color: "var(--text-primary)" }}>#{tag}</span>
												</div>
												<span className='text-[10px] font-mono' style={{ color: "var(--text-muted)" }}>
													{count} {count === 1 ? "post" : "posts"}
												</span>
											</div>
										</Link>
									))}
									{filteredResults.hashtags.length === 0 && (
										<p className='text-center text-xs italic py-8' style={{ color: "var(--text-muted)" }}>
											No hashtags found matching &quot;{searchQuery}&quot;.
										</p>
									)}
								</div>
							)}
						</>
					)}
				</div>
			</div>
		</main>
	);
}
