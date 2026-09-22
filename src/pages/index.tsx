import ProblemsTable from "@/components/ProblemsTable/ProblemsTable";
import Topbar from "@/components/Topbar/Topbar";
import BeastCodeSelect from "@/components/UI/BeastCodeSelect";
import BeastCodePagination from "@/components/UI/BeastCodePagination";

import useHasMounted from "@/hooks/useHasMounted";
import { useState, useEffect } from "react";
import { FaSearch, FaCheck } from "react-icons/fa";

export default function Home() {
	const [loadingProblems, setLoadingProblems] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [sortBy, setSortBy] = useState("default");
	
	// Pagination states
	const [currentPage, setCurrentPage] = useState(1);
	const [pageSize, setPageSize] = useState(25);
	const [totalItems, setTotalItems] = useState(0);

	const hasMounted = useHasMounted();

	// Reset page when filters change
	useEffect(() => {
		setCurrentPage(1);
	}, [searchQuery, sortBy]);

	if (!hasMounted) return null;

	const sortOptions = [
		{ value: "default", label: "Default Order" },
		{ value: "a-z", label: "A to Z" },
		{ value: "z-a", label: "Z to A" },
		{ value: "easiest", label: "Easiest First" },
		{ value: "hardest", label: "Hardest First" },
		{ value: "likes", label: "Most Liked" },
		{ value: "dislikes", label: "Most Disliked" },
	];

	const totalPages = Math.ceil(totalItems / pageSize);

	return (
		<main className="min-h-screen pb-20 hero-gradient" style={{ fontFamily: "var(--font-sans)", background: "var(--bg-base)" }}>
			<Topbar />

			{/* ── PAGE HERO BANNER ── */}
			<div className="max-w-[960px] mx-auto px-4 pt-10 pb-6">
				<div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-dark-layer-1 p-6 rounded-2xl border border-border-default shadow-lg glassmorphic">
					<div>
						<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-brand-orange/10 text-brand-orange border border-brand-orange/20 mb-3">
							<span className="w-2 h-2 rounded-full bg-brand-orange animate-pulse" />
							BeastCode Platform Arena
						</div>
						<h1 className="text-3xl font-extrabold tracking-tight text-text-primary glow-text mb-1">
							Problem Set
						</h1>
						<p className="text-sm text-text-secondary font-medium max-w-xl">
							Practice algorithmic challenges, climb the global leaderboards, and excel in competitive programming.
						</p>
					</div>
					<div className="flex items-center gap-3">
						<div className="stat-card flex flex-col items-center justify-center min-w-[100px] text-center">
							<span className="text-xl font-black text-brand-orange">{totalItems}</span>
							<span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Problems</span>
						</div>
					</div>
				</div>
			</div>

			{/* ── CONTENT ── */}
			<div className="max-w-[960px] mx-auto px-4">

				{/* ── TOPIC FILTER CHIPS ── */}
				<div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
					{[
						{ label: "All Topics", value: "" },
						{ label: "Arrays", value: "array" },
						{ label: "Two Pointers", value: "two-pointers" },
						{ label: "Dynamic Programming", value: "dynamic-programming" },
						{ label: "Graphs", value: "graph" },
						{ label: "Trees", value: "tree" },
						{ label: "Strings", value: "string" },
						{ label: "Math", value: "math font" },
						{ label: "Binary Search", value: "binary-search" },
						{ label: "Sorting", value: "sorting" },
					].map((chip) => {
						const active = searchQuery.toLowerCase().trim() === chip.value.toLowerCase().trim();
						return (
							<button
								key={chip.label}
								onClick={() => setSearchQuery(chip.value)}
								className={`topic-chip ${active ? "topic-chip-active" : ""}`}
							>
								{chip.label}
							</button>
						);
					})}
				</div>

				{/* ── FILTER & SORT BAR ── */}
				<div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mb-5">

					{/* Search */}
					<div className="relative flex-1 max-w-md">
						<FaSearch
							className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
							size={13}
							style={{ color: "var(--brand-orange)" }}
						/>
						<input
							type="text"
							placeholder="Search problem by name, tag, or topic..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none transition-all duration-200 glow-focus"
							style={{
								background: "var(--bg-surface)",
								border: "1px solid var(--border-default)",
								color: "var(--text-primary)",
								fontFamily: "var(--font-sans)",
							}}
						/>
					</div>

					{/* Sort */}
					<div className="flex items-center gap-2">
						<span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Sort:</span>
						<div className="w-48">
							<BeastCodeSelect
								options={sortOptions}
								value={sortBy}
								onChange={setSortBy}
							/>
						</div>
					</div>
				</div>

				{/* ── TABLE ── */}
				<div
					className="rounded-2xl overflow-hidden mb-4 glass-card"
					style={{
						background: "var(--bg-surface)",
						border: "1px solid var(--border-default)",
					}}
				>
					{/* Loading skeleton */}
					{loadingProblems && (
						<div className="p-2 space-y-0.5">
							{[...Array(10)].map((_, i) => (
								<LoadingSkeleton key={i} delay={i * 40} />
							))}
						</div>
					)}

					<table className="w-full text-sm">
						{/* Table header */}
						{!loadingProblems && (
							<thead>
								<tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
									<th className="pl-5 pr-3 py-3.5 text-left">
										<span className="text-[10px] font-bold uppercase tracking-widest flex items-center" style={{ color: "var(--text-muted)" }}>
											<FaCheck size={10} />
										</span>
									</th>
									<th className="px-4 py-3.5 text-left">
										<span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
											Title
										</span>
									</th>
									<th className="px-4 py-3.5 text-left">
										<span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
											Difficulty
										</span>
									</th>
									<th className="px-4 py-3.5 text-left hidden sm:table-cell">
										<span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
											Tags
										</span>
									</th>
									<th className="px-4 py-3.5 text-left hidden md:table-cell">
										<span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
											Success Rate
										</span>
									</th>
									<th className="px-4 py-3.5 text-left hidden md:table-cell">
										<span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
											Solution
										</span>
									</th>
								</tr>
							</thead>
						)}
						<ProblemsTable
							setLoadingProblems={setLoadingProblems}
							searchQuery={searchQuery}
							sortBy={sortBy}
							currentPage={currentPage}
							pageSize={pageSize}
							setTotalItems={setTotalItems}
						/>
					</table>
				</div>

				{/* ── PAGINATION ── */}
				{!loadingProblems && totalPages > 0 && (
					<div className="rounded-2xl border" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
						<BeastCodePagination
							currentPage={currentPage}
							totalPages={totalPages}
							onPageChange={setCurrentPage}
							pageSize={pageSize}
							onPageSizeChange={setPageSize}
							pageSizeOptions={[10, 25, 50]}
							totalItems={totalItems}
						/>
					</div>
				)}
			</div>
		</main>
	);
}

const LoadingSkeleton = ({ delay = 0 }: { delay?: number }) => (
	<div
		className="flex items-center gap-4 px-5 py-3.5 rounded-xl"
		style={{ opacity: 1 - delay / 600 }}
	>
		<div className="w-4 h-4 rounded-full skeleton flex-shrink-0" />
		<div className="flex-1 h-3.5 rounded-lg skeleton" style={{ maxWidth: `${200 + Math.random() * 120}px` }} />
		<div className="w-14 h-3 rounded-lg skeleton" />
		<div className="w-20 h-3 rounded-lg skeleton hidden sm:block" />
		<div className="w-8 h-8 rounded-lg skeleton hidden md:block" />
	</div>
);
