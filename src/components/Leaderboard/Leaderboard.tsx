import React, { useEffect, useState, useRef } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, firestore } from "@/firebase/firebase";
import BeastCodeSelect from "../UI/BeastCodeSelect";
import Link from "next/link";
import {
	FaTrophy,
	FaUser,
	FaMedal,
	FaSearch,
	FaChevronLeft,
	FaChevronRight,
	FaAngleDoubleLeft,
	FaAngleDoubleRight,
	FaGlobe,
	FaUserFriends
} from "react-icons/fa";

interface LeaderboardUser {
	uid: string;
	displayName: string;
	avatarUrl?: string;
	school: string;
	country: string;
	score: number;
	xp: number;
	rating: number;
	contestRating: number;
	mlRating: number;
	problemSolvingRating: number;
	easyCount: number;
	mediumCount: number;
	hardCount: number;
	rank: number;
}

const PAGE_SIZE = 100;

const countriesOptions = [
	{ value: "", label: "Global (All Countries)" },
	{ value: "United States", label: "🇺🇸 United States" },
	{ value: "Canada", label: "🇨🇦 Canada" },
	{ value: "United Kingdom", label: "🇬🇧 United Kingdom" },
	{ value: "Vietnam", label: "🇻🇳 Vietnam" },
	{ value: "Singapore", label: "🇸🇬 Singapore" },
	{ value: "Australia", label: "🇦🇺 Australia" },
	{ value: "Germany", label: "🇩🇪 Germany" },
	{ value: "France", label: "🇫🇷 France" },
	{ value: "Japan", label: "🇯🇵 Japan" },
];

const sortOptions = [
	{ value: "score", label: "Total Score" },
	{ value: "xp", label: "Experience Points (XP)" },
	{ value: "rating", label: "Overall Rating" },
	{ value: "contestRating", label: "Contest Rating" },
	{ value: "mlRating", label: "Machine Learning Rating" },
	{ value: "problemSolvingRating", label: "Problem Solving Rating" },
];

