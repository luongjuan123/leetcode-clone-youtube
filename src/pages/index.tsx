import ProblemsTable from "@/components/ProblemsTable/ProblemsTable";
import Topbar from "@/components/Topbar/Topbar";
import BeastCodeSelect from "@/components/UI/BeastCodeSelect";
import BeastCodePagination from "@/components/UI/BeastCodePagination";

import useHasMounted from "@/hooks/useHasMounted";
import { useState, useEffect } from "react";
import { FaSearch } from "react-icons/fa";

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
		{ value: "a-z", label: "A → Z" },
		{ value: "z-a", label: "Z → A" },
		{ value: "easiest", label: "Easiest First" },
		{ value: "hardest", label: "Hardest First" },
		{ value: "likes", label: "Most Liked" },
		{ value: "dislikes", label: "Most Disliked" },
	];

	const totalPages = Math.ceil(totalItems / pageSize);

	return (
		<main className="bg-dark-layer-2 min-h-screen pb-20" style={{ fontFamily: "var(--font-sans)" }}>
			<Topbar />

			{/* ── PAGE HEADER ── */}
			<div className="max-w-[860px] mx-auto px-4 pt-8 pb-2">
				<h1 className="text-2xl font-bold tracking-tight mb-1 text-dark-gray-8 text-shadow-glow">
					Problem Set
				</h1>
				<p className="text-sm text-dark-gray-6 font-medium">
					Practice algorithmic challenges and improve your competitive programming skills.
				</p>
			</div>

			{/* ── CONTENT ── */}
			<div className="max-w-[860px] mx-auto px-4">

				{/* ── FILTER & SORT BAR ── */}
				<div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mb-5">

					{/* Search */}
					<div className="relative flex-1 max-w-sm">
						<FaSearch
							className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
							size={12}
							style={{ color: "var(--text-muted)" }}
						/>
						<input
							type="text"
							placeholder="Search by name or tags..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none transition-all duration-200 focus:border-brand-orange"
							style={{
								background: "var(--bg-base)",
								border: "1px solid var(--border-default)",
								color: "var(--text-primary)",
								fontFamily: "var(--font-sans)",
							}}
						/>
					</div>

					{/* Sort */}
					<div className="flex items-center gap-2">
						<span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Sort:</span>
						<div className="w-44">
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
					className="rounded-2xl overflow-hidden mb-4"
					style={{
						background: "var(--bg-surface)",
						border: "1px solid var(--border-subtle)",
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
										<span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
											✓
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
