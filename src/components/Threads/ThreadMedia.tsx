import React, { useState } from "react";
import { FaChevronLeft, FaChevronRight, FaHeart } from "react-icons/fa";

interface ThreadMediaProps {
	photos?: string[];
	gif?: string | null;
	onDoubleTap?: () => void;
}

const ThreadMedia: React.FC<ThreadMediaProps> = ({
	photos = [],
	gif = null,
	onDoubleTap,
}) => {
	const [activeIdx, setActiveIdx] = useState(0);
	const [doubleTapAnim, setDoubleTapAnim] = useState(false);

	const handleDoubleTap = (e: React.MouseEvent) => {
		if (onDoubleTap) {
			onDoubleTap();
		}
		setDoubleTapAnim(true);
		setTimeout(() => setDoubleTapAnim(false), 800);
	};

	const hasPhotos = photos && photos.length > 0;
	const totalPhotos = photos.length;

	if (!hasPhotos && !gif) return null;

	return (
		<div
			onDoubleClick={handleDoubleTap}
			className='relative w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800/60 bg-black/5 dark:bg-black/10 select-none'
		>
			{/* Double-tap Heart Pop Animation */}
			{doubleTapAnim && (
				<div className='absolute inset-0 flex items-center justify-center z-30 pointer-events-none'>
					<FaHeart className='text-red-500 scale-0 animate-heart-pop drop-shadow-lg' size={64} />
				</div>
			)}

			{/* GIF Rendering */}
			{gif && !hasPhotos && (
				<div className='w-full overflow-hidden rounded-xl bg-black/20 aspect-video'>
					<img
						src={gif}
						alt='Thread GIF'
						className='w-full h-full object-cover rounded-xl'
						loading='lazy'
					/>
				</div>
			)}

			{/* Single Photo Rendering */}
			{hasPhotos && totalPhotos === 1 && (
				<div className='w-full overflow-hidden rounded-xl bg-black/10 flex items-center justify-center'>
					<img
						src={photos[0]}
						alt='Attachment'
						className='w-full h-auto max-h-[520px] object-contain rounded-xl'
						loading='lazy'
					/>
				</div>
			)}

			{/* Double Photos Split Layout */}
			{hasPhotos && totalPhotos === 2 && (
				<div className='grid grid-cols-2 gap-1.5 w-full aspect-video overflow-hidden rounded-xl'>
					{photos.map((photo, idx) => (
						<div key={idx} className='w-full h-full overflow-hidden relative'>
							<img
								src={photo}
								alt={`Attachment ${idx + 1}`}
								className='w-full h-full object-cover hover:scale-101 transition duration-200'
								loading='lazy'
							/>
						</div>
					))}
				</div>
			)}

			{/* Triple Photos Collage Layout */}
			{hasPhotos && totalPhotos === 3 && (
				<div className='grid grid-cols-3 gap-1.5 w-full aspect-video overflow-hidden rounded-xl'>
					<div className='col-span-2 w-full h-full overflow-hidden relative'>
						<img
							src={photos[0]}
							alt='Attachment 1'
							className='w-full h-full object-cover hover:scale-101 transition duration-200'
							loading='lazy'
						/>
					</div>
					<div className='grid grid-rows-2 gap-1.5 w-full h-full'>
						{photos.slice(1, 3).map((photo, idx) => (
							<div key={idx} className='w-full h-full overflow-hidden relative'>
								<img
									src={photo}
									alt={`Attachment ${idx + 2}`}
									className='w-full h-full object-cover hover:scale-101 transition duration-200'
									loading='lazy'
								/>
							</div>
						))}
					</div>
				</div>
			)}

			{/* 4+ Photos Collage Layout / Swiper Option */}
			{hasPhotos && totalPhotos >= 4 && (
				<div className='relative w-full aspect-video overflow-hidden rounded-xl group'>
					<img
						src={photos[activeIdx]}
						alt={`Attachment ${activeIdx + 1}`}
						className='w-full h-full object-cover transition-all duration-300'
						loading='lazy'
					/>

					{/* Navigation Arrow buttons */}
					{totalPhotos > 1 && (
						<>
							<button
								onClick={(e) => {
									e.stopPropagation();
									setActiveIdx((prev) => (prev > 0 ? prev - 1 : totalPhotos - 1));
								}}
								className='absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 hover:scale-105 transition z-10 shrink-0'
							>
								<FaChevronLeft size={10} />
							</button>
							<button
								onClick={(e) => {
									e.stopPropagation();
									setActiveIdx((prev) => (prev < totalPhotos - 1 ? prev + 1 : 0));
								}}
								className='absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 hover:scale-105 transition z-10 shrink-0'
							>
								<FaChevronRight size={10} />
							</button>
						</>
					)}

					{/* Overlay Count / Indicators */}
					<div className='absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 px-3 py-1 rounded-full flex gap-1.5 items-center select-none text-[10px] text-gray-300 font-mono z-10 shrink-0'>
						<span>{activeIdx + 1} / {totalPhotos}</span>
					</div>
				</div>
			)}
		</div>
	);
};

export default ThreadMedia;
