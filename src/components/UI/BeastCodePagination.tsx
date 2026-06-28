import React from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import BeastCodeSelect, { SelectOption } from "./BeastCodeSelect";

interface BeastCodePaginationProps {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	pageSize?: number;
	onPageSizeChange?: (size: number) => void;
	pageSizeOptions?: number[];
	totalItems?: number;
}

const BeastCodePagination: React.FC<BeastCodePaginationProps> = ({
	currentPage,
	totalPages,
	onPageChange,
	pageSize,
	onPageSizeChange,
	pageSizeOptions = [10, 25, 50, 100],
	totalItems,
}) => {
	if (totalPages <= 1 && !onPageSizeChange) return null;

	const handlePrev = () => {
		if (currentPage > 1) onPageChange(currentPage - 1);
	};

	const handleNext = () => {
		if (currentPage < totalPages) onPageChange(currentPage + 1);
	};

	// Generate page numbers with ellipsis
	const getPageNumbers = () => {
		const pages: (number | string)[] = [];
		const maxVisible = 5;

		if (totalPages <= maxVisible) {
			for (let i = 1; i <= totalPages; i++) {
				pages.push(i);
			}
		} else {
			const start = Math.max(2, currentPage - 1);
			const end = Math.min(totalPages - 1, currentPage + 1);

			pages.push(1);

			if (start > 2) {
				pages.push("...");
			}

			for (let i = start; i <= end; i++) {
				pages.push(i);
			}

			if (end < totalPages - 1) {
				pages.push("...");
			}

			pages.push(totalPages);
		}

		return pages;
	};

	const sizeOptions: SelectOption[] = pageSizeOptions.map((opt) => ({
		value: String(opt),
		label: `${opt} / page`,
	}));

	return (
		<div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-4 font-sans text-xs">
			{/* Item count or summary */}
			<div style={{ color: "var(--text-muted)" }}>
				{totalItems !== undefined ? (
					<>
						Showing{" "}
						<span className="font-semibold text-white">
							{Math.min(totalItems, (currentPage - 1) * (pageSize || 25) + 1)}
						</span>{" "}
						to{" "}
						<span className="font-semibold text-white">
							{Math.min(totalItems, currentPage * (pageSize || 25))}
						</span>{" "}
						of <span className="font-semibold text-white">{totalItems}</span> records
					</>
				) : (
					<>
						Page <span className="font-semibold text-white">{currentPage}</span> of{" "}
						<span className="font-semibold text-white">{totalPages}</span>
					</>
				)}
			</div>

			{/* Page controls */}
			<div className="flex items-center gap-2">
				{/* Previous Button */}
				<button
					onClick={handlePrev}
					disabled={currentPage === 1}
					className="w-8 h-8 rounded-lg flex items-center justify-center border transition duration-150 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-dark-fill-3"
					style={{
						borderColor: "var(--border-subtle)",
						backgroundColor: "var(--bg-elevated)",
						color: "var(--text-secondary)",
					}}
				>
					<FaChevronLeft size={10} />
				</button>

				{/* Page Number Buttons */}
				<div className="flex items-center gap-1.5">
					{getPageNumbers().map((p, idx) => {
						const isCurrent = p === currentPage;
						const isEllipsis = typeof p === "string";

						if (isEllipsis) {
							return (
								<span
									key={`ellipsis-${idx}`}
									className="px-2 text-center"
									style={{ color: "var(--text-muted)" }}
								>
									...
								</span>
							);
						}

						return (
							<button
								key={`page-${p}`}
								onClick={() => onPageChange(Number(p))}
								className="w-8 h-8 rounded-lg flex items-center justify-center border transition-all duration-200 font-semibold"
								style={{
									borderColor: isCurrent ? "var(--brand-orange)" : "var(--border-subtle)",
									backgroundColor: isCurrent ? "var(--brand-glow)" : "var(--bg-elevated)",
									color: isCurrent ? "var(--brand-orange)" : "var(--text-secondary)",
									boxShadow: isCurrent ? "0 0 0 1px var(--brand-glow)" : "none",
								}}
							>
								{p}
							</button>
						);
					})}
				</div>

				{/* Next Button */}
				<button
					onClick={handleNext}
					disabled={currentPage === totalPages || totalPages === 0}
					className="w-8 h-8 rounded-lg flex items-center justify-center border transition duration-150 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-dark-fill-3"
					style={{
						borderColor: "var(--border-subtle)",
						backgroundColor: "var(--bg-elevated)",
						color: "var(--text-secondary)",
					}}
				>
					<FaChevronRight size={10} />
				</button>

				{/* Page Size selector */}
				{onPageSizeChange && pageSize !== undefined && (
					<div className="w-24 ml-2">
						<BeastCodeSelect
							options={sizeOptions}
							value={String(pageSize)}
							onChange={(val) => onPageSizeChange(Number(val))}
							placeholder={`${pageSize} / page`}
						/>
					</div>
				)}
			</div>
		</div>
	);
};

export default BeastCodePagination;
