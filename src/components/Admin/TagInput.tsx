import React, { useState, KeyboardEvent } from "react";
import { FaTimes } from "react-icons/fa";

interface TagInputProps {
	tags: string[];
	onChange: (tags: string[]) => void;
	placeholder?: string;
}

const TagInput: React.FC<TagInputProps> = ({ tags, onChange, placeholder = "add a tag" }) => {
	const [input, setInput] = useState("");

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" || e.key === ",") {
			e.preventDefault();
			const trimmed = input.trim().replace(/^,+|,+$/g, "");
			if (trimmed && !tags.includes(trimmed)) {
				const newTags = [...tags, trimmed];
				onChange(newTags);
				setInput("");
			}
		} else if (e.key === "Backspace" && !input && tags.length > 0) {
			const newTags = tags.slice(0, -1);
			onChange(newTags);
		}
	};

	const removeTag = (indexToRemove: number) => {
		const newTags = tags.filter((_, index) => index !== indexToRemove);
		onChange(newTags);
	};

	return (
		<div className="border border-gray-300 rounded p-2 bg-white flex flex-wrap gap-2 items-center focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition shadow-sm min-h-[42px]">
			{tags.map((tag, index) => (
				<span
					key={index}
					className="inline-flex items-center gap-1.5 bg-[#dbe8d2] text-[#4b7a2d] px-2 py-1 rounded text-xs font-semibold select-none border border-[#c1d9b0]"
				>
					{tag}
					<button
						type="button"
						onClick={() => removeTag(index)}
						className="hover:bg-[#cbdec0] p-0.5 rounded transition text-[#3f6726]"
					>
						<FaTimes size={10} />
					</button>
				</span>
			))}
			<input
				type="text"
				value={input}
				onChange={(e) => setInput(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={tags.length === 0 ? placeholder : ""}
				className="flex-1 min-w-[120px] outline-none text-sm text-gray-700 bg-transparent"
			/>
		</div>
	);
};

export default TagInput;
