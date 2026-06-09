import React, { useState, useEffect, useMemo } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, firestore } from "@/firebase/firebase";
import { collection, getDocs, doc, setDoc, deleteDoc, onSnapshot, query, where } from "firebase/firestore";
import Topbar from "@/components/Topbar/Topbar";
import TabsNavigation from "@/components/TabsNavigation/TabsNavigation";
import ThreadCard from "@/components/Threads/ThreadCard";
import { FaSearch, FaUser, FaHashtag, FaComments, FaCheckCircle, FaSpinner } from "react-icons/fa";
import Link from "next/link";
import Avatar from "@/components/Threads/Avatar";

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

export default function SearchPage() {
	const [user] = useAuthState(auth);
	const [searchQuery, setSearchQuery] = useState("");
	const [activeCategory, setActiveCategory] = useState<"users" | "threads" | "hashtags">("users");

	// DB state
	const [usersList, setUsersList] = useState<SearchUser[]>([]);
	const [threadsList, setThreadsList] = useState<SearchThread[]>([]);
	const [loading, setLoading] = useState(true);

	// Follow state for current user
	const [followingUids, setFollowingUids] = useState<string[]>([]);

	// Fetch all users and threads for client-side search (enables fuzzy / autocomplete / typo-tolerance)
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
					// Skip replies in general search results, show only top-level threads
					if (!data.parentThreadId) {
						tList.push({ id: d.id, ...data } as SearchThread);
					}
				});
				// Sort newest first
				tList.sort((a, b) => b.createdAt - a.createdAt);
				setThreadsList(tList);
			} catch (e) {
				console.error("Search data load error:", e);
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, []);

	// Subscribe to current user following list
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

	// Simple typo-tolerant / fuzzy score function
	const checkMatch = (source: string, query: string) => {
		if (!source) return 0;
		const s = source.toLowerCase();
		const q = query.toLowerCase();

		if (s.includes(q)) return 10; // direct match

		// Simple edit distance or character overlap score
		let score = 0;
		const words = s.split(/\s+/);
		for (const word of words) {
			if (word.startsWith(q)) score += 5;
			else if (q.includes(word)) score += 2;
		}
		return score;
	};

	// Filter and Rank search results
	const filteredResults = useMemo(() => {
		const qTrim = searchQuery.trim();
		if (!qTrim) {
			return { users: [], threads: [], hashtags: [] };
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

		// 3. Filter Hashtags (parsed from all threads)
		const tagsMap: Record<string, number> = {}; // tag -> count
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

		return { users, threads, hashtags };
	}, [searchQuery, usersList, threadsList]);

	// Suggestions Autocomplete (Top 4 suggestions matching query)
	const suggestions = useMemo(() => {
		const q = searchQuery.trim();
		if (!q) return [];
		const list: { text: string; category: "users" | "threads" | "hashtags"; path: string }[] = [];

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
	}, [searchQuery, usersList, threadsList]);

	// Follow Toggle inside search page
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
		<main className='bg-dark-layer-2 min-h-screen pb-16 text-white'>
			<Topbar />
			<div className='max-w-[700px] mx-auto px-4 mt-8'>
				<TabsNavigation />

				{/* Search Bar Input */}
				<div className='mt-4 space-y-4 rounded-2xl p-5' style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
					<div className='relative flex items-center rounded-xl px-4 py-2.5 transition duration-150' style={{ background: "var(--bg-dark-fill-3)", border: "1px solid var(--border-default)" }}>
						<FaSearch className='text-gray-500 mr-3 shrink-0' size={14} />
						<input
							type='text'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder='Search creators, threads, or hashtags...'
							className='bg-transparent text-sm text-gray-200 outline-none flex-1 placeholder:text-gray-600'
						/>
						{loading && <FaSpinner className='animate-spin text-brand-orange shrink-0' size={14} />}
					</div>

					{/* Autocomplete Suggestions Popover */}
					{suggestions.length > 0 && searchQuery.trim() !== "" && (
						<div className='rounded-xl p-2 shadow-2xl select-none animate-fade-in' style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
							<span className='text-[10px] font-bold text-gray-500 uppercase tracking-wider px-3 py-1.5 block'>
								Suggestions
							</span>
							<div className='space-y-1'>
								{suggestions.map((sug, idx) => (
									<Link key={idx} href={sug.path}>
										<div className='flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition text-xs font-semibold' style={{ color: "var(--text-secondary)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-dark-fill-2)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
											<span className='text-gray-200'>{sug.text}</span>
											<span className='text-[10px] bg-dark-fill-3 text-gray-500 px-2 py-0.5 rounded uppercase'>
												{sug.category}
											</span>
										</div>
									</Link>
								))}
							</div>
						</div>
					)}
				</div>

				{/* Category Switcher Tabs */}
				{searchQuery.trim() !== "" && (
					<div className='flex gap-3 justify-center mt-6 select-none'>
						<button
							onClick={() => setActiveCategory("users")}
							className={`px-5 py-2 text-xs font-bold rounded-2xl border transition duration-200 flex items-center gap-1.5 ${
								activeCategory === "users"
									? "border-brand-orange bg-brand-orange/5 text-brand-orange"
									: "text-gray-400 hover:text-white bg-transparent" 
							}`}
						>
							<FaUser size={10} /> Users
						</button>
						<button
							onClick={() => setActiveCategory("threads")}
							className={`px-5 py-2 text-xs font-bold rounded-2xl border transition duration-200 flex items-center gap-1.5 ${
								activeCategory === "threads"
									? "border-brand-orange bg-brand-orange/5 text-brand-orange"
									: "text-gray-400 hover:text-white bg-transparent"
							}`}
						>
							<FaComments size={10} /> Threads
						</button>
						<button
							onClick={() => setActiveCategory("hashtags")}
							className={`px-5 py-2 text-xs font-bold rounded-2xl border transition duration-200 flex items-center gap-1.5 ${
								activeCategory === "hashtags"
									? "border-brand-orange bg-brand-orange/5 text-brand-orange"
									: "text-gray-400 hover:text-white bg-transparent"
							}`}
						>
							<FaHashtag size={10} /> Hashtags
						</button>
					</div>
				)}

				{/* Results Display Area */}
				<div className='mt-6 space-y-4'>
					{searchQuery.trim() === "" ? (
						<div className='text-center py-16 text-gray-500 select-none'>
							<FaSearch className='mx-auto mb-3 text-gray-650' size={24} />
							<p className='text-sm font-semibold'>Search anything on Threads</p>
							<p className='text-xs text-gray-600 mt-1 max-w-xs mx-auto'>
								Type a developer name, thread content keywords, or tags to find match.
							</p>
						</div>
					) : (
						<>
							{/* Users Category Results */}
							{activeCategory === "users" && (
								<div className='space-y-3'>
									{filteredResults.users.map((targetUser) => {
										const isSelf = user?.uid === targetUser.uid;
										const isFollowing = followingUids.includes(targetUser.uid);

										return (
											<div
												key={targetUser.uid}
												className='flex items-center justify-between gap-4 p-4 rounded-xl transition duration-150 cursor-pointer' style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")} onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-surface)")}
											>
												<Link href={`/profile?uid=${targetUser.uid}`} className='flex items-center gap-3.5 min-w-0'>
													<Avatar
														src={targetUser.avatarUrl}
														displayName={targetUser.displayName}
														size={44}
													/>
													<div className='min-w-0'>
														<div className='flex items-center gap-1.5'>
															<span className='font-bold text-sm text-white hover:text-brand-orange hover:underline truncate max-w-[150px]'>
																{targetUser.displayName}
															</span>
															<FaCheckCircle className='text-brand-orange shrink-0' size={11} />
														</div>
														<p className='text-xs text-gray-500 truncate max-w-[200px] mt-0.5'>
															{targetUser.bio || "No biography details."}
														</p>
													</div>
												</Link>

												{!isSelf && user && (
													<button
														onClick={(e) => handleFollowUser(targetUser, e)}
														className={`px-4.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 shadow-md ${
															isFollowing
																? "bg-dark-fill-3 hover:bg-dark-fill-2 text-gray-300 border border-gray-800"
																: "bg-brand-orange hover:bg-brand-orange-s text-white"
														}`}
													>
														{isFollowing ? "Following" : "Follow"}
													</button>
												)}
											</div>
										);
									})}
									{filteredResults.users.length === 0 && (
										<p className='text-center text-xs text-gray-500 italic py-8'>
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
										<p className='text-center text-xs text-gray-500 italic py-8'>
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
											<div className='flex items-center justify-between p-3.5 rounded-xl transition duration-150 cursor-pointer select-none' style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }} onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-accent)"; }} onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-subtle)"; }}>
												<div className='flex items-center gap-3 text-xs font-semibold'>
													<div className='bg-brand-orange/10 p-2.5 rounded-xl text-brand-orange'>
														<FaHashtag size={12} />
													</div>
													<span className='text-gray-200'>#{tag}</span>
												</div>
												<span className='text-[10px] text-gray-500 font-mono'>
													{count} {count === 1 ? "post" : "posts"}
												</span>
											</div>
										</Link>
									))}
									{filteredResults.hashtags.length === 0 && (
										<p className='text-center text-xs text-gray-500 italic py-8'>
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
