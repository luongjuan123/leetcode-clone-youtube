import React, { useState, useEffect } from "react";
import { FaSearch, FaTimes, FaSpinner } from "react-icons/fa";

interface GifPickerProps {
	onSelect: (url: string) => void;
	onClose: () => void;
}

const DEFAULT_GIFS = [
	"https://media.giphy.com/media/3o7qE1YN7aBOFPRw8E/giphy.gif", // Coding
	"https://media.giphy.com/media/13HgwGsXF0aiGY/giphy.gif", // Typing
	"https://media.giphy.com/media/2IudUHdI075HL02tQH/giphy.gif", // Fast typing
	"https://media.giphy.com/media/ZVik7pBtu9RlJfXIqV/giphy.gif", // Debugging
	"https://media.giphy.com/media/t372ypP6E79EQ/giphy.gif", // Matrix
	"https://media.giphy.com/media/Q9aXC15zo91A6A6q99/giphy.gif", // Fire IT
	"https://media.giphy.com/media/9KCPkAcRqT9Df0ed5d/giphy.gif", // Mind blown
	"https://media.giphy.com/media/initial/giphy.gif", // Developer
];

const GifPicker: React.FC<GifPickerProps> = ({ onSelect, onClose }) => {
	const [searchQuery, setSearchQuery] = useState("");
	const [gifs, setGifs] = useState<string[]>(DEFAULT_GIFS);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (searchQuery.trim() === "") {
			setGifs(DEFAULT_GIFS);
			return;
		}

		const delayDebounce = setTimeout(async () => {
			setLoading(true);
			try {
				const apiKey = "dc6zaTOxFJmzC"; // Giphy Public Beta API key
				const res = await fetch(
					`https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(
						searchQuery
					)}&limit=12&rating=g`
				);
				const json = await res.json();
				if (json.data && json.data.length > 0) {
					const urls = json.data.map((item: any) => item.images.fixed_height.url);
					setGifs(urls);
				} else {
					setGifs([]);
				}
			} catch (e) {
				console.error("Giphy Search error:", e);
				// Fallback to filtering our preselected list
				const filtered = DEFAULT_GIFS.filter((gif) =>
					gif.toLowerCase().includes(searchQuery.toLowerCase())
				);
				setGifs(filtered);
			} finally {
				setLoading(false);
			}
		}, 600);

		return () => clearTimeout(delayDebounce);
	}, [searchQuery]);

	return (
		<div className='absolute z-50 bg-white dark:bg-dark-layer-1 border border-slate-200 dark:border-slate-800/60 rounded-2xl shadow-xl dark:shadow-none p-4 w-72 max-w-sm right-0 mt-2 animate-fade-in'>
			<div className='flex justify-between items-center mb-3 select-none'>
				<span className='text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider'>GIF Library</span>
				<button onClick={onClose} className='text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-white transition'>
					<FaTimes size={13} />
				</button>
			</div>

			<div className='relative flex items-center bg-slate-50 dark:bg-dark-fill-3 border border-slate-200 dark:border-slate-800/60 rounded-xl px-3 py-1.5 mb-3 hover:border-slate-300 dark:hover:border-slate-700 transition'>
				<FaSearch className='text-slate-400 dark:text-gray-500 mr-2 shrink-0' size={11} />
				<input
					type='text'
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					placeholder='Search GIFs...'
					className='bg-transparent text-xs text-slate-800 dark:text-gray-200 outline-none flex-1 placeholder:text-slate-400 dark:placeholder:text-gray-600 !border-0 !p-0 !ring-0 !shadow-none'
				/>
				{loading && <FaSpinner className='animate-spin text-brand-orange shrink-0' size={11} />}
			</div>

			<div className='grid grid-cols-2 gap-2 max-h-48 overflow-y-auto scrollbar-thin pr-0.5'>
				{gifs.map((url, idx) => (
					<div
						key={idx}
						onClick={() => onSelect(url)}
						className='relative aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800/60 cursor-pointer hover:border-brand-orange/60 hover:scale-102 transition duration-200 group bg-black/10 dark:bg-black/40'
					>
						<img src={url} alt='GIF' className='w-full h-full object-cover' />
					</div>
				))}

				{!loading && gifs.length === 0 && (
					<p className='col-span-2 text-center text-[10px] text-slate-500 dark:text-gray-500 py-6 italic'>
						No GIFs found. Try another search.
					</p>
				)}
			</div>
		</div>
	);
};

export default GifPicker;
