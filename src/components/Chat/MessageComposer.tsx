import React, { useState, useRef, useEffect, useCallback } from "react";
import {
	FaPaperPlane,
	FaPaperclip,
	FaCode,
	FaSmile,
	FaMicrophone,
	FaTimes,
	FaPencilAlt,
	FaCheck,
} from "react-icons/fa";
import { ChatAttachment, MessageReplyReference, ChatMessage } from "@/types/chat";
import { ReplyPreview } from "./ReplyPreview";
import { CodeSnippetModal } from "./CodeSnippetModal";
import { VoiceRecorder } from "./VoiceRecorder";

interface MessageComposerProps {
	conversationId: string;
	replyToMessage: ChatMessage | null;
	editingMessage?: ChatMessage | null;
	onCancelReply: () => void;
	onCancelEdit?: () => void;
	onEditMessage?: (messageId: string, newText: string) => Promise<void>;
	onSendMessage: (params: {
		text?: string;
		type?: "text" | "code" | "image" | "file" | "voice";
		code?: { language: string; content: string };
		attachments?: ChatAttachment[];
		replyTo?: MessageReplyReference;
	}) => Promise<void>;
	onTyping: () => void;
	disabled?: boolean;
	placeholder?: string;
}

const COMMON_EMOJIS = ["😀", "🔥", "🚀", "👍", "❤️", "🎉", "💯", "💻", "🤔", "👏", "✅", "⚡"];

