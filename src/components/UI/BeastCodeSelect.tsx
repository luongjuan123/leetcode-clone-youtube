import React, { useState, useEffect, useRef } from "react";
import { FaChevronDown, FaSearch, FaTimes } from "react-icons/fa";

export interface SelectOption {
	value: string;
	label: string;
	subLabel?: string;
}

interface BeastCodeSelectProps {
	options: SelectOption[];
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	searchable?: boolean;
	clearable?: boolean;
	maxHeight?: string;
	className?: string;
	disabled?: boolean;
}

const BeastCodeSelect: React.FC<BeastCodeSelectProps> = ({
	options,
	value,
	onChange,
	placeholder = "Select an option...",
	searchable = false,
	clearable = false,
	maxHeight = "280px",
	className = "",
	disabled = false,
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [focusedIndex, setFocusedIndex] = useState(-1);
	
	const containerRef = useRef<HTMLDivElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);

	const selectedOption = options.find((opt) => opt.value === value);

	const filteredOptions = options.filter((opt) => {
		const labelMatch = opt.label.toLowerCase().includes(searchQuery.toLowerCase());
		const subLabelMatch = opt.subLabel?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
		return labelMatch || subLabelMatch;
	});

	// Close on click outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	// Reset search and focus index when dropdown toggles
	useEffect(() => {
		if (isOpen) {
			setSearchQuery("");
			setFocusedIndex(value ? filteredOptions.findIndex((opt) => opt.value === value) : 0);
			if (searchable) {
				setTimeout(() => searchInputRef.current?.focus(), 50);
			}
		} else {
			setFocusedIndex(-1);
		}
	}, [isOpen, value, searchable]);

	// Auto-scroll focused item into view
	useEffect(() => {
		if (focusedIndex >= 0 && listRef.current) {
			const list = listRef.current;
			const item = list.children[focusedIndex] as HTMLElement;
			if (item) {
				const listHeight = list.clientHeight;
				const itemTop = item.offsetTop;
				const itemHeight = item.clientHeight;

				if (itemTop + itemHeight > list.scrollTop + listHeight) {
					list.scrollTop = itemTop + itemHeight - listHeight;
				} else if (itemTop < list.scrollTop) {
					list.scrollTop = itemTop;
				}
			}
		}
	}, [focusedIndex]);

	const handleToggle = () => {
		if (!disabled) setIsOpen(!isOpen);
	};

	const handleSelect = (val: string) => {
		onChange(val);
		setIsOpen(false);
	};

	const handleClear = (e: React.MouseEvent) => {
		e.stopPropagation();
		onChange("");
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (disabled) return;

		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				if (!isOpen) {
					setIsOpen(true);
				} else {
					setFocusedIndex((prev) => (prev + 1) % filteredOptions.length);
				}
				break;
			case "ArrowUp":
				e.preventDefault();
				if (!isOpen) {
					setIsOpen(true);
				} else {
					setFocusedIndex((prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length);
				}
				break;
			case "Enter":
				e.preventDefault();
				if (isOpen) {
					if (filteredOptions[focusedIndex]) {
						handleSelect(filteredOptions[focusedIndex].value);
					}
				} else {
					setIsOpen(true);
				}
				break;
			case "Escape":
				e.preventDefault();
				setIsOpen(false);
				break;
			case "Tab":
				if (isOpen) {
					setIsOpen(false);
				}
				break;
			default:
				break;
		}
	};

	return (
		<div
			ref={containerRef}
			className={`relative w-full select-none font-sans text-sm ${className}`}
			onKeyDown={handleKeyDown}
		>
			{/* Trigger Button */}
			<div
				tabIndex={disabled ? -1 : 0}
				onClick={handleToggle}
				className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
					disabled ? "opacity-50 cursor-not-allowed" : "hover:border-brand-orange"
				} ${isOpen ? "border-brand-orange shadow-glow-sm" : ""}`}
				style={{
					background: "var(--bg-elevated)",
					borderColor: isOpen ? "var(--brand-orange)" : "var(--border-default)",
					color: selectedOption ? "var(--text-primary)" : "var(--text-muted)",
					boxShadow: isOpen ? "0 0 0 2px var(--brand-glow)" : "none",
				}}
			>
				<div className="flex-1 truncate pr-2">
					{selectedOption ? (
						<div className="flex items-center justify-between">
							<span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{selectedOption.label}</span>
							{selectedOption.subLabel && (
								<span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>{selectedOption.subLabel}</span>
							)}
						</div>
					) : (
						placeholder
					)}
				</div>
				<div className="flex items-center gap-1.5 text-gray-500">
					{clearable && selectedOption && !disabled && (
						<button
							onClick={handleClear}
							type="button"
							className="p-1 hover:text-red-400 rounded-full transition duration-150"
						>
							<FaTimes size={10} />
						</button>
					)}
					<FaChevronDown
						size={10}
						className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
					/>
				</div>
			</div>

			{/* Dropdown Panel */}
			{isOpen && (
				<div
					className="absolute z-[100] w-full mt-2 rounded-xl border shadow-xl overflow-hidden animate-scale-up"
					style={{
						background: "var(--bg-elevated)",
						borderColor: "var(--border-subtle)",
						boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4)",
					}}
				>
					{/* Search input if searchable */}
					{searchable && (
						<div
							className="flex items-center px-3 py-2 border-b"
							style={{ borderColor: "var(--border-subtle)" }}
						>
							<FaSearch className="text-gray-500 mr-2" size={12} />
							<input
								ref={searchInputRef}
								type="text"
								placeholder="Search..."
								value={searchQuery}
								onChange={(e) => {
									setSearchQuery(e.target.value);
									setFocusedIndex(0);
								}}
								className="w-full bg-transparent outline-none border-none text-xs p-1"
								style={{ color: "var(--text-primary)" }}
							/>
						</div>
					)}

					{/* Options List */}
					<div
						ref={listRef}
						className="overflow-y-auto scrollbar-thin py-1"
						style={{ maxHeight }}
					>
						{filteredOptions.length === 0 ? (
							<div className="px-4 py-3 text-xs text-center" style={{ color: "var(--text-muted)" }}>
								No results found
							</div>
						) : (
							filteredOptions.map((opt, index) => {
								const isSelected = opt.value === value;
								const isFocused = index === focusedIndex;

								return (
									<div
										key={opt.value}
										onClick={() => handleSelect(opt.value)}
										onMouseEnter={() => setFocusedIndex(index)}
										className={`px-4 py-2.5 text-xs flex items-center justify-between cursor-pointer transition-colors duration-150`}
										style={{
											background: isSelected
												? "var(--brand-glow)"
												: isFocused
												? "var(--bg-dark-fill-3)"
												: "transparent",
											color: isSelected
												? "var(--brand-orange)"
												: isFocused
												? "var(--text-primary)"
												: "var(--text-secondary)",
										}}
									>
										<div className="font-semibold">{opt.label}</div>
										{opt.subLabel && (
											<div className="text-[10px] ml-2 opacity-80" style={{ color: isSelected ? "var(--brand-orange)" : "var(--text-muted)" }}>
												{opt.subLabel}
											</div>
										)}
									</div>
								);
							})
						)}
					</div>
				</div>
			)}
		</div>
	);
};

export default BeastCodeSelect;
