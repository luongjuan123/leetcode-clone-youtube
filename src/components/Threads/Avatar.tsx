import React, { useState, useEffect } from "react";
import { FaUser, FaCheckCircle } from "react-icons/fa";

interface AvatarProps {
	src?: string | null;
	displayName?: string;
	size?: number; // default 48
	showBadge?: boolean; // verified badge overlay
	isOnline?: boolean; // online status indicator
	className?: string;
}

const Avatar: React.FC<AvatarProps> = ({
	src,
	displayName = "User",
	size = 48,
	showBadge = false,
	isOnline = false,
	className = "",
}) => {
	const [imageSrc, setImageSrc] = useState<string | null>(null);
	const [hasError, setHasError] = useState(false);

	useEffect(() => {
		if (src) {
			setImageSrc(src);
			setHasError(false);
		} else {
			setImageSrc(null);
		}
	}, [src]);

	// Extract initials from displayName
	const initials = React.useMemo(() => {
		if (!displayName) return "U";
		const parts = displayName.trim().split(/\s+/);
		if (parts.length >= 2) {
			return (parts[0][0] + parts[1][0]).toUpperCase();
		}
		return displayName.substring(0, 2).toUpperCase();
	}, [displayName]);

	// Size classes
	const sizeStyle = {
		width: `${size}px`,
		height: `${size}px`,
		minWidth: `${size}px`,
		minHeight: `${size}px`,
	};

	const badgeSize = Math.max(12, Math.floor(size / 3.5));
	const onlineSize = Math.max(8, Math.floor(size / 5));

	return (
		<div
			style={sizeStyle}
			className={`relative rounded-full flex-shrink-0 select-none ${className}`}
		>
			{/* Avatar Image or Fallback */}
			<div className='w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-dark-fill-3 border border-slate-250 dark:border-slate-800/60'>
				{imageSrc && !hasError ? (
					<img
						src={imageSrc}
						alt={displayName}
						onError={() => setHasError(true)}
						className='w-full h-full object-cover rounded-full'
						loading='lazy'
					/>
				) : (
					<div className='w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-orange/25 to-yellow-600/10 text-brand-orange font-bold text-xs select-none font-mono'>
						{initials}
					</div>
				)}
			</div>

			{/* Online Indicator Badge overlay */}
			{isOnline && (
				<div
					style={{
						width: `${onlineSize}px`,
						height: `${onlineSize}px`,
						bottom: "1px",
						right: "1px",
					}}
					className='absolute rounded-full bg-green-500 border-2 border-white dark:border-dark-layer-2 shadow-lg'
					title='Online'
				/>
			)}

			{/* Verified Badge overlay */}
			{showBadge && (
				<div
					style={{
						bottom: "-1px",
						right: "-1px",
					}}
					className='absolute rounded-full bg-white dark:bg-[#121212] p-0.5 border border-slate-200 dark:border-slate-800/60 flex items-center justify-center text-brand-orange'
				>
					<FaCheckCircle size={badgeSize} />
				</div>
			)}
		</div>
	);
};

export default Avatar;
