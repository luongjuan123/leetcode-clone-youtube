import React, { useEffect, useState } from "react";
import Topbar from "@/components/Topbar/Topbar";
import TabsNavigation from "@/components/TabsNavigation/TabsNavigation";
import useHasMounted from "@/hooks/useHasMounted";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, firestore } from "@/firebase/firebase";
import { collection, query, where, onSnapshot, updateDoc, doc } from "firebase/firestore";
import Link from "next/link";
import { FaUser, FaHeart, FaRetweet, FaComment, FaBell } from "react-icons/fa";

interface NotificationItem {
	id: string;
	toUid: string;
	fromUid: string;
	fromDisplayName: string;
	fromAvatarUrl?: string;
	type: "like" | "repost" | "reply";
	threadId: string;
	createdAt: number;
	read: boolean;
}

export default function NotificationsPage() {
	const hasMounted = useHasMounted();
	const [user] = useAuthState(auth);
	const [notifications, setNotifications] = useState<NotificationItem[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!user) {
			setNotifications([]);
			setLoading(false);
			return;
		}

		const q = query(
			collection(firestore, "notifications"),
			where("toUid", "==", user.uid)
		);

		const unsubscribe = onSnapshot(
			q,
			(snap) => {
				const list: NotificationItem[] = [];
				snap.forEach((docSnap) => {
					const data = docSnap.data();
					list.push({ id: docSnap.id, ...data } as NotificationItem);
				});
				list.sort((a, b) => b.createdAt - a.createdAt);
				setNotifications(list);
				setLoading(false);
			},
			(err) => {
				console.error("Error fetching notifications:", err);
				setLoading(false);
			}
		);

		return () => unsubscribe();
	}, [user]);

	// Mark all unread as read
	useEffect(() => {
		if (!user || notifications.length === 0) return;
		const unread = notifications.filter((n) => !n.read);
		if (unread.length === 0) return;

		unread.forEach(async (notif) => {
			try {
				await updateDoc(doc(firestore, "notifications", notif.id), { read: true });
			} catch (e) {
				// silently fail
			}
		});
	}, [user, notifications]);

	if (!hasMounted) return null;

	const formatTime = (timestamp: number) => {
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

	const getIcon = (type: "like" | "repost" | "reply") => {
		switch (type) {
			case "like":    return <FaHeart className='text-red-400' size={12} />;
			case "repost":  return <FaRetweet className='text-emerald-400' size={12} />;
			case "reply":   return <FaComment className='text-blue-400' size={12} />;
		}
	};

	const getActionText = (type: "like" | "repost" | "reply") => {
		switch (type) {
			case "like":   return "liked your thread";
			case "repost": return "reposted your thread";
			case "reply":  return "replied to your thread";
		}
	};

	return (
		<main className='bg-dark-layer-2 min-h-screen pb-16' style={{ color: "var(--text-primary)" }}>
			<Topbar />
			<div className='max-w-2xl mx-auto px-4 mt-6'>
				<TabsNavigation />

				<div
					className='mt-4 rounded-2xl overflow-hidden'
					style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
				>
					{/* Header */}
					<div
						className='flex items-center gap-3 px-5 py-4'
						style={{ borderBottom: "1px solid var(--border-subtle)" }}
					>
						<div
							className='flex items-center justify-center w-8 h-8 rounded-lg'
							style={{ background: "var(--brand-glow)", color: "var(--brand-orange)" }}
						>
							<FaBell size={14} />
						</div>
						<div>
							<h1 className='text-sm font-bold' style={{ color: "var(--text-primary)" }}>
								Notifications
							</h1>
							<p className='text-[11px]' style={{ color: "var(--text-muted)" }}>
								Stay updated with your social activity
							</p>
						</div>
					</div>

					{/* Body */}
					<div className='p-4'>
						{!user ? (
							<div className='text-center py-12' style={{ color: "var(--text-muted)" }}>
								<p className='text-sm font-medium'>Please sign in to view notifications.</p>
							</div>
						) : loading ? (
							<div className='space-y-3'>
								{[1, 2, 3].map((n) => (
									<div
										key={n}
										className='flex items-center gap-4 p-4 rounded-xl animate-pulse'
										style={{ background: "var(--bg-dark-fill-3)" }}
									>
										<div
											className='w-9 h-9 rounded-full flex-shrink-0'
											style={{ background: "var(--bg-elevated)" }}
										/>
										<div className='flex-1 space-y-2'>
											<div className='h-2.5 rounded-md w-1/3' style={{ background: "var(--bg-elevated)" }} />
											<div className='h-2 rounded-md w-1/2' style={{ background: "var(--bg-elevated)" }} />
										</div>
									</div>
								))}
							</div>
						) : notifications.length === 0 ? (
							<div className='text-center py-14' style={{ color: "var(--text-muted)" }}>
								<FaBell className='mx-auto mb-3 opacity-25' size={28} />
								<p className='text-sm font-semibold'>No notifications yet</p>
								<p className='text-xs mt-1 opacity-70'>Interactions on your threads will appear here.</p>
							</div>
						) : (
							<div className='space-y-2'>
								{notifications.map((notif) => (
									<div
										key={notif.id}
										className='flex items-center justify-between gap-3 p-3.5 rounded-xl transition-all duration-150'
										style={{
											background: notif.read ? "transparent" : "var(--brand-glow)",
											border: notif.read
												? "1px solid var(--border-subtle)"
												: "1px solid var(--border-accent)",
										}}
									>
										<div className='flex items-center gap-3 min-w-0'>
											{/* Unread dot */}
											<div className='flex-shrink-0 w-2'>
												{!notif.read && (
													<div
														className='w-1.5 h-1.5 rounded-full'
														style={{ background: "var(--brand-orange)" }}
													/>
												)}
											</div>

											{/* Avatar */}
											<Link href={`/profile?uid=${notif.fromUid}`} className='flex-shrink-0'>
												{notif.fromAvatarUrl ? (
													<img
														src={notif.fromAvatarUrl}
														alt={notif.fromDisplayName}
														className='w-9 h-9 rounded-full object-cover transition-opacity hover:opacity-80'
														style={{ border: "1px solid var(--border-default)" }}
													/>
												) : (
													<div
														className='w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-80'
														style={{
															background: "var(--bg-dark-fill-3)",
															border: "1px solid var(--border-default)",
															color: "var(--text-muted)",
														}}
													>
														<FaUser size={13} />
													</div>
												)}
											</Link>

											{/* Text */}
											<div className='min-w-0'>
												<div className='flex items-center gap-1.5 flex-wrap'>
													<Link href={`/profile?uid=${notif.fromUid}`}>
														<span
															className='text-xs font-bold truncate max-w-[130px] hover:underline cursor-pointer transition-colors'
															style={{ color: "var(--text-primary)" }}
														>
															{notif.fromDisplayName}
														</span>
													</Link>
													<span className='text-[11px]' style={{ color: "var(--text-secondary)" }}>
														{getActionText(notif.type)}
													</span>
													<span className='flex-shrink-0 opacity-80'>{getIcon(notif.type)}</span>
												</div>
												<span
													className='text-[10px] font-mono block mt-0.5'
													style={{ color: "var(--text-muted)" }}
												>
													{formatTime(notif.createdAt)}
												</span>
											</div>
										</div>

										{/* CTA Button */}
										<Link href={`/threads?threadId=${notif.threadId}`} className='flex-shrink-0'>
											<span
												className='text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-150 select-none'
												style={{
													background: "var(--bg-dark-fill-3)",
													color: "var(--text-secondary)",
													border: "1px solid var(--border-subtle)",
												}}
												onMouseEnter={(e) => {
													(e.currentTarget as HTMLSpanElement).style.color = "var(--brand-orange)";
													(e.currentTarget as HTMLSpanElement).style.borderColor = "var(--border-accent)";
												}}
												onMouseLeave={(e) => {
													(e.currentTarget as HTMLSpanElement).style.color = "var(--text-secondary)";
													(e.currentTarget as HTMLSpanElement).style.borderColor = "var(--border-subtle)";
												}}
											>
												View
											</span>
										</Link>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</main>
	);
}
