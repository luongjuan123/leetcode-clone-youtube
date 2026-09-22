import React, { useState, useMemo } from "react";
import { FaSearch, FaPlus, FaComments, FaUsers, FaEnvelopeOpenText } from "react-icons/fa";
import { Conversation } from "@/types/chat";
import { ConversationRow } from "./ConversationRow";

interface ConversationSidebarProps {
	conversations: Conversation[];
	selectedConversationId: string | null;
	currentUserId?: string;
	onSelectConversation: (conv: Conversation) => void;
	onNewConversation: () => void;
	loading?: boolean;
}

type FilterTab = "all" | "direct" | "orgs" | "unread";

export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
	conversations,
	selectedConversationId,
	currentUserId,
	onSelectConversation,
	onNewConversation,
	loading,
}) => {
	const [searchQuery, setSearchQuery] = useState("");
	const [activeTab, setActiveTab] = useState<FilterTab>("all");

	// Filter and search
	const filteredConversations = useMemo(() => {
		let list = [...conversations];

		// Apply tab filter
		if (activeTab === "direct") {
			list = list.filter((c) => c.type === "direct");
		} else if (activeTab === "orgs") {
			list = list.filter((c) => c.type === "organization_channel");
		} else if (activeTab === "unread") {
			list = list.filter((c) => c.isUnread);
		}

		// Apply text search
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase().trim();
			list = list.filter((c) => {
				const titleMatch = c.title.toLowerCase().includes(q);
				const orgMatch = c.organizationName?.toLowerCase().includes(q);
				const previewMatch = c.lastMessagePreview?.toLowerCase().includes(q);
				return titleMatch || orgMatch || previewMatch;
			});
		}

		return list;
	}, [conversations, activeTab, searchQuery]);

	const unreadCount = useMemo(
		() => conversations.filter((c) => c.isUnread && !c.isMuted).length,
		[conversations]
	);

	return (
		<div className="w-full md:w-80 lg:w-96 h-full flex flex-col border-r border-border-default bg-dark-layer-1 select-none">
			{/* Header */}
			<div className="p-4 border-b border-border-subtle flex items-center justify-between">
				<div className="flex items-center gap-2">
					<h1 className="text-lg font-bold text-text-primary tracking-wide">Messages</h1>
					{unreadCount > 0 && (
						<span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-orange text-white">
							{unreadCount}
						</span>
					)}
				</div>

				<button
					type="button"
					onClick={onNewConversation}
					className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold transition shadow-md shadow-brand-orange/20"
					title="Start a new direct message or create channel"
				>
					<FaPlus size={11} />
					<span>New</span>
				</button>
			</div>

			{/* Search input */}
			<div className="px-3 pt-3">
				<div className="relative">
					<FaSearch
						size={12}
						className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
					/>
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search conversations..."
						className="w-full text-xs pl-9 pr-3 py-2 rounded-xl bg-dark-fill-3 border border-border-default text-text-primary focus:border-brand-orange focus:outline-none transition"
					/>
				</div>
			</div>

			{/* Filter Tabs */}
			<div className="flex items-center gap-1 px-3 pt-2.5 pb-1">
				<button
					type="button"
					onClick={() => setActiveTab("all")}
					className={`flex-1 py-1 text-center text-xs font-bold rounded-lg transition ${
						activeTab === "all"
							? "bg-dark-fill-3 text-brand-orange"
							: "text-text-muted hover:text-text-primary"
					}`}
				>
					All
				</button>
				<button
					type="button"
					onClick={() => setActiveTab("direct")}
					className={`flex-1 py-1 text-center text-xs font-bold rounded-lg transition ${
						activeTab === "direct"
							? "bg-dark-fill-3 text-brand-orange"
							: "text-text-muted hover:text-text-primary"
					}`}
				>
					Direct
				</button>
				<button
					type="button"
					onClick={() => setActiveTab("orgs")}
					className={`flex-1 py-1 text-center text-xs font-bold rounded-lg transition ${
						activeTab === "orgs"
							? "bg-dark-fill-3 text-brand-orange"
							: "text-text-muted hover:text-text-primary"
					}`}
				>
					Orgs
				</button>
				<button
					type="button"
					onClick={() => setActiveTab("unread")}
					className={`flex-1 py-1 text-center text-xs font-bold rounded-lg transition ${
						activeTab === "unread"
							? "bg-dark-fill-3 text-brand-orange"
							: "text-text-muted hover:text-text-primary"
					}`}
				>
					Unread
				</button>
			</div>

			{/* Conversation List */}
			<div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-0.5">
				{loading && conversations.length === 0 ? (
					<div className="flex justify-center py-10">
						<div className="w-5 h-5 border-2 border-brand-orange border-t-transparent rounded-full animate-spin"></div>
					</div>
				) : filteredConversations.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-12 px-4 text-center text-text-muted">
						<FaEnvelopeOpenText size={28} className="mb-2 opacity-50" />
						<div className="text-xs font-bold text-text-secondary mb-1">
							{searchQuery ? "No matches found" : "No conversations yet"}
						</div>
						<p className="text-[11px] max-w-[200px]">
							{searchQuery
								? "Try a different search keyword"
								: "Start chatting by creating a new conversation"}
						</p>
					</div>
				) : (
					filteredConversations.map((conv) => (
						<ConversationRow
							key={conv.id}
							conversation={conv}
							isSelected={conv.id === selectedConversationId}
							currentUserId={currentUserId}
							onSelect={onSelectConversation}
						/>
					))
				)}
			</div>
		</div>
	);
};
