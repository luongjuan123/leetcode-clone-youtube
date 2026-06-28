import React, { useState } from "react";

interface LogoProps {
	className?: string;
	iconOnly?: boolean;
	size?: number;
}

export const LogoIcon: React.FC<{ size?: number; className?: string; isHovered?: boolean }> = ({ 
	size = 36, 
	className = "", 
	isHovered: isHoveredProp 
}) => {
	const [localHover, setLocalHover] = useState(false);
	const activeHover = isHoveredProp !== undefined ? isHoveredProp : localHover;

	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 100 100"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={`inline-block select-none transition-all duration-300 ${className}`}
			onMouseEnter={() => setLocalHover(true)}
			onMouseLeave={() => setLocalHover(false)}
		>
			<defs>
				{/* Core Gradient */}
				<linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="var(--brand-orange)" />
					<stop offset="50%" stopColor="var(--brand-orange-s)" />
					<stop offset="100%" stopColor="var(--brand-orange)" />
				</linearGradient>
			</defs>

			{/* Glowing Outer Hexagon */}
			<polygon
				points="50,6 90,28 90,72 50,94 10,72 10,28"
				stroke="url(#logoGradient)"
				strokeWidth="5.5"
				strokeLinejoin="round"
				fill="var(--bg-base)"
				fillOpacity="0.85"
				style={{ 
					filter: activeHover 
						? "drop-shadow(0 0 14px var(--glow-color)) drop-shadow(0 0 4px var(--glow-color))" 
						: "drop-shadow(0 0 6px var(--glow-color))",
					transition: "filter 0.3s ease-out"
				}}
			/>

			{/* Left Bracket / Claw (<) */}
			<path
				d="M 37,32 L 21,50 L 37,68"
				stroke="var(--text-primary)"
				strokeWidth="7"
				strokeLinecap="round"
				strokeLinejoin="round"
				opacity="0.9"
			/>

			{/* Right Bracket / Claw (>) */}
			<path
				d="M 63,32 L 79,50 L 63,68"
				stroke="var(--text-primary)"
				strokeWidth="7"
				strokeLinecap="round"
				strokeLinejoin="round"
				opacity="0.9"
			/>

			{/* Center Slash / Flame (/) */}
			<path
				d="M 57,26 L 43,74"
				stroke="url(#logoGradient)"
				strokeWidth="7.5"
				strokeLinecap="round"
				style={{ 
					filter: activeHover 
						? "drop-shadow(0 0 9px var(--glow-color)) drop-shadow(0 0 2px var(--glow-color))" 
						: "drop-shadow(0 0 3px var(--glow-color))",
					transition: "filter 0.3s ease-out"
				}}
			/>
		</svg>
	);
};

export const Logo: React.FC<LogoProps> = ({ className = "", iconOnly = false, size = 38 }) => {
	const [isHovered, setIsHovered] = useState(false);

	if (iconOnly) {
		return (
			<LogoIcon 
				size={size} 
				className={className} 
				isHovered={isHovered} 
			/>
		);
	}

	return (
		<div 
			className={`flex items-center gap-2.5 select-none cursor-pointer ${className}`}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<LogoIcon size={size} isHovered={isHovered} />
			<span 
				className="text-2xl font-black tracking-tight font-sans transition-all duration-300" 
				style={{ 
					color: "var(--text-primary)",
					textShadow: isHovered ? "0 0 10px var(--glow-color)" : "none"
				}}
			>
				Beast<span 
					className="font-extrabold transition-all duration-300" 
					style={{ 
						color: "var(--brand-orange)",
						textShadow: isHovered ? "0 0 14px var(--glow-color)" : "none"
					}}
				>Code</span>
			</span>
		</div>
	);
};

export default Logo;
