import React, { useState, useMemo } from "react";
import { useNotifications, RawNotification } from "@/context/RealtimeNotificationProvider";
import Link from "next/link";
import {
	FaBell,
	FaCheckDouble,
	FaRegTrashAlt,
	FaSearch,
	FaCalendarAlt,
	FaCode,
	FaComment,
	FaShieldAlt,
	FaTrophy,
	FaUserCog,
	FaArrowRight,
	FaCircle
} from "react-icons/fa";

interface GroupedNotification {
	id: string;
	ids: string[];
	type: string;
	category: string;
	title: string;
	body: string;
	createdAt: number;
	read: boolean;
	priority: string;
	ctaText?: string;
	ctaUrl?: string;
	threadId?: string;
	contestId?: string;
	problemId?: string;
	rawNotifications: RawNotification[];
}

export default function NotificationCenter() {
	const {
		notifications: rawNotifications,
		loading,
		markAllAsRead,
		markAsRead,
		deleteNotification
	} = useNotifications();

	// Search & Filter State
	const [searchQuery, setSearchQuery] = useState("");
	const [activeCategory, setActiveCategory] = useState<string>("all");
	const [visibleCount, setVisibleCount] = useState(15);

	// Get Icon based on category / type
	const getNotifIcon = (category: string, type: string) => {
		switch (category) {
			case "social":
			case "thread":
				return <FaComment className="text-blue-400" size={16} />;
			case "contest":
			case "announcements":
			case "reminders":
				return <FaCalendarAlt className="text-amber-400" size={16} />;
			case "problem":
			case "editorials":
			case "submission":
				return <FaCode className="text-emerald-400" size={16} />;
			case "achievements":
				return <FaTrophy className="text-purple-400" size={16} />;
			case "security":
				return <FaShieldAlt className="text-red-400" size={16} />;
			case "account":
				return <FaUserCog className="text-cyan-400" size={16} />;
			default:
				return <FaBell className="text-gray-400" size={16} />;
		}
	};

	// Format relative timestamp
	const formatRelativeTime = (timestamp: number) => {
		const diff = Date.now() - timestamp;
		const secs = Math.floor(diff / 1000);
		const mins = Math.floor(secs / 60);
		const hours = Math.floor(mins / 60);
		const days = Math.floor(hours / 24);

		if (secs < 60) return "Just now";
		if (mins < 60) return `${mins}m ago`;
		if (hours < 24) return `${hours}h ago`;
		return `${days}d ago`;
	};

	// Grouping & Filtering Logic
	const filteredAndGroupedNotifications = useMemo(() => {
		// A. Filter by Category
		let filtered = rawNotifications;
		if (activeCategory !== "all") {
			if (activeCategory === "thread") {
				filtered = rawNotifications.filter((n) => n.category === "thread" || n.category === "social");
			} else if (activeCategory === "contest") {
				filtered = rawNotifications.filter((n) => n.category === "contest" || n.category === "announcements" || n.category === "reminders");
			} else if (activeCategory === "problem") {
				filtered = rawNotifications.filter((n) => n.category === "problem" || n.category === "editorials");
			} else {
				filtered = rawNotifications.filter((n) => n.category === activeCategory);
			}
		}

		// B. Filter by Search Query
		if (searchQuery.trim()) {
			const queryLower = searchQuery.toLowerCase().trim();
			filtered = filtered.filter(
				(n) =>
					(n.title && n.title.toLowerCase().includes(queryLower)) ||
					(n.body && n.body.toLowerCase().includes(queryLower)) ||
					(n.fromDisplayName && n.fromDisplayName.toLowerCase().includes(queryLower))
			);
		}

		// C. Intelligent Grouping
		const grouped: GroupedNotification[] = [];
		const threadGroupMap: Record<string, GroupedNotification> = {};

		filtered.forEach((notif) => {
			if ((notif.category === "thread" || notif.category === "social") && notif.threadId && (notif.type === "THREAD_REPLY" || notif.type === "like" || notif.type === "reply")) {
				const groupKey = `${notif.type}-${notif.threadId}`;
				if (threadGroupMap[groupKey]) {
					const existingGroup = threadGroupMap[groupKey];
					existingGroup.ids.push(notif.id);
					existingGroup.rawNotifications.push(notif);
					if (notif.createdAt > existingGroup.createdAt) {
						existingGroup.createdAt = notif.createdAt;
					}
					if (!notif.read) {
						existingGroup.read = false;
					}
				} else {
					const newGroup: GroupedNotification = {
						id: notif.id,
						ids: [notif.id],
						type: notif.type,
						category: notif.category,
						title: notif.title,
						body: notif.body,
						createdAt: notif.createdAt,
						read: notif.read,
						priority: notif.priority || "normal",
						ctaText: notif.ctaText,
						ctaUrl: notif.ctaUrl,
						threadId: notif.threadId,
						rawNotifications: [notif]
					};
					threadGroupMap[groupKey] = newGroup;
					grouped.push(newGroup);
				}
			} else {
				grouped.push({
					id: notif.id,
					ids: [notif.id],
					type: notif.type,
					category: notif.category,
					title: notif.title || "Notification Update",
					body: notif.body || "",
					createdAt: notif.createdAt,
					read: notif.read,
					priority: notif.priority || "normal",
					ctaText: notif.ctaText,
					ctaUrl: notif.ctaUrl,
					contestId: notif.contestId || (notif.metadata?.contestId) || undefined,
					problemId: notif.problemId || (notif.metadata?.problemId) || undefined,
					threadId: notif.threadId || (notif.metadata?.threadId) || undefined,
					rawNotifications: [notif]
				});
			}
		});

		// D. Process Grouped details
		grouped.forEach((g) => {
			if (g.ids.length > 1) {
				const count = g.ids.length;
				const names = Array.from(
					new Set(
						g.rawNotifications
							.map((rn) => rn.fromDisplayName || "Someone")
							.filter(Boolean)
					)
				);

				let nameStr = "Several people";
				if (names.length === 1) {
					nameStr = `${names[0]} and ${count - 1} other${count > 2 ? "s" : ""}`;
				} else if (names.length > 1) {
					nameStr = `${names.slice(0, 2).join(", ")} and ${count - 2} other${count > 3 ? "s" : ""}`;
				}

				if (g.type === "THREAD_REPLY" || g.type === "reply") {
					g.title = `${nameStr} replied to your thread`;
				} else if (g.type === "like") {
					g.title = `${nameStr} liked your comments`;
				}
				g.body = `You have ${count} new social updates on this discussion thread.`;
			}
		});

		return grouped.sort((a, b) => b.createdAt - a.createdAt);
	}, [rawNotifications, activeCategory, searchQuery]);

	const visibleNotifications = useMemo(() => {
		return filteredAndGroupedNotifications.slice(0, visibleCount);
	}, [filteredAndGroupedNotifications, visibleCount]);

	return (
		<div className="max-w-[760px] mx-auto px-4 mt-8 space-y-6">
			{/* Top Controls Bar */}
			<div
				className="p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
				style={{ background: "var(--bg-dark-layer-1)", border: "1px solid var(--border-subtle)" }}
			>
				<div className="space-y-1">
					<h1 className="text-xl font-black tracking-tight flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
						<FaBell className="text-brand-orange animate-pulse" size={18} />
						Notification Center
					</h1>
					<p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
						Manage your real-time alerts, contest updates, and social interaction feed.
					</p>
				</div>
				{rawNotifications.some((n) => !n.read) && (
					<button
						onClick={markAllAsRead}
						className="px-4 py-2 text-xs font-bold rounded-lg border border-border-subtle hover:border-border-accent bg-dark-fill-3 flex items-center gap-2 hover:text-brand-orange transition-all"
						style={{ color: "var(--text-secondary)" }}
					>
						<FaCheckDouble size={12} />
						Mark All Read
					</button>
				)}
			</div>

			{/* Search & Filter Pills */}
			<div className="space-y-4">
				<div className="relative">
					<FaSearch className="absolute left-4 top-3.5 text-text-muted" size={14} />
					<input
						type="text"
						placeholder="Search by keyword, topic, or sender..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="w-full pl-11 pr-4 py-3 text-xs rounded-xl bg-dark-fill-3 border border-border-subtle text-text-primary focus:outline-none focus:border-brand-orange transition-all placeholder:text-text-muted"
						style={{ color: "var(--text-primary)", background: "var(--bg-dark-fill-3)", border: "1px solid var(--border-subtle)" }}
					/>
				</div>

				<div className="flex flex-wrap gap-1.5 border-b border-border-subtle pb-3" style={{ borderBottomColor: "var(--border-subtle)" }}>
					{[
						{ id: "all", label: "All Updates" },
						{ id: "contest", label: "Contests" },
						{ id: "problem", label: "Problems" },
						{ id: "thread", label: "Social Feed" },
						{ id: "submission", label: "Submissions" },
						{ id: "achievements", label: "Achievements" },
						{ id: "account", label: "Account" },
						{ id: "admin", label: "Admin" },
						{ id: "university", label: "University" },
						{ id: "system", label: "System" },
						{ id: "security", label: "Security" },
						{ id: "marketing", label: "Marketing" }
					].map((tab) => {
						const isActive = activeCategory === tab.id;
						
						const getCategoryCount = (catId: string) => {
							if (catId === "all") return rawNotifications.filter((n) => !n.read).length;
							if (catId === "thread") return rawNotifications.filter((n) => (n.category === "thread" || n.category === "social") && !n.read).length;
							if (catId === "contest") return rawNotifications.filter((n) => (n.category === "contest" || n.category === "announcements" || n.category === "reminders") && !n.read).length;
							if (catId === "problem") return rawNotifications.filter((n) => (n.category === "problem" || n.category === "editorials") && !n.read).length;
							return rawNotifications.filter((n) => n.category === catId && !n.read).length;
						};
						const count = getCategoryCount(tab.id);

						return (
							<button
								key={tab.id}
								onClick={() => {
									setActiveCategory(tab.id);
									setVisibleCount(15);
								}}
								className={`px-4 py-2 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${
									isActive
										? "bg-brand-orange text-white shadow-md shadow-brand-glow"
										: "bg-dark-fill-3 border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-accent"
								}`}
							>
								{tab.label}
								{count > 0 && (
									<span
										className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
											isActive ? "bg-white text-brand-orange" : "bg-brand-orange text-white"
										}`}
									>
										{count}
									</span>
								)}
							</button>
						);
					})}
				</div>
			</div>

			{/* Notifications List */}
			<div className="space-y-3">
				{loading ? (
					<div className="space-y-3">
						{[1, 2, 3].map((idx) => (
							<div
								key={idx}
								className="flex items-center gap-4 p-5 rounded-2xl animate-pulse bg-dark-fill-3"
								style={{ border: "1px solid var(--border-subtle)" }}
							>
								<div className="w-10 h-10 rounded-xl bg-dark-layer-1" />
								<div className="flex-1 space-y-2">
									<div className="h-3 rounded-md w-1/3 bg-dark-layer-1" />
									<div className="h-2 rounded-md w-1/2 bg-dark-layer-1" />
								</div>
							</div>
						))}
					</div>
				) : visibleNotifications.length === 0 ? (
					<div
						className="text-center py-20 rounded-2xl p-6 space-y-3"
						style={{ background: "var(--bg-dark-layer-1)", border: "1px solid var(--border-subtle)" }}
					>
						<FaBell className="mx-auto text-text-muted opacity-25" size={40} />
						<h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>No Notifications Found</h3>
						<p className="text-xs max-w-sm mx-auto" style={{ color: "var(--text-muted)", lineHeight: "1.6" }}>
							Any updates, announcements, or replies will show up here as soon as they are triggered.
						</p>
					</div>
				) : (
					<div className="space-y-3">
						{visibleNotifications.map((notif) => {
							const hasUnread = !notif.read;
							let ctaUrl = notif.ctaUrl || "";
							let ctaText = notif.ctaText || "";
							if (!ctaUrl) {
								if (notif.contestId) {
									if (notif.type === "CONTEST_EDITORIAL_RELEASED") {
										ctaUrl = `/contests/${notif.contestId}?tab=editorial`;
										ctaText = "View Editorial";
									} else if (notif.type === "CONTEST_RESULTS_PUBLISHED" || notif.type === "CONTEST_ENDED" || notif.type === "CONTEST_WINNER") {
										ctaUrl = `/contests/${notif.contestId}?tab=leaderboard`;
										ctaText = "View Standings";
									} else {
										ctaUrl = `/contests/${notif.contestId}`;
										ctaText = "View Contest Preview";
									}
								} else if (notif.problemId) {
									ctaUrl = `/problems/${notif.problemId}`;
									ctaText = "Solve Problem";
								} else if (notif.threadId) {
									ctaUrl = `/threads?threadId=${notif.threadId}`;
									ctaText = "View Discussion";
								}
							}

							return (
								<div
									key={notif.id}
									onClick={() => {
										if (hasUnread) {
											notif.ids.forEach((id) => markAsRead(id));
										}
									}}
									className={`group flex items-start gap-4 p-5 rounded-2xl transition-all duration-200 cursor-pointer animate-fade-in ${
										hasUnread
											? "border border-border-accent bg-brand-glow shadow-glow-sm"
											: "border border-border-subtle bg-dark-layer-1 hover:border-border-accent"
									}`}
								>
									{/* Unread Status Dot */}
									<div className="flex-shrink-0 pt-1.5 w-3">
										{hasUnread && (
											<FaCircle className="text-brand-orange animate-pulse" size={8} />
										)}
									</div>

									{/* Avatar or Icon Badge */}
									{notif.rawNotifications[0]?.fromAvatarUrl ? (
										<img
											src={notif.rawNotifications[0].fromAvatarUrl}
											alt={notif.rawNotifications[0].fromDisplayName || "User"}
											className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-border-subtle"
										/>
									) : (
										<div
											className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
											style={{
												background: "var(--bg-dark-fill-3)",
												border: "1px solid var(--border-subtle)"
											}}
										>
											{getNotifIcon(notif.category, notif.type)}
										</div>
									)}

									{/* Content */}
									<div className="flex-1 min-w-0 space-y-1.5">
										<div className="flex items-start justify-between gap-2">
											<div className="flex flex-col gap-1 min-w-0">
												<h3
													className={`text-xs font-bold truncate ${
														hasUnread ? "text-text-primary" : "text-text-secondary"
													}`}
												>
													{notif.title}
												</h3>
												<div className="flex items-center gap-1.5 flex-wrap">
													{notif.priority && notif.priority !== "normal" && notif.priority !== "silent" && (
														<span
															className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
																notif.priority === "critical"
																	? "bg-red-500/10 text-red-400 border border-red-500/20"
																	: "bg-orange-500/10 text-orange-400 border border-orange-500/20"
															}`}
														>
															{notif.priority}
														</span>
													)}
													{notif.rawNotifications[0]?.metadata?.contestStatus && (
														<span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-brand-orange/10 text-brand-orange border border-brand-orange/20">
															{notif.rawNotifications[0].metadata.contestStatus}
														</span>
													)}
												</div>
											</div>
											<span className="text-[9px] text-text-muted font-mono whitespace-nowrap pt-0.5">
												{formatRelativeTime(notif.createdAt)}
											</span>
										</div>

										<p className="text-[11px] leading-relaxed text-text-muted pr-4" style={{ wordBreak: "break-word" }}>
											{notif.body}
										</p>

										{/* Contextual Action Buttons */}
										<div className="pt-2 flex flex-wrap gap-2 items-center select-none" onClick={(e) => e.stopPropagation()}>
											{ctaUrl && (
												<Link href={ctaUrl}>
													<span className="px-3.5 py-1.5 text-[10px] font-black rounded-lg bg-brand-orange hover:bg-opacity-95 text-white flex items-center gap-1.5 transition-all shadow-md shadow-brand-glow">
														{ctaText || notif.ctaText || (notif.type === "THREAD_REPLY" || notif.type === "reply" ? "View Reply" : "Open Thread")}
														<FaArrowRight size={8} />
													</span>
												</Link>
											)}

											{/* Reply Back Option for Social/Reply Thread notifications */}
											{notif.threadId && (notif.type === "THREAD_REPLY" || notif.type === "reply" || notif.category === "thread" || notif.category === "social") && (
												<Link href={`/threads?threadId=${notif.threadId}&reply=true`}>
													<span className="px-3.5 py-1.5 text-[10px] font-bold rounded-lg border border-border-subtle hover:border-[var(--brand-orange)] bg-[var(--bg-dark-fill-3)] text-[var(--text-secondary)] hover:text-[var(--brand-orange)] flex items-center gap-1.5 transition-all">
														Reply Back
													</span>
												</Link>
											)}

											{hasUnread && (
												<button
													onClick={(e) => {
														e.stopPropagation();
														notif.ids.forEach((id) => markAsRead(id));
													}}
													className="px-3 py-1.5 text-[10px] font-bold rounded-lg border border-border-subtle hover:border-[var(--brand-orange)] bg-[var(--bg-dark-fill-3)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all flex items-center gap-1.5"
												>
													<FaCheckDouble size={10} />
													Mark Read
												</button>
											)}

											<button
												onClick={(e) => {
													e.stopPropagation();
													deleteNotification(notif.ids);
												}}
												className="px-3 py-1.5 text-[10px] font-bold rounded-lg border border-border-subtle hover:border-red-500 bg-dark-fill-3 text-text-muted hover:text-red-400 transition-all flex items-center gap-1.5"
												title="Dismiss notification"
											>
												<FaRegTrashAlt size={10} />
												Dismiss
											</button>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Load More Button */}
			{filteredAndGroupedNotifications.length > visibleCount && (
				<button
					onClick={() => setVisibleCount((prev) => prev + 15)}
					className="w-full py-3 rounded-xl border border-border-subtle hover:border-border-accent bg-dark-fill-3 text-xs font-bold transition-all text-text-secondary hover:text-text-primary"
				>
					Load Older Notifications
				</button>
			)}
		</div>
	);
}
