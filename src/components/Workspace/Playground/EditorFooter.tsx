import React, { useRef } from "react";
import { FaUpload } from "react-icons/fa";

type EditorFooterProps = {
	handleRun: () => void;
	handleSubmit: () => void;
	lightTheme?: boolean;
	onUploadFile: (code: string) => void;
	customInputChecked: boolean;
	setCustomInputChecked: (checked: boolean) => void;
	executingType: "run" | "submit" | null;
};

const EditorFooter: React.FC<EditorFooterProps> = ({
	handleRun,
	handleSubmit,
	lightTheme,
	onUploadFile,
	customInputChecked,
	setCustomInputChecked,
	executingType,
}) => {
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (event) => {
			if (event.target?.result) {
				onUploadFile(event.target.result as string);
			}
		};
		reader.readAsText(file);
	};

	return (
		<div className="flex w-full py-3 px-5 items-center justify-between border-t" style={{ background: "var(--bg-dark-layer-1)", borderColor: "var(--border-subtle)" }}>
			<input
				type='file'
				ref={fileInputRef}
				onChange={handleFileChange}
				className='hidden'
				accept='.js,.py,.cpp,.c,.java,.txt'
			/>

			{/* Left Actions */}
			<div className='flex items-center space-x-6 select-none'>
				<button
					type='button'
					onClick={() => fileInputRef.current?.click()}
					className="flex items-center gap-2 text-xs font-semibold hover:opacity-80 transition cursor-pointer underline"
					style={{ color: "var(--text-muted)" }}
				>
					<FaUpload size={12} />
					<span>Upload Code as File</span>
				</button>

				<label className="flex items-center gap-2 text-xs font-semibold cursor-pointer" style={{ color: "var(--text-muted)" }}>
					<input
						type='checkbox'
						checked={customInputChecked}
						onChange={(e) => setCustomInputChecked(e.target.checked)}
						className="rounded focus:ring-0 border-gray-805 text-brand-orange bg-dark-fill-3"
					/>
					<span>Test against custom input</span>
				</label>
			</div>

			{/* Right Action Buttons */}
			<div className='flex items-center space-x-3 select-none'>
				<button
					onClick={handleRun}
					disabled={executingType !== null}
					className="px-5 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 focus:outline-none flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed bg-dark-fill-3 text-text-secondary border border-border-subtle hover:text-text-primary hover:border-border-accent"
				>
					{executingType === "run" ? (
						<>
							<svg className='animate-spin h-3.5 w-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
								<circle cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='2' opacity='0.3' />
								<path d='M12 2a10 10 0 0110 10' strokeWidth='2' strokeLinecap='round' />
							</svg>
							<span>Running...</span>
						</>
					) : (
						<span>Run Code</span>
					)}
				</button>
				<button
					onClick={handleSubmit}
					disabled={executingType !== null}
					className="px-5 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 focus:outline-none text-white flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed bg-brand-orange hover:bg-brand-orange-s"
					style={{ boxShadow: "var(--shadow-glow-sm)" }}
				>
					{executingType === "submit" ? (
						<>
							<svg className='animate-spin h-3.5 w-3.5 text-white' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
								<circle cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='2' opacity='0.3' />
								<path d='M12 2a10 10 0 0110 10' strokeWidth='2' strokeLinecap='round' />
							</svg>
							<span>Submitting...</span>
						</>
					) : (
						<span>Submit Code</span>
					)}
				</button>
			</div>
		</div>
	);
};

export default EditorFooter;

