import React from "react";
import { FiSearch, FiX, FiChevronLeft, FiChevronRight, FiAlertTriangle, FiLoader } from "react-icons/fi";

// ─── ADMIN CARD ─────────────────────────────────────────────────────────────
interface AdminCardProps extends React.HTMLAttributes<HTMLDivElement> {
	children: React.ReactNode;
	hoverable?: boolean;
}
export const AdminCard: React.FC<AdminCardProps> = ({ children, hoverable = false, className = "", ...props }) => {
	return (
		<div
			className={`bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-5 shadow-sm transition-all duration-200 ${
				hoverable ? "hover:border-[var(--brand-orange)]/30 hover:shadow-md" : ""
			} ${className}`}
			{...props}
		>
			{children}
		</div>
	);
};

// ─── ADMIN HEADER ────────────────────────────────────────────────────────────
interface AdminHeaderProps {
	title: string;
	description?: string;
	actions?: React.ReactNode;
}
export const AdminHeader: React.FC<AdminHeaderProps> = ({ title, description, actions }) => {
	return (
		<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 select-none">
			<div>
				<h1 className="text-xl font-black tracking-tight text-[var(--text-primary)]">
					{title}
				</h1>
				{description && (
					<p className="text-xs text-[var(--text-secondary)] mt-1">
						{description}
					</p>
				)}
			</div>
			{actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
		</div>
	);
};

// ─── ADMIN ACTION BUTTON ──────────────────────────────────────────────────────
interface AdminActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "primary" | "secondary" | "danger" | "success" | "ghost" | "outline";
	size?: "sm" | "md" | "lg";
	loading?: boolean;
	icon?: React.ReactNode;
}
export const AdminActionButton: React.FC<AdminActionButtonProps> = ({
	children,
	variant = "secondary",
	size = "md",
	loading = false,
	icon,
	className = "",
	disabled,
	...props
}) => {
	const baseStyle = "inline-flex items-center justify-center gap-2 font-bold transition-all duration-155 rounded-xl disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] select-none";
	
	const sizeStyles = {
		sm: "px-3 py-1.5 text-[10px]",
		md: "px-4 py-2 text-xs",
		lg: "px-5 py-2.5 text-sm"
	};

	const variantStyles = {
		primary: "bg-[var(--brand-orange)] text-white hover:opacity-90 shadow-sm shadow-[var(--brand-orange)]/10",
		secondary: "bg-[var(--bg-dark-fill-3)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
		danger: "bg-red-650 hover:bg-red-600 text-white shadow-sm shadow-red-950/20",
		success: "bg-emerald-650 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-950/20",
		ghost: "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
		outline: "border border-[var(--brand-orange)]/25 text-[var(--brand-orange)] bg-[var(--brand-glow)]/10 hover:bg-[var(--brand-glow)]/20"
	};

	return (
		<button
			type="button"
			disabled={disabled || loading}
			className={`${baseStyle} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
			{...props}
		>
			{loading ? <FiLoader className="animate-spin" size={13} /> : icon}
			{children}
		</button>
	);
};

// ─── ADMIN SEARCH BAR ────────────────────────────────────────────────────────
interface AdminSearchBarProps {
	value: string;
	onChange: (val: string) => void;
	placeholder?: string;
	className?: string;
}
export const AdminSearchBar: React.FC<AdminSearchBarProps> = ({
	value,
	onChange,
	placeholder = "Search...",
	className = ""
}) => {
	return (
		<div className={`relative flex items-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl px-3 py-1.5 focus-within:border-[var(--brand-orange)]/50 transition-all ${className}`}>
			<FiSearch className="text-[var(--text-muted)] mr-2 shrink-0" size={13} />
			<input
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				className="bg-transparent text-xs text-[var(--text-primary)] outline-none w-full placeholder:text-[var(--text-muted)] border-0 p-0 focus:ring-0"
			/>
			{value && (
				<button
					onClick={() => onChange("")}
					className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
				>
					<FiX size={13} />
				</button>
			)}
		</div>
	);
};

// ─── ADMIN FILTER BAR ────────────────────────────────────────────────────────
interface AdminFilterBarProps {
	children: React.ReactNode;
	className?: string;
}
export const AdminFilterBar: React.FC<AdminFilterBarProps> = ({ children, className = "" }) => {
	return (
		<div className={`p-4 bg-[var(--bg-dark-fill-3)]/60 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 select-none ${className}`}>
			{children}
		</div>
	);
};

// ─── ADMIN STATUS PILL ────────────────────────────────────────────────────────
interface AdminStatusPillProps {
	theme?: "success" | "warning" | "danger" | "info" | "neutral";
	children: React.ReactNode;
}
export const AdminStatusPill: React.FC<AdminStatusPillProps> = ({ theme = "neutral", children }) => {
	const themeStyles = {
		success: "bg-emerald-950/20 border-emerald-900/30 text-emerald-400",
		warning: "bg-amber-950/20 border-amber-900/30 text-amber-400",
		danger: "bg-rose-950/20 border-rose-900/30 text-rose-450",
		info: "bg-blue-950/20 border-blue-900/30 text-blue-400",
		neutral: "bg-[var(--bg-dark-fill-3)] border border-[var(--border-subtle)] text-[var(--text-secondary)]"
	};
	return (
		<span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border capitalize ${themeStyles[theme]}`}>
			{children}
		</span>
	);
};