const Leaderboard: React.FC = () => {
	const [user] = useAuthState(auth);

	// Cache references to avoid duplicate fetch queries
	const leaderboardCache = useRef<Record<string, any>>({});

	// Filter states
	const [sortField, setSortField] = useState("score");
	const [country, setCountry] = useState("");
	const [school, setSchool] = useState("");
	const [searchInput, setSearchInput] = useState("");
	const [searchActiveQuery, setSearchActiveQuery] = useState("");
	const [friendsOnly, setFriendsOnly] = useState(false);

	// Pagination states
	const [currentPage, setCurrentPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [totalItems, setTotalItems] = useState(0);
	const [usersList, setUsersList] = useState<LeaderboardUser[]>([]);
	const [highlightedUid, setHighlightedUid] = useState<string | null>(null);

	const [loading, setLoading] = useState(true);
	const [directPage, setDirectPage] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [warning, setWarning] = useState<string | null>(null);

	// Load user friends
	const [friends, setFriends] = useState<string[]>([]);
	useEffect(() => {
		if (!user) {
			setFriends([]);
			return;
		}
		const unsub = onSnapshot(doc(firestore, "users", user.uid), (snap) => {
			if (snap.exists()) {
				setFriends(snap.data().friends || []);
			}
		});
		return () => unsub();
	}, [user]);

	// Fetch function
	const fetchPage = async (pageToFetch: number, jumpToUserUid = "", forceActiveSearch = searchActiveQuery) => {
		setLoading(true);
		setError(null);
		setWarning(null);
		try {
			const cacheKey = JSON.stringify({
				page: pageToFetch,
				sortField,
				country,
				school,
				search: forceActiveSearch,
				jumpToUid: jumpToUserUid,
				friendsOnly
			});

			// If cache matches, load instantly
			if (leaderboardCache.current[cacheKey]) {
				const cached = leaderboardCache.current[cacheKey];
				setUsersList(cached.users || []);
				setCurrentPage(cached.page || 1);
				setTotalPages(cached.totalPages || 1);
				setTotalItems(cached.totalItems || 0);
				setHighlightedUid(cached.highlightedUid || null);
				setWarning(cached.warning || null);
				setLoading(false);
				
				// Prefetch next page in background
				if (cached.page < cached.totalPages) {
					prefetchNextPage(cached.page + 1, forceActiveSearch);
				}
				return;
			}

			const params = new URLSearchParams();
			params.append("page", String(pageToFetch));
			params.append("sortField", sortField);
			if (country) params.append("country", country);
			if (school) params.append("school", school);
			if (forceActiveSearch) params.append("search", forceActiveSearch);
			if (jumpToUserUid) params.append("jumpToUid", jumpToUserUid);

			if (friendsOnly && user) {
				const friendsQueryList = [user.uid, ...friends];
				params.append("friends", friendsQueryList.join(","));
			}

			const res = await fetch(`/api/leaderboard?${params.toString()}`);
			if (!res.ok) throw new Error("Failed to load rankings");
			const data = await res.json();

			setUsersList(data.users || []);
			setCurrentPage(data.page || 1);
			setTotalPages(data.totalPages || 1);
			setTotalItems(data.totalItems || 0);
			setHighlightedUid(data.highlightedUid || null);
			setWarning(data.warning || null);

			// Save to cache
			leaderboardCache.current[cacheKey] = data;

			// Background prefetch next page
			if (data.page < data.totalPages) {
				prefetchNextPage(data.page + 1, forceActiveSearch);
			}
		} catch (err) {
			console.error("Leaderboard fetch error:", err);
			setError("Unable to load rankings at this moment.");
		} finally {
			setLoading(false);
		}
	};

	// Prefetch helper
	const prefetchNextPage = async (nextPage: number, activeSearch: string) => {
		const prefetchKey = JSON.stringify({
			page: nextPage,
			sortField,
			country,
			school,
			search: activeSearch,
			jumpToUid: "",
			friendsOnly
		});

		if (leaderboardCache.current[prefetchKey]) return;

		try {
			const params = new URLSearchParams();
			params.append("page", String(nextPage));
			params.append("sortField", sortField);
			if (country) params.append("country", country);
			if (school) params.append("school", school);
			if (activeSearch) params.append("search", activeSearch);

			if (friendsOnly && user) {
				const friendsQueryList = [user.uid, ...friends];
				params.append("friends", friendsQueryList.join(","));
			}

			const res = await fetch(`/api/leaderboard?${params.toString()}`);
			if (res.ok) {
				const data = await res.json();
				leaderboardCache.current[prefetchKey] = data;
			}
		} catch (e) {
			console.warn("Background prefetch failed:", e);
		}
	};

	// Trigger fetch on filter changes
	useEffect(() => {
		// Reset page cursor when filters change
		setCurrentPage(1);
		fetchPage(1);
	}, [sortField, country, school, searchActiveQuery, friendsOnly]);

	// Listen to visible users real-time updates without refetching pages
	useEffect(() => {
		if (usersList.length === 0) return;

		const unsubs = usersList.map((userItem) => {
			return onSnapshot(doc(firestore, "users", userItem.uid), (snap) => {
				if (snap.exists()) {
					const data = snap.data();
					setUsersList((prev) =>
						prev.map((u) => {
							if (u.uid === snap.id) {
								return {
									...u,
									displayName: data.displayName || u.displayName,
									avatarUrl: data.avatarUrl || u.avatarUrl,
									school: data.school || u.school,
									country: data.country || u.country,
									score: data.score !== undefined ? data.score : u.score,
									xp: data.xp !== undefined ? data.xp : u.xp,
									rating: data.rating !== undefined ? data.rating : u.rating,
									contestRating: data.contestRating !== undefined ? data.contestRating : u.contestRating,
									mlRating: data.mlRating !== undefined ? data.mlRating : u.mlRating,
									problemSolvingRating: data.problemSolvingRating !== undefined ? data.problemSolvingRating : u.problemSolvingRating,
									easyCount: data.easyCount !== undefined ? data.easyCount : u.easyCount,
									mediumCount: data.mediumCount !== undefined ? data.mediumCount : u.mediumCount,
									hardCount: data.hardCount !== undefined ? data.hardCount : u.hardCount,
								};
							}
							return u;
						})
					);
				}
			});
		});

		return () => {
			unsubs.forEach((unsub) => unsub());
		};
	}, [usersList.map((u) => u.uid).join(",")]);

	// Scroll highlighted row into view
	useEffect(() => {
		if (highlightedUid) {
			const timer = setTimeout(() => {
				const row = document.getElementById(`row-${highlightedUid}`);
				if (row) {
					row.scrollIntoView({ behavior: "smooth", block: "center" });
				}
			}, 300);
			return () => clearTimeout(timer);
		}
	}, [highlightedUid, usersList]);

	// Keyboard arrow navigation
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
				return;
			}
			if (e.key === "ArrowLeft") {
				if (currentPage > 1) {
					setCurrentPage((p) => p - 1);
					fetchPage(currentPage - 1);
				}
			} else if (e.key === "ArrowRight") {
				if (currentPage < totalPages) {
					setCurrentPage((p) => p + 1);
					fetchPage(currentPage + 1);
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [currentPage, totalPages]);

	// Search handler
	const handleSearchSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setSearchActiveQuery(searchInput.trim());
	};

	// Jump to current logged-in user
	const handleJumpToMe = () => {
		if (!user) return;
		fetchPage(1, user.uid);
	};

	// Direct page input
	const handleDirectPageSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const p = parseInt(directPage);
		if (!isNaN(p) && p >= 1 && p <= totalPages) {
			setCurrentPage(p);
			fetchPage(p);
		}
		setDirectPage("");
	};

	// Render metric value based on active sorting
	const renderMetric = (u: LeaderboardUser) => {
		if (sortField === "xp") return `${u.xp.toLocaleString()} XP`;
		if (sortField === "rating") return `⭐ ${u.rating}`;
		if (sortField === "contestRating") return `⚔️ ${u.contestRating}`;
		if (sortField === "mlRating") return `🧠 ${u.mlRating}`;
		if (sortField === "problemSolvingRating") return `🧩 ${u.problemSolvingRating}`;
		return `${u.score.toLocaleString()} pts`;
	};

	return (
		<div className="max-w-[1280px] mx-auto w-full p-2 md:p-6 space-y-6">
			{/* Dashboard Top Banner */}
			<div className="rounded-2xl p-6 border relative overflow-hidden" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)", boxShadow: "var(--shadow-glow)" }}>
				<div className="absolute inset-0 bg-gradient-to-r from-brand-orange/5 via-transparent to-brand-orange/5 pointer-events-none" />
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
					<div>
						<h1 className="text-2xl md:text-3xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
							Global Rankings
						</h1>
						<p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
							Scale-optimized scoreboard updating in real-time. Navigate dynamically across millions of coders.
						</p>
					</div>

					{/* Metric weights information */}
					<div className="flex flex-wrap gap-2.5 text-xs font-semibold">
						<span className="inline-flex items-center px-3 py-1 rounded-lg bg-bc-success/10 border border-bc-success/20 text-bc-success">
							Easy: 1pt
						</span>
						<span className="inline-flex items-center px-3 py-1 rounded-lg bg-bc-warning/10 border border-bc-warning/20 text-bc-warning">
							Medium: 3pts
						</span>
						<span className="inline-flex items-center px-3 py-1 rounded-lg bg-bc-error/10 border border-bc-error/20 text-bc-error">
							Hard: 5pts
						</span>
					</div>
				</div>
			</div>

			{/* Filters Control Dashboard Panel */}
			<div className="rounded-2xl p-4 md:p-6 border space-y-4" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					{/* Search input form */}
					<form onSubmit={handleSearchSubmit} className="flex gap-2">
						<div className="relative flex-1">
							<FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={13} />
							<input
								type="text"
								placeholder="Search username..."
								value={searchInput}
								onChange={(e) => setSearchInput(e.target.value)}
								className="w-full pl-10 pr-3 py-2.5 rounded-xl border outline-none text-sm transition focus:border-brand-orange"
								style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
							/>
						</div>
						<button
							type="submit"
							className="px-4 py-2.5 rounded-xl text-xs font-black bg-brand-orange hover:bg-opacity-95 text-white shadow-md transition"
						>
							Search
						</button>
					</form>

					{/* Sort field select */}
					<div>
						<BeastCodeSelect
							options={sortOptions}
							value={sortField}
							onChange={setSortField}
							placeholder="Sort Rank By..."
						/>
					</div>

					{/* Country selector */}
					<div>
						<BeastCodeSelect
							options={countriesOptions}
							value={country}
							onChange={setCountry}
							placeholder="Select Country..."
						/>
					</div>

					{/* School input */}
					<div className="flex gap-2">
						<input
							type="text"
							placeholder="Filter school/university..."
							value={school}
							onChange={(e) => setSchool(e.target.value)}
							className="w-full px-3 py-2.5 rounded-xl border outline-none text-sm transition focus:border-brand-orange"
							style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
						/>
					</div>
				</div>

				{/* Secondary filters and Jump actions */}
				<div className="flex flex-wrap items-center justify-between pt-2 border-t gap-4" style={{ borderColor: "var(--border-subtle)" }}>
					<div className="flex items-center gap-4">
						{/* Friends filter toggle */}
						{user && (
							<button
								onClick={() => setFriendsOnly(!friendsOnly)}
								className={`px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition duration-200 ${
									friendsOnly
										? "border-brand-orange bg-brand-orange/10 text-brand-orange"
										: "border-border-default hover:border-brand-orange"
								}`}
								style={{
									borderColor: friendsOnly ? "var(--brand-orange)" : "var(--border-default)",
									background: friendsOnly ? "var(--brand-glow)" : "var(--bg-elevated)",
									color: friendsOnly ? "var(--brand-orange)" : "var(--text-secondary)"
								}}
							>
								<FaUserFriends size={12} />
								Friends Only
							</button>
						)}

						{/* Clear all active filters indicator */}
						{(country || school || searchActiveQuery || friendsOnly) && (
							<button
								onClick={() => {
									setCountry("");
									setSchool("");
									setSearchInput("");
									setSearchActiveQuery("");
									setFriendsOnly(false);
								}}
								className="text-xs font-bold transition hover:text-brand-orange text-red-500"
							>
								Clear Filters
							</button>
						)}
					</div>

					{/* Jump to my rank */}
					{user && (
						<button
							onClick={handleJumpToMe}
							className="px-4 py-2 rounded-xl text-xs font-black border transition"
							style={{
								borderColor: "var(--border-default)",
								background: "var(--bg-elevated)",
								color: "var(--text-primary)"
							}}
						>
							📍 Jump to My Rank
						</button>
					)}
				</div>
			</div>

			{warning && (
				<div 
					className="mb-4 p-4 rounded-xl border flex items-center gap-3 text-sm animate-fade-in"
					style={{
						borderColor: "var(--border-warning, rgba(245, 158, 11, 0.2))",
						background: "var(--bg-warning, rgba(245, 158, 11, 0.05))",
						color: "var(--text-warning, #fbbf24)"
					}}
				>
					<span className="text-lg">⚠️</span>
					<div>{warning}</div>
				</div>
			)}

			{/* Main Ranking Table Card */}
			<div className="rounded-2xl border overflow-hidden" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)", boxShadow: "var(--shadow-glow)" }}>
				<div className="overflow-x-auto w-full">
					<table className="w-full text-sm text-left table-fixed">
						<thead className="text-xs uppercase border-b" style={{ borderColor: "var(--border-default)", background: "var(--bg-dark-fill-2)", color: "var(--text-muted)" }}>
							<tr>
								<th scope="col" className="px-6 py-4 w-20 text-center font-bold">Rank</th>
								<th scope="col" className="px-6 py-4 w-60">User</th>
								<th scope="col" className="px-6 py-4 hidden md:table-cell w-56">University</th>
								<th scope="col" className="px-6 py-4 hidden lg:table-cell w-36 text-center">Country</th>
								<th scope="col" className="px-6 py-4 hidden sm:table-cell w-64 text-center">Solve Stats</th>
								<th scope="col" className="px-6 py-4 w-40 text-right pr-8">Valuation</th>
							</tr>
						</thead>
						<tbody className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
							{loading ? (
								// Shimmer Skeleton loading state
								[...Array(8)].map((_, idx) => (
									<tr key={idx} className="animate-pulse">
										<td className="px-6 py-4 text-center">
											<div className="w-6 h-6 rounded bg-dark-fill-3 mx-auto" />
										</td>
										<td className="px-6 py-4">
											<div className="flex items-center gap-3">
												<div className="w-8 h-8 rounded-full bg-dark-fill-3" />
												<div className="h-4 w-28 rounded bg-dark-fill-3" />
											</div>
										</td>
										<td className="px-6 py-4 hidden md:table-cell">
											<div className="h-4 w-32 rounded bg-dark-fill-3" />
										</td>
										<td className="px-6 py-4 hidden lg:table-cell">
											<div className="h-4 w-20 rounded bg-dark-fill-3 mx-auto" />
										</td>
										<td className="px-6 py-4 hidden sm:table-cell">
											<div className="h-4 w-40 rounded bg-dark-fill-3 mx-auto" />
										</td>
										<td className="px-6 py-4 text-right pr-8">
											<div className="h-4 w-16 rounded bg-dark-fill-3 ml-auto" />
										</td>
									</tr>
								))
							) : error ? (
								<tr>
									<td colSpan={6} className="px-6 py-12 text-center">
										<div className="flex flex-col items-center justify-center gap-4">
											<span className="text-3xl">📡</span>
											<p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
												{error}
											</p>
											<button
												onClick={() => fetchPage(currentPage)}
												className="px-6 py-2.5 rounded-xl font-bold transition duration-200 hover:scale-105 active:scale-95"
												style={{
													background: "var(--brand-orange)",
													color: "#fff",
													boxShadow: "0 4px 12px var(--brand-orange-50)"
												}}
											>
												Try Again
											</button>
										</div>
									</td>
								</tr>
							) : usersList.length === 0 ? (
								<tr>
									<td colSpan={6} className="px-6 py-12 text-center italic" style={{ color: "var(--text-muted)" }}>
										No ranking users found matching your filters.
									</td>
								</tr>
							) : (
								usersList.map((rankingUser) => {
									const isCurrentUser = user && rankingUser.uid === user.uid;
									const isHighlighted = highlightedUid === rankingUser.uid;
									const rank = rankingUser.rank;

									return (
										<tr
											key={rankingUser.uid}
											id={`row-${rankingUser.uid}`}
											className={`hover:bg-dark-hover transition duration-150 duration-200 ${
												isCurrentUser ? "bg-brand-orange/5 border-l-2 border-brand-orange" : ""
											} ${
												isHighlighted ? "bg-brand-orange/15 shadow-inner" : ""
											}`}
											style={{
												borderBottom: "1px solid var(--border-subtle)"
											}}
										>
											{/* Rank display */}
											<td className="px-6 py-4 text-center font-bold">
												<div className="flex justify-center items-center">
													{rank === 1 ? (
														<FaTrophy className="text-yellow-500" size={18} />
													) : rank === 2 ? (
														<FaMedal className="text-gray-300" size={18} />
													) : rank === 3 ? (
														<FaMedal className="text-amber-600" size={18} />
													) : (
														<span style={{ color: "var(--text-muted)" }}>#{rank}</span>
													)}
												</div>
											</td>

											{/* User card info */}
											<td className="px-6 py-4 font-semibold" style={{ color: "var(--text-primary)" }}>
												<Link href={`/profile?uid=${rankingUser.uid}`} className="flex items-center gap-3 hover:text-brand-orange transition cursor-pointer w-fit">
													{rankingUser.avatarUrl ? (
														<img
															src={rankingUser.avatarUrl}
															alt="Avatar"
															className="w-8 h-8 rounded-full object-cover border"
															style={{ borderColor: "var(--border-default)" }}
														/>
													) : (
														<div className="w-8 h-8 rounded-full flex items-center justify-center border" style={{ background: "var(--bg-dark-fill-3)", color: "var(--text-muted)", borderColor: "var(--border-default)" }}>
															<FaUser size={12} />
														</div>
													)}
													<span className="truncate max-w-[120px] sm:max-w-[160px]">
														{rankingUser.displayName}
													</span>
													{isCurrentUser && (
														<span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-brand-orange text-white">
															You
														</span>
													)}
												</Link>
											</td>

											{/* University */}
											<td className="px-6 py-4 hidden md:table-cell text-xs" style={{ color: "var(--text-muted)" }}>
												<span className="font-semibold truncate block" style={{ color: "var(--text-secondary)" }}>
													{rankingUser.school}
												</span>
											</td>

											{/* Country */}
											<td className="px-6 py-4 hidden lg:table-cell text-center text-xs" style={{ color: "var(--text-secondary)" }}>
												<span className="inline-flex items-center gap-1">
													<FaGlobe size={10} className="text-gray-600" />
													{rankingUser.country}
												</span>
											</td>

											{/* Solve statistics counts */}
											<td className="px-6 py-4 hidden sm:table-cell text-center">
												<div className="flex justify-center gap-1.5 text-[10px]">
													<span className="inline-flex items-center px-2 py-0.5 rounded-full font-bold bg-bc-success/10 border border-bc-success/20 text-bc-success font-mono">
														{rankingUser.easyCount} E
													</span>
													<span className="inline-flex items-center px-2 py-0.5 rounded-full font-bold bg-bc-warning/10 border border-bc-warning/20 text-bc-warning font-mono">
														{rankingUser.mediumCount} M
													</span>
													<span className="inline-flex items-center px-2 py-0.5 rounded-full font-bold bg-bc-error/10 border border-bc-error/20 text-bc-error font-mono">
														{rankingUser.hardCount} H
													</span>
												</div>
											</td>

											{/* Value according to sortField */}
											<td className="px-6 py-4 text-right pr-8 font-extrabold text-brand-orange text-sm md:text-base">
												{renderMetric(rankingUser)}
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>

				{/* High-fidelity Pagination controls */}
				<div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-6 border-t" style={{ background: "var(--bg-dark-fill-3)", borderColor: "var(--border-subtle)" }}>
					{/* Record range descriptor */}
					<div className="text-xs" style={{ color: "var(--text-muted)" }}>
						Showing{" "}
						<span className="font-bold" style={{ color: "var(--text-primary)" }}>
							{totalItems > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0}
						</span>{" "}
						to{" "}
						<span className="font-bold" style={{ color: "var(--text-primary)" }}>
							{Math.min(totalItems, currentPage * PAGE_SIZE)}
						</span>{" "}
						of <span className="font-bold text-brand-orange">{totalItems.toLocaleString()}</span> members
					</div>

					{/* Navigation controls */}
					<div className="flex flex-wrap items-center gap-3">
						{/* First Page */}
						<button
							onClick={() => {
								setCurrentPage(1);
								fetchPage(1);
							}}
							disabled={currentPage === 1 || loading}
							className="p-2 h-8 w-8 rounded-lg flex items-center justify-center border transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-dark-fill-2"
							style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
							title="First Page"
						>
							<FaAngleDoubleLeft size={12} />
						</button>

						{/* Previous Page */}
						<button
							onClick={() => {
								const prev = currentPage - 1;
								setCurrentPage(prev);
								fetchPage(prev);
							}}
							disabled={currentPage === 1 || loading}
							className="px-3 h-8 rounded-lg flex items-center gap-1.5 border transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-dark-fill-2 text-xs font-bold"
							style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
						>
							<FaChevronLeft size={9} />
							Prev
						</button>

						{/* Current page status text */}
						<span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
							Page <span className="text-brand-orange font-bold">{currentPage}</span> of <span className="font-bold">{totalPages}</span>
						</span>

						{/* Next Page */}
						<button
							onClick={() => {
								const next = currentPage + 1;
								setCurrentPage(next);
								fetchPage(next);
							}}
							disabled={currentPage === totalPages || loading}
							className="px-3 h-8 rounded-lg flex items-center gap-1.5 border transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-dark-fill-2 text-xs font-bold"
							style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
						>
							Next
							<FaChevronRight size={9} />
						</button>

						{/* Last Page */}
						<button
							onClick={() => {
								setCurrentPage(totalPages);
								fetchPage(totalPages);
							}}
							disabled={currentPage === totalPages || loading}
							className="p-2 h-8 w-8 rounded-lg flex items-center justify-center border transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-dark-fill-2"
							style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
							title="Last Page"
						>
							<FaAngleDoubleRight size={12} />
						</button>
					</div>

					{/* Direct page input form */}
					<form onSubmit={handleDirectPageSubmit} className="flex items-center gap-2">
						<label htmlFor="directPage" className="text-xs" style={{ color: "var(--text-muted)" }}>Go to:</label>
						<input
							type="number"
							id="directPage"
							min="1"
							max={totalPages}
							placeholder="Page #"
							value={directPage}
							onChange={(e) => setDirectPage(e.target.value)}
							className="w-16 px-2 py-1 text-center text-xs rounded-lg border outline-none focus:border-brand-orange"
							style={{ background: "var(--bg-elevated)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
						/>
					</form>
				</div>
			</div>
		</div>
	);
};

export default Leaderboard;
