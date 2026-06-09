import React, { useRef, useState } from "react";
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { FaBold, FaItalic, FaListUl, FaListOl, FaImage, FaLink, FaCode } from "react-icons/fa";

interface MarkdownEditorProps {
	value: string;
	onChange: (val: string) => void;
	placeholder?: string;
	height?: string;
	maxChars?: number;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
	value,
	onChange,
	placeholder = "",
	height = "200px",
	maxChars,
}) => {
	const editorRef = useRef<ReactCodeMirrorRef>(null);
	const [preview, setPreview] = useState(false);

	const handleToolbarClick = (action: string) => {
		if (preview) return;

		const view = editorRef.current?.view;
		if (!view) return;

		const { state } = view;
		const selection = state.selection.main;
		const selectedText = state.sliceDoc(selection.from, selection.to);

		let insertText = "";
		let selectionOffsetStart = 0;
		let selectionOffsetEnd = 0;

		switch (action) {
			case "bold":
				insertText = `**${selectedText || "bold text"}**`;
				selectionOffsetStart = 2;
				selectionOffsetEnd = insertText.length - 2;
				break;
			case "italic":
				insertText = `*${selectedText || "italic text"}*`;
				selectionOffsetStart = 1;
				selectionOffsetEnd = insertText.length - 1;
				break;
			case "unordered-list":
				insertText = `\n* ${selectedText || "item"}`;
				selectionOffsetStart = 3;
				selectionOffsetEnd = insertText.length;
				break;
			case "ordered-list":
				insertText = `\n1. ${selectedText || "item"}`;
				selectionOffsetStart = 4;
				selectionOffsetEnd = insertText.length;
				break;
			case "image":
				insertText = `![${selectedText || "image alt"}](url)`;
				selectionOffsetStart = 2;
				selectionOffsetEnd = 2 + (selectedText || "image alt").length;
				break;
			case "link":
				insertText = `[${selectedText || "link text"}](url)`;
				selectionOffsetStart = 1;
				selectionOffsetEnd = 1 + (selectedText || "link text").length;
				break;
			case "code":
				insertText = `\`\`\`\n${selectedText || "code block"}\n\`\`\``;
				selectionOffsetStart = 4;
				selectionOffsetEnd = 4 + (selectedText || "code block").length;
				break;
			default:
				return;
		}

		view.dispatch({
			changes: {
				from: selection.from,
				to: selection.to,
				insert: insertText,
			},
			selection: {
				anchor: selection.from + selectionOffsetStart,
				head: selection.from + selectionOffsetEnd,
			},
		});

		view.focus();
	};

	// Helper to render markdown/HTML. If simple markdown is used, convert basic features.
	const renderPreviewContent = (text: string) => {
		if (!text) return `<p class="text-gray-400 italic">Nothing to preview</p>`;
		
		// Very simple regex-based markdown to HTML converter for basic tags
		let html = text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			// Bold
			.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
			// Italic
			.replace(/\*(.*?)\*/g, "<em>$1</em>")
			// Code Block
			.replace(/```([\s\S]*?)```/g, "<pre class='bg-gray-100 p-3 rounded my-2 font-mono text-xs text-gray-800 border border-gray-200 overflow-auto'>$1</pre>")
			// Inline code
			.replace(/`(.*?)`/g, "<code class='bg-gray-100 px-1 py-0.5 rounded font-mono text-xs text-red-600'>$1</code>")
			// Image
			.replace(/!\[(.*?)\]\((.*?)\)/g, "<img src='$2' alt='$1' class='max-w-full h-auto rounded my-2' />")
			// Link
			.replace(/\[(.*?)\]\((.*?)\)/g, "<a href='$2' target='_blank' class='text-blue-600 underline hover:text-blue-800'>$1</a>")
			// Unordered List
			.replace(/^\s*\*\s+(.*)$/gm, "<li class='list-disc ml-5'>$1</li>")
			// Ordered List
			.replace(/^\s*\d+\.\s+(.*)$/gm, "<li class='list-decimal ml-5'>$1</li>")
			// Paragraphs / Newlines
			.split("\n")
			.map(line => {
				if (line.trim().startsWith("<li") || line.trim().startsWith("<pre") || line.trim().startsWith("</pre")) return line;
				return line.trim() ? `<p class='my-1'>${line}</p>` : "<br />";
			})
			.join("\n");

		return html;
	};

	return (
		<div className="border border-gray-300 rounded bg-white text-gray-800 flex flex-col shadow-sm">
			{/* Toolbar */}
			<div className="flex justify-between items-center bg-gray-50 border-b border-gray-300 px-3 py-1.5 select-none">
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={() => handleToolbarClick("bold")}
						disabled={preview}
						className="p-2 hover:bg-gray-200 rounded text-gray-600 hover:text-gray-900 transition disabled:opacity-50 disabled:hover:bg-transparent"
						title="Bold"
					>
						<FaBold size={13} />
					</button>
					<button
						type="button"
						onClick={() => handleToolbarClick("italic")}
						disabled={preview}
						className="p-2 hover:bg-gray-200 rounded text-gray-600 hover:text-gray-900 transition disabled:opacity-50 disabled:hover:bg-transparent font-serif italic font-bold"
						title="Italic"
					>
						<FaItalic size={13} />
					</button>
					<div className="w-px h-5 bg-gray-300 mx-1" />
					<button
						type="button"
						onClick={() => handleToolbarClick("unordered-list")}
						disabled={preview}
						className="p-2 hover:bg-gray-200 rounded text-gray-600 hover:text-gray-900 transition disabled:opacity-50 disabled:hover:bg-transparent"
						title="Bullet List"
					>
						<FaListUl size={13} />
					</button>
					<button
						type="button"
						onClick={() => handleToolbarClick("ordered-list")}
						disabled={preview}
						className="p-2 hover:bg-gray-200 rounded text-gray-600 hover:text-gray-900 transition disabled:opacity-50 disabled:hover:bg-transparent"
						title="Numbered List"
					>
						<FaListOl size={13} />
					</button>
					<div className="w-px h-5 bg-gray-300 mx-1" />
					<button
						type="button"
						onClick={() => handleToolbarClick("image")}
						disabled={preview}
						className="p-2 hover:bg-gray-200 rounded text-gray-600 hover:text-gray-900 transition disabled:opacity-50 disabled:hover:bg-transparent"
						title="Image"
					>
						<FaImage size={13} />
					</button>
					<button
						type="button"
						onClick={() => handleToolbarClick("link")}
						disabled={preview}
						className="p-2 hover:bg-gray-200 rounded text-gray-600 hover:text-gray-900 transition disabled:opacity-50 disabled:hover:bg-transparent"
						title="Link"
					>
						<FaLink size={13} />
					</button>
					<button
						type="button"
						onClick={() => handleToolbarClick("code")}
						disabled={preview}
						className="p-2 hover:bg-gray-200 rounded text-gray-600 hover:text-gray-900 transition disabled:opacity-50 disabled:hover:bg-transparent"
						title="Code Block"
					>
						<FaCode size={13} />
					</button>
				</div>

				<button
					type="button"
					onClick={() => setPreview(!preview)}
					className={`text-xs px-3 py-1 rounded border border-gray-300 shadow-sm font-semibold transition hover:bg-gray-100 ${
						preview ? "bg-blue-50 text-blue-600 border-blue-300 hover:bg-blue-100" : "bg-white text-gray-700"
					}`}
				>
					{preview ? "Edit" : "Preview"}
				</button>
			</div>

			{/* Editor Content Area */}
			<div className="relative flex-1 min-h-[150px]">
				{preview ? (
					<div
						className="p-4 overflow-y-auto bg-gray-50 text-gray-800 text-sm font-sans"
						style={{ height }}
						dangerouslySetInnerHTML={{ __html: renderPreviewContent(value) }}
					/>
				) : (
					<CodeMirror
						ref={editorRef}
						value={value}
						height={height}
						placeholder={placeholder}
						onChange={onChange}
						className="outline-none text-sm md:text-base border-none custom-cm-editor"
						basicSetup={{
							lineNumbers: true,
							foldGutter: false,
							highlightActiveLine: true,
							dropCursor: true,
							allowMultipleSelections: false,
							indentOnInput: true,
						}}
					/>
				)}
			</div>

			{/* Gutter / Footer */}
			{maxChars && (
				<div className="bg-gray-50 border-t border-gray-200 px-3 py-1 text-right text-xs text-gray-500 font-semibold select-none">
					Characters left: {Math.max(0, maxChars - value.length)}
				</div>
			)}
		</div>
	);
};

export default MarkdownEditor;
