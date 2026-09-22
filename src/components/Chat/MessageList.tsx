import React, { useRef, useEffect, useState, useMemo } from "react";
import { FaChevronDown } from "react-icons/fa";
import { ChatMessage, ChatAttachment } from "@/types/chat";
import { MessageGroup } from "./MessageGroup";

interface MessageListProps {
	messages: ChatMessage[];
	currentUserId?: string;
	isStaff?: boolean;
	initialLastReadAt?: number | null;
	loading: boolean;
	loadingOlder: boolean;
	hasMoreOlder: boolean;
	onLoadOlder: () => void;
	onReply: (msg: ChatMessage) => void;
	onReact: (msgId: string, emoji: string) => void;
	onEdit?: (msg: ChatMessage) => void;
	onDelete?: (msgId: string) => void;
	onPin?: (msgId: string) => void;
	onReport?: (msg: ChatMessage) => void;
	onRetry?: (clientMsgId: string) => void;
	onOpenMedia?: (attachment: ChatAttachment) => void;
}

function formatDateDivider(timestamp: number): string {
	const date = new Date(timestamp);
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);

	if (date.toDateString() === today.toDateString()) {
		return "Today";
	}
	if (date.toDateString() === yesterday.toDateString()) {
		return "Yesterday";
	}
	return date.toLocaleDateString(undefined, {
		weekday: "short",
		month: "short",
		day: "numeric",
		year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
	});
}