// ─── ADMIN BADGE ─────────────────────────────────────────────────────────────
interface AdminBadgeProps {
	children: React.ReactNode;
}
export const AdminBadge: React.FC<AdminBadgeProps> = ({ children }) => {
	return (
		<span className="text-[9px] px-1.5 py-0.5 rounded-md font-mono font-bold bg-[var(--bg-dark-fill-3)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
			{children}
		</span>
	);
};

// ─── ADMIN EMPTY STATE ────────────────────────────────────────────────────────
interface AdminEmptyStateProps {
	icon?: React.ReactNode;
	title: string;
	description?: string;
	actionText?: string;
	onAction?: () => void;
}
export const AdminEmptyState: React.FC<AdminEmptyStateProps> = ({
	icon,
	title,
	description,
	actionText,
	onAction
}) => {
	return (
		<div className="flex flex-col items-center justify-center py-16 text-center select-none bg-[var(--bg-surface)] p-6">
			{icon && (
				<div className="w-12 h-12 rounded-full bg-[var(--bg-dark-fill-3)] flex items-center justify-center text-[var(--text-muted)] mb-4 border border-[var(--border-subtle)]">
					{icon}
				</div>
			)}
			<h4 className="text-xs font-black text-[var(--text-primary)]">{title}</h4>
			{description && (
				<p className="text-[10px] text-[var(--text-muted)] mt-1 mb-5 max-w-xs leading-relaxed">
					{description}
				</p>
			)}
			{actionText && onAction && (
				<AdminActionButton variant="primary" onClick={onAction}>
					{actionText}
				</AdminActionButton>
			)}
		</div>
	);
};

// ─── ADMIN LOADING SKELETON ──────────────────────────────────────────────────
interface AdminLoadingSkeletonProps {
	rows?: number;
}
export const AdminLoadingSkeleton: React.FC<AdminLoadingSkeletonProps> = ({ rows = 5 }) => {
	return (
		<div className="p-4 space-y-3">
			{Array.from({ length: rows }).map((_, idx) => (
				<div
					key={idx}
					className="flex items-center justify-between p-4 bg-[var(--bg-dark-fill-3)]/30 border border-[var(--border-subtle)] rounded-xl animate-pulse"
				>
					<div className="flex items-center gap-3 w-1/2">
						<div className="w-4 h-4 bg-white/5 rounded" />
						<div className="h-3.5 bg-white/5 rounded w-48" />
					</div>
					<div className="flex gap-2 w-1/3 justify-end">
						<div className="h-3.5 bg-white/5 rounded w-16" />
						<div className="h-3.5 bg-white/5 rounded w-16" />
					</div>
				</div>
			))}
		</div>
	);
};