export const MessageComposer: React.FC<MessageComposerProps> = ({
	conversationId,
	replyToMessage,
	editingMessage = null,
	onCancelReply,
	onCancelEdit,
	onEditMessage,
	onSendMessage,
	onTyping,
	disabled = false,
	placeholder = "Write a message... (Shift+Enter for newline)",
}) => {
	const [text, setText] = useState("");
	const [codeModalOpen, setCodeModalOpen] = useState(false);
	const [voiceRecording, setVoiceRecording] = useState(false);
	const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
	const [uploadingAttachment, setUploadingAttachment] = useState(false);
	const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
	const [isDragOver, setIsDragOver] = useState(false);

	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const prevConvIdRef = useRef<string>(conversationId);

	// Auto-expand textarea
	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
		}
	}, [text]);

	// Draft persistence per conversationId
	useEffect(() => {
		if (typeof window === "undefined") return;

		// If conversation switched, persist draft for old conversation if non-empty
		if (prevConvIdRef.current && prevConvIdRef.current !== conversationId) {
			if (text && !editingMessage) {
				sessionStorage.setItem(`beastcode_chat_draft_${prevConvIdRef.current}`, text);
			}
		}

		prevConvIdRef.current = conversationId;

		// Load draft for new conversation if not currently editing
		if (!editingMessage) {
			const savedDraft = sessionStorage.getItem(`beastcode_chat_draft_${conversationId}`) || "";
			setText(savedDraft);
		}
	}, [conversationId]);

	// Synchronize editing message
	useEffect(() => {
		if (editingMessage) {
			setText(editingMessage.text || "");
			if (textareaRef.current) {
				textareaRef.current.focus();
			}
		} else if (typeof window !== "undefined") {
			// Restore draft if editing was cancelled
			const savedDraft = sessionStorage.getItem(`beastcode_chat_draft_${conversationId}`) || "";
			setText(savedDraft);
		}
	}, [editingMessage, conversationId]);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Escape") {
			e.preventDefault();
			if (editingMessage) {
				onCancelEdit?.();
			} else if (replyToMessage) {
				onCancelReply();
			}
			return;
		}

		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const val = e.target.value;
		setText(val);

		// Cache draft in sessionStorage while typing (only when not editing an existing message)
		if (!editingMessage && typeof window !== "undefined") {
			if (val.trim()) {
				sessionStorage.setItem(`beastcode_chat_draft_${conversationId}`, val);
			} else {
				sessionStorage.removeItem(`beastcode_chat_draft_${conversationId}`);
			}
		}

		onTyping();
	};

	const handleSend = async () => {
		const trimmed = text.trim();
		if ((!trimmed && pendingAttachments.length === 0) || disabled) return;

		if (editingMessage) {
			if (!trimmed) return;
			const msgId = editingMessage.id;
			onCancelEdit?.();
			setText("");
			if (typeof window !== "undefined") {
				const savedDraft = sessionStorage.getItem(`beastcode_chat_draft_${conversationId}`) || "";
				setText(savedDraft);
			}
			if (onEditMessage) {
				await onEditMessage(msgId, trimmed);
			}
			return;
		}

		// Clear draft from storage on successful send
		if (typeof window !== "undefined") {
			sessionStorage.removeItem(`beastcode_chat_draft_${conversationId}`);
		}

		const replyTo: MessageReplyReference | undefined = replyToMessage
			? {
					messageId: replyToMessage.id,
					senderDisplayName: replyToMessage.senderDisplayName,
					textPreview:
						replyToMessage.text?.substring(0, 80) ||
						(replyToMessage.code ? "Code snippet" : "Attachment"),
					type: replyToMessage.type,
			  }
			: undefined;

		const attachmentsToSend = [...pendingAttachments];
		const messageText = trimmed;

		// Clear local state
		setText("");
		setPendingAttachments([]);
		onCancelReply();
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}

		await onSendMessage({
			text: messageText,
			attachments: attachmentsToSend.length > 0 ? attachmentsToSend : undefined,
			replyTo,
		});
	};

	const handleFileSelect = async (files: FileList | null) => {
		if (!files || files.length === 0) return;
		const file = files[0];

		if (file.size > 15 * 1024 * 1024) {
			alert("File exceeds maximum size of 15MB");
			return;
		}

		setUploadingAttachment(true);
		try {
			const reader = new FileReader();
			reader.readAsDataURL(file);
			reader.onloadend = async () => {
				const base64Data = reader.result as string;
				const idToken = await (await import("@/firebase/firebase")).auth.currentUser?.getIdToken();

				const res = await fetch("/api/chat/upload", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${idToken}`,
					},
					body: JSON.stringify({
						fileData: base64Data,
						fileName: file.name,
						conversationId,
					}),
				});

				const data = await res.json();
				if (data.success && data.attachment) {
					setPendingAttachments((prev) => [...prev, data.attachment]);
				} else {
					alert(data.error || "Failed to upload file");
				}
				setUploadingAttachment(false);
			};
		} catch (err: any) {
			console.error("[Attachment upload error]:", err);
			setUploadingAttachment(false);
		}
	};

	const handleSendVoice = async (base64Audio: string, durationSeconds: number) => {
		setVoiceRecording(false);
		try {
			const idToken = await (await import("@/firebase/firebase")).auth.currentUser?.getIdToken();
			const res = await fetch("/api/chat/upload", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${idToken}`,
				},
				body: JSON.stringify({
					fileData: base64Audio,
					fileName: `voice_${Date.now()}.webm`,
					conversationId,
					duration: durationSeconds,
				}),
			});
			const data = await res.json();
			if (data.success && data.attachment) {
				await onSendMessage({
					type: "voice",
					attachments: [data.attachment],
				});
			}
		} catch (err: any) {
			console.error("[Send voice error]:", err);
		}
	};

	return (
		<div
			onDragOver={(e) => {
				e.preventDefault();
				setIsDragOver(true);
			}}
			onDragLeave={() => setIsDragOver(false)}
			onDrop={(e) => {
				e.preventDefault();
				setIsDragOver(false);
				handleFileSelect(e.dataTransfer.files);
			}}
			className={`relative border-t border-border-default bg-dark-fill-2 transition-colors ${
				isDragOver ? "bg-brand-orange/10 border-brand-orange" : ""
			}`}
		>
			{/* Editing Banner */}
			{editingMessage && (
				<div className="flex items-center justify-between px-4 py-2 bg-dark-fill-3 border-t border-b border-border-subtle text-xs animate-slide-up">
					<div className="flex items-center gap-2.5 min-w-0">
						<div className="text-brand-orange">
							<FaPencilAlt size={12} />
						</div>
						<div className="border-l-2 border-brand-orange pl-2 min-w-0">
							<span className="font-bold text-text-primary block truncate">
								Editing message
							</span>
							<span className="text-text-muted truncate block text-[11px]">
								{editingMessage.text || (editingMessage.code ? "Code snippet" : "Attachment")}
							</span>
						</div>
					</div>

					<button
						type="button"
						onClick={onCancelEdit}
						className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-dark-fill-2 transition flex items-center gap-1"
						aria-label="Cancel editing"
						title="Cancel edit (Esc)"
					>
						<span className="text-[10px] text-text-muted hidden sm:inline">Esc to cancel</span>
						<FaTimes size={12} />
					</button>
				</div>
			)}

			{/* Replying Banner (mutually exclusive with editing) */}
			{!editingMessage && <ReplyPreview replyMessage={replyToMessage} onCancel={onCancelReply} />}

			{/* Drag & Drop Overlay */}
			{isDragOver && (
				<div className="absolute inset-0 z-30 flex items-center justify-center bg-dark-layer-1/90 border-2 border-dashed border-brand-orange text-brand-orange font-bold text-sm">
					Drop file here to upload to conversation
				</div>
			)}

			{/* Pending Attachments Strip */}
			{pendingAttachments.length > 0 && (
				<div className="flex flex-wrap gap-2 px-4 pt-2">
					{pendingAttachments.map((att, idx) => (
						<div
							key={att.id || idx}
							className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-dark-fill-3 border border-border-subtle text-xs"
						>
							<span className="truncate max-w-[150px] font-medium text-text-primary">
								{att.name}
							</span>
							<button
								type="button"
								onClick={() => setPendingAttachments((p) => p.filter((_, i) => i !== idx))}
								className="text-text-muted hover:text-rose-500 transition"
							>
								<FaTimes size={10} />
							</button>
						</div>
					))}
				</div>
			)}

			{/* Voice Recording Mode */}
			{voiceRecording ? (
				<div className="p-3">
					<VoiceRecorder
						onSendAudio={handleSendVoice}
						onCancel={() => setVoiceRecording(false)}
					/>
				</div>
			) : (
				/* Normal Composer Input */
				<div className="p-3 flex items-end gap-2">
					{/* Action Buttons: Attach, Code, Emoji */}
					<div className="flex items-center gap-1 pb-1">
						{/* Hidden File Input */}
						<input
							ref={fileInputRef}
							type="file"
							className="hidden"
							onChange={(e) => handleFileSelect(e.target.files)}
						/>
						<button
							type="button"
							onClick={() => fileInputRef.current?.click()}
							disabled={uploadingAttachment}
							className="p-2 rounded-xl text-text-muted hover:text-brand-orange hover:bg-dark-fill-3 transition disabled:opacity-50"
							title="Attach file or photo"
						>
							<FaPaperclip size={15} />
						</button>

						{/* Code Snippet Button */}
						<button
							type="button"
							onClick={() => setCodeModalOpen(true)}
							className="p-2 rounded-xl text-text-muted hover:text-brand-orange hover:bg-dark-fill-3 transition"
							title="Share code snippet"
						>
							<FaCode size={15} />
						</button>

						{/* Emoji Popover Trigger */}
						<div className="relative">
							<button
								type="button"
								onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
								className="p-2 rounded-xl text-text-muted hover:text-brand-orange hover:bg-dark-fill-3 transition"
								title="Add emoji"
							>
								<FaSmile size={15} />
							</button>

							{emojiPickerOpen && (
								<>
									<div
										className="fixed inset-0 z-30"
										onClick={() => setEmojiPickerOpen(false)}
									/>
									<div className="absolute bottom-full left-0 mb-2 z-40 p-2 rounded-2xl bg-dark-layer-1 border border-border-default shadow-2xl grid grid-cols-4 gap-1.5 animate-scale-in">
										{COMMON_EMOJIS.map((em) => (
											<button
												key={em}
												type="button"
												onClick={() => {
													setText((prev) => prev + em);
													setEmojiPickerOpen(false);
													textareaRef.current?.focus();
												}}
												className="p-1.5 text-lg hover:scale-125 transition select-none"
											>
												{em}
											</button>
										))}
									</div>
								</>
							)}
						</div>
					</div>

					{/* Auto-expanding Textarea */}
					<div className="flex-1 relative">
						<textarea
							ref={textareaRef}
							value={text}
							onChange={handleTextChange}
							onKeyDown={handleKeyDown}
							placeholder={disabled ? "Posting restricted in this channel" : placeholder}
							disabled={disabled}
							rows={1}
							className="w-full text-xs sm:text-sm py-2 px-3 rounded-xl bg-dark-fill-3 border border-border-default text-text-primary focus:border-brand-orange focus:outline-none resize-none max-h-40 disabled:opacity-50 leading-relaxed"
						/>
					</div>

					{/* Send, Save or Voice Record Button */}
					<div className="pb-1">
						{editingMessage ? (
							<button
								type="button"
								onClick={handleSend}
								disabled={disabled || !text.trim()}
								className="p-2.5 rounded-xl bg-brand-orange text-white hover:bg-brand-orange-hover transition shadow-md shadow-brand-orange/20 disabled:opacity-50 flex items-center gap-1.5 text-xs font-bold"
								title="Save changes (Enter)"
							>
								<FaCheck size={12} />
								<span className="hidden sm:inline">Save</span>
							</button>
						) : text.trim() || pendingAttachments.length > 0 ? (
							<button
								type="button"
								onClick={handleSend}
								disabled={disabled}
								className="p-2.5 rounded-xl bg-brand-orange text-white hover:bg-brand-orange-hover transition shadow-md shadow-brand-orange/20 disabled:opacity-50"
								title="Send message (Enter)"
							>
								<FaPaperPlane size={14} />
							</button>
						) : (
							<button
								type="button"
								onClick={() => setVoiceRecording(true)}
								disabled={disabled}
								className="p-2.5 rounded-xl text-text-muted hover:text-brand-orange hover:bg-dark-fill-3 transition disabled:opacity-50"
								title="Record voice message"
							>
								<FaMicrophone size={15} />
							</button>
						)}
					</div>
				</div>
			)}

			{/* Code Snippet Modal */}
			<CodeSnippetModal
				isOpen={codeModalOpen}
				onClose={() => setCodeModalOpen(false)}
				onSubmit={(code, comment) => {
					onSendMessage({
						type: "code",
						code,
						text: comment,
					});
				}}
			/>
		</div>
	);
};