export const MessageList: React.FC<MessageListProps> = ({
	messages,
	currentUserId,
	isStaff,
	initialLastReadAt,
	loading,
	loadingOlder,
	hasMoreOlder,
	onLoadOlder,
	onReply,
	onReact,
	onEdit,
	onDelete,
	onPin,
	onReport,
	onRetry,
	onOpenMedia,
}) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const bottomSentinelRef = useRef<HTMLDivElement>(null);
	const prevScrollHeightRef = useRef<number>(0);
	const [isAtBottom, setIsAtBottom] = useState(true);
	const [unreadBelowCount, setUnreadBelowCount] = useState(0);

	// Find first unread incoming message to place unread divider
	const firstUnreadMessageId = useMemo(() => {
		if (!initialLastReadAt || initialLastReadAt <= 0) return null;
		const unreadMsg = messages.find(
			(m) => m.senderId !== currentUserId && m.createdAt > initialLastReadAt
		);
		return unreadMsg ? unreadMsg.id : null;
	}, [messages, currentUserId, initialLastReadAt]);

	// Group messages by date and consecutive sender
	const groupedMessageBlocks = useMemo(() => {
		const groups: {
			key: string;
			messages: ChatMessage[];
			isOutgoing: boolean;
			dateDivider: string | null;
			isUnreadDivider?: boolean;
		}[] = [];

		let lastDateStr = "";
		let currentGroup: ChatMessage[] = [];
		let currentSenderId = "";
		let currentTimestamp = 0;

		messages.forEach((msg, idx) => {
			const dateStr = formatDateDivider(msg.createdAt);
			const isNewDay = dateStr !== lastDateStr;
			const isFirstUnread = firstUnreadMessageId && msg.id === firstUnreadMessageId;
			const isSameSender = msg.senderId === currentSenderId;
			const isWithin5Min = msg.createdAt - currentTimestamp < 5 * 60 * 1000;

			if (isFirstUnread || isNewDay || !isSameSender || !isWithin5Min) {
				if (currentGroup.length > 0) {
					groups.push({
						key: `grp_${currentGroup[0].id || currentGroup[0].clientMessageId}_${idx}`,
						messages: currentGroup,
						isOutgoing: currentGroup[0].senderId === currentUserId,
						dateDivider: null,
					});
					currentGroup = [];
				}
				if (isNewDay) {
					lastDateStr = dateStr;
				}
			}

			if (isNewDay && currentGroup.length === 0) {
				// We attach dateDivider to the next group
				groups.push({
					key: `divider_${dateStr}_${idx}`,
					messages: [],
					isOutgoing: false,
					dateDivider: dateStr,
				});
			}

			if (isFirstUnread) {
				groups.push({
					key: `unread_divider_${msg.id || idx}`,
					messages: [],
					isOutgoing: false,
					dateDivider: null,
					isUnreadDivider: true,
				});
			}

			currentGroup.push(msg);
			currentSenderId = msg.senderId;
			currentTimestamp = msg.createdAt;
		});

		if (currentGroup.length > 0) {
			groups.push({
				key: `grp_${currentGroup[0].id || currentGroup[0].clientMessageId}_end`,
				messages: currentGroup,
				isOutgoing: currentGroup[0].senderId === currentUserId,
				dateDivider: null,
			});
		}

		return groups;
	}, [messages, currentUserId, firstUnreadMessageId]);

	// Scroll handler for auto-load older and detecting bottom
	const handleScroll = () => {
		const container = containerRef.current;
		if (!container) return;

		const threshold = 60;
		const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
		setIsAtBottom(atBottom);

		if (atBottom) {
			setUnreadBelowCount(0);
		}

		// Near top: load older messages
		if (container.scrollTop < 100 && hasMoreOlder && !loadingOlder) {
			prevScrollHeightRef.current = container.scrollHeight;
			onLoadOlder();
		}
	};

	// Preserve scroll position when older messages are loaded
	useEffect(() => {
		if (prevScrollHeightRef.current > 0 && containerRef.current) {
			const newHeight = containerRef.current.scrollHeight;
			const diff = newHeight - prevScrollHeightRef.current;
			containerRef.current.scrollTop += diff;
			prevScrollHeightRef.current = 0;
		}
	}, [messages]);

	// Auto-scroll to bottom on initial load or if user is already at bottom
	useEffect(() => {
		if (isAtBottom) {
			bottomSentinelRef.current?.scrollIntoView({ behavior: "smooth" });
		} else {
			setUnreadBelowCount((c) => c + 1);
		}
	}, [messages.length]);

	const scrollToBottom = () => {
		bottomSentinelRef.current?.scrollIntoView({ behavior: "smooth" });
		setUnreadBelowCount(0);
		setIsAtBottom(true);
	};

	const jumpToMessage = (msgId: string) => {
		const el = document.getElementById(`msg_${msgId}`);
		if (el) {
			el.scrollIntoView({ behavior: "smooth", block: "center" });
			el.classList.add("ring-2", "ring-brand-orange", "transition-all");
			setTimeout(() => {
				el.classList.remove("ring-2", "ring-brand-orange");
			}, 2000);
		}
	};

	return (
		<div className="relative flex-1 h-full overflow-hidden flex flex-col bg-dark-layer-2">
			{/* Scrollable Container */}
			<div
				ref={containerRef}
				onScroll={handleScroll}
				className="flex-1 overflow-y-auto px-2 sm:px-4 py-4 scroll-smooth"
			>
				{/* Constrained reading column for large displays */}
				<div className="max-w-4xl mx-auto w-full flex flex-col gap-2 min-h-full justify-end">
					{/* Top loading older spinner */}
					{loadingOlder && (
						<div className="flex justify-center py-2">
							<div className="w-5 h-5 border-2 border-brand-orange border-t-transparent rounded-full animate-spin"></div>
						</div>
					)}

					{/* Initial loading state */}
					{loading && messages.length === 0 && (
						<div className="flex-1 flex items-center justify-center py-12 text-xs text-text-muted">
							<div className="flex items-center gap-2">
								<div className="w-4 h-4 border-2 border-brand-orange border-t-transparent rounded-full animate-spin"></div>
								<span>Loading messages...</span>
							</div>
						</div>
					)}

					{/* Empty conversation placeholder */}
					{!loading && messages.length === 0 && (
						<div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-text-muted select-none py-16">
							<div className="text-3xl mb-2">💬</div>
							<div className="text-sm font-bold text-text-secondary mb-1">
								No messages here yet
							</div>
							<p className="text-xs max-w-xs">
								Send a message or code snippet below to start this conversation!
							</p>
						</div>
					)}

					{/* Grouped Message Stream */}
					{groupedMessageBlocks.map((block) => {
						if (block.isUnreadDivider) {
							return (
								<div key={block.key} className="flex items-center gap-3 my-4 select-none animate-fade-in">
									<div className="flex-1 border-t border-brand-orange/40" />
									<span className="px-3 py-0.5 rounded-full text-[10px] font-bold bg-brand-orange/15 border border-brand-orange/40 text-brand-orange shadow-sm tracking-wide uppercase">
										New Messages
									</span>
									<div className="flex-1 border-t border-brand-orange/40" />
								</div>
							);
						}

						if (block.dateDivider) {
							return (
								<div key={block.key} className="flex items-center justify-center my-3 select-none">
									<span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-dark-fill-3 border border-border-subtle text-text-muted shadow-sm">
										{block.dateDivider}
									</span>
								</div>
							);
						}

						return (
							<MessageGroup
								key={block.key}
								messages={block.messages}
								isOutgoing={block.isOutgoing}
								currentUserId={currentUserId}
								isStaff={isStaff}
								onReply={onReply}
								onReact={onReact}
								onEdit={onEdit}
								onDelete={onDelete}
								onPin={onPin}
								onReport={onReport}
								onRetry={onRetry}
								onOpenMedia={onOpenMedia}
								onJumpToMessage={jumpToMessage}
							/>
						);
					})}

					<div ref={bottomSentinelRef} className="h-2" />
				</div>
			</div>

			{/* Floating "Scroll to bottom" button */}
			{!isAtBottom && (
				<button
					type="button"
					onClick={scrollToBottom}
					className="absolute bottom-4 right-6 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-dark-layer-1 border border-border-default shadow-xl text-text-primary hover:text-brand-orange transition select-none z-30"
				>
					<FaChevronDown size={11} />
					{unreadBelowCount > 0 ? (
						<span className="text-[11px] font-bold text-brand-orange">
							{unreadBelowCount} new
						</span>
					) : (
						<span className="text-[11px] font-semibold">Latest</span>
					)}
				</button>
			)}
		</div>
	);
};
