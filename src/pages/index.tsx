import ProblemsTable from "@/components/ProblemsTable/ProblemsTable";
import Topbar from "@/components/Topbar/Topbar";
import TabsNavigation from "@/components/TabsNavigation/TabsNavigation";
import useHasMounted from "@/hooks/useHasMounted";
import { useState } from "react";
import { FaSearch, FaSortAmountDown } from "react-icons/fa";

export default function Home() {
	const [loadingProblems, setLoadingProblems] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [sortBy, setSortBy] = useState("default");
	const hasMounted = useHasMounted();

	if (!hasMounted) return null;

	return (
		<main className="bg-dark-layer-2 min-h-screen pb-20" style={{ fontFamily: "var(--font-sans)" }}>
			<Topbar />

			{/* ── PAGE HEADER ── */}
			<div className="max-w-[860px] mx-auto px-4 pt-8 pb-2">
				<h1 className="text-2xl font-bold text-white tracking-tight mb-1">
					Problem Set
				</h1>
				<p className="text-sm text-dark-gray-6 font-medium">
					Practice algorithmic challenges and improve your competitive programming skills.
				</p>
			</div>

			{/* ── TABS ── */}
			<TabsNavigation />

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
							placeholder="Search by name or category..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none transition-all duration-200 placeholder-slate-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
							style={{
								background: "var(--bg-base)",
								border: "1px solid var(--border-default)",
								color: "var(--text-primary)",
								fontFamily: "var(--font-sans)",
							}}
							onFocus={(e) => {
								e.target.style.borderColor = "var(--brand-orange)";
								e.target.style.boxShadow = "0 0 0 2px var(--brand-glow)";
							}}
							onBlur={(e) => {
								e.target.style.borderColor = "var(--border-default)";
								e.target.style.boxShadow = "none";
							}}
						/>
					</div>

					{/* Sort */}
					<div className="flex items-center gap-2">
						<FaSortAmountDown size={12} style={{ color: "var(--text-muted)" }} />
						<select
							value={sortBy}
							onChange={(e) => setSortBy(e.target.value)}
							className="py-2.5 pl-3 pr-8 text-xs font-semibold rounded-xl outline-none cursor-pointer transition-all duration-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
							style={{
								background: "var(--bg-base)",
								border: "1px solid var(--border-default)",
								color: "var(--text-secondary)",
								fontFamily: "var(--font-sans)",
							}}
							onFocus={(e) => {
								e.target.style.borderColor = "var(--brand-orange)";
								e.target.style.boxShadow = "0 0 0 2px var(--brand-glow)";
							}}
							onBlur={(e) => {
								e.target.style.borderColor = "var(--border-default)";
								e.target.style.boxShadow = "none";
							}}
						>
							<option className="bg-[#111622] text-slate-200" value="default">Default Order</option>
							<option className="bg-[#111622] text-slate-200" value="a-z">A → Z</option>
							<option className="bg-[#111622] text-slate-200" value="z-a">Z → A</option>
							<option className="bg-[#111622] text-slate-200" value="easiest">Easiest First</option>
							<option className="bg-[#111622] text-slate-200" value="hardest">Hardest First</option>
							<option className="bg-[#111622] text-slate-200" value="likes">Most Liked</option>
							<option className="bg-[#111622] text-slate-200" value="dislikes">Most Disliked</option>
						</select>
					</div>
				</div>

				{/* ── TABLE ── */}
				<div
					className="rounded-2xl overflow-hidden"
					style={{
						background: "var(--bg-surface)",
						border: "1px solid var(--border-subtle)",
					}}
				>
					{/* Loading skeleton */}
					{loadingProblems && (
						<div className="p-2 space-y-0.5">
							{[...Array(12)].map((_, i) => (
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
											Category
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
						<ProblemsTable setLoadingProblems={setLoadingProblems} searchQuery={searchQuery} sortBy={sortBy} />
					</table>
				</div>
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