// ─── ADMIN PAGINATION ─────────────────────────────────────────────────────────
interface AdminPaginationProps {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
}
export const AdminPagination: React.FC<AdminPaginationProps> = ({
	currentPage,
	totalPages,
	onPageChange
}) => {
	if (totalPages <= 1) return null;
	return (
		<div className="px-5 py-3 bg-[var(--bg-dark-fill-3)]/30 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-secondary)] select-none">
			<span>
				Showing page <span className="font-bold text-[var(--text-primary)]">{currentPage}</span> of{" "}
				<span className="font-bold text-[var(--text-primary)]">{totalPages}</span>
			</span>
			<div className="flex items-center gap-1">
				<button
					type="button"
					onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
					disabled={currentPage === 1}
					className="p-1.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg transition disabled:opacity-30 disabled:pointer-events-none"
				>
					<FiChevronLeft size={13} />
				</button>
				<button
					type="button"
					onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
					disabled={currentPage === totalPages}
					className="p-1.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg transition disabled:opacity-30 disabled:pointer-events-none"
				>
					<FiChevronRight size={13} />
				</button>
			</div>
		</div>
	);
};

// ─── ADMIN TABLE ─────────────────────────────────────────────────────────────
interface AdminTableProps {
	children: React.ReactNode;
	className?: string;
}
export const AdminTable: React.FC<AdminTableProps> = ({ children, className = "" }) => {
	return (
		<div className={`overflow-x-auto ${className}`}>
			<table className="w-full text-xs text-left text-[var(--text-secondary)] border-collapse">
				{children}
			</table>
		</div>
	);
};

// ─── ADMIN MODAL ─────────────────────────────────────────────────────────────
interface AdminModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: React.ReactNode;
	className?: string;
}
export const AdminModal: React.FC<AdminModalProps> = ({ isOpen, onClose, title, children, className = "" }) => {
	if (!isOpen) return null;
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm animate-fade-in">
			<div className={`bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl p-6 shadow-2xl max-w-md w-full mx-4 animate-scale-up ${className}`}>
				<div className="flex justify-between items-center mb-6">
					<h3 className="text-base font-black text-[var(--text-primary)]">{title}</h3>
					<button
						type="button"
						onClick={onClose}
						className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
					>
						<FiX size={16} />
					</button>
				</div>
				{children}
			</div>
		</div>
	);
};

// ─── ADMIN CONFIRM DIALOG ─────────────────────────────────────────────────────
interface AdminConfirmDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	isDanger?: boolean;
	loading?: boolean;
}
export const AdminConfirmDialog: React.FC<AdminConfirmDialogProps> = ({
	isOpen,
	onClose,
	onConfirm,
	title,
	message,
	confirmText = "Confirm",
	cancelText = "Cancel",
	isDanger = false,
	loading = false
}) => {
	return (
		<AdminModal isOpen={isOpen} onClose={onClose} title={title}>
			<div className="space-y-6">
				<p className="text-xs text-[var(--text-secondary)] leading-relaxed flex items-start gap-2.5">
					{isDanger && <FiAlertTriangle className="text-red-450 mt-0.5 shrink-0" size={16} />}
					<span>{message}</span>
				</p>
				<div className="flex justify-end gap-2.5">
					<AdminActionButton variant="ghost" onClick={onClose} disabled={loading}>
						{cancelText}
					</AdminActionButton>
					<AdminActionButton
						variant={isDanger ? "danger" : "primary"}
						onClick={onConfirm}
						loading={loading}
					>
						{confirmText}
					</AdminActionButton>
				</div>
			</div>
		</AdminModal>
	);
};

// ─── ADMIN SECTION ───────────────────────────────────────────────────────────
interface AdminSectionProps {
	children: React.ReactNode;
	className?: string;
}
export const AdminSection: React.FC<AdminSectionProps> = ({ children, className = "" }) => {
	return <section className={`space-y-6 ${className}`}>{children}</section>;
};

// ─── CONFIRMATION MODAL ALIAS ─────────────────────────────────────────────────
// Alias for backwards compatibility with tab components that import ConfirmationModal
export const ConfirmationModal = AdminConfirmDialog;
