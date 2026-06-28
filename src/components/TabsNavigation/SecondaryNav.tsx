import React from "react";
import Link from "next/link";

export interface TabItem {
	id: string;
	label: string;
	icon?: React.ReactNode;
	disabled?: boolean;
	enabled?: boolean;
	href?: string;
}

interface SecondaryNavProps {
	tabs: TabItem[] | readonly TabItem[];
	activeTab: string;
	onChange?: (id: any) => void;
	className?: string;
}

export const SecondaryNav: React.FC<SecondaryNavProps> = ({
	tabs,
	activeTab,
	onChange,
	className = "",
}) => {
	return (
		<div className={`overflow-x-auto scrollbar-none shrink-0 p-1.5 ${className}`}>
			<div
				className="flex items-center gap-1.5 p-1 rounded-2xl border transition-all duration-300 w-max max-w-full"
				style={{
					backgroundColor: "var(--bg-dark-layer-1)",
					borderColor: "var(--border-subtle)",
				}}
			>
				{tabs.map((tab) => {
					const isActive = activeTab === tab.id;
					const isDisabled = tab.disabled || tab.enabled === false;
					if (isDisabled) {
						return (
							<div
								key={tab.id}
								className="px-5 py-2.5 rounded-xl text-xs font-semibold cursor-not-allowed select-none border border-transparent text-text-muted"
								style={{
									backgroundColor: "color-mix(in srgb, var(--bg-dark-fill-2) 20%, transparent)"
								}}
								title="Feature coming soon"
							>
								{tab.label}
							</div>
						);
					}

					const commonClass = `flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 select-none cursor-pointer border ${
						isActive
							? "border-border-accent glow-sm font-extrabold"
							: "border-transparent text-text-secondary hover:text-text-primary hover:bg-dark-fill-3"
					}`;

					const commonStyle = {
						backgroundColor: isActive ? "var(--bg-surface)" : "transparent",
						color: isActive ? "var(--brand-orange)" : "var(--text-secondary)",
					};

					if (tab.href) {
						return (
							<Link
								key={tab.id}
								href={tab.href}
								onClick={() => onChange?.(tab.id)}
								className={commonClass}
								style={commonStyle}
							>
								{tab.icon && <span className="flex items-center justify-center shrink-0">{tab.icon}</span>}
								<span>{tab.label}</span>
							</Link>
						);
					}

					return (
						<button
							key={tab.id}
							onClick={() => onChange?.(tab.id)}
							className={commonClass}
							style={commonStyle}
						>
							{tab.icon && <span className="flex items-center justify-center shrink-0">{tab.icon}</span>}
							<span>{tab.label}</span>
						</button>
					);
				})}
			</div>
		</div>
	);
};

export default SecondaryNav;
