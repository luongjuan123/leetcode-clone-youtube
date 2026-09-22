import { auth, firestore } from "@/firebase/firebase";
import Link from "next/link";
import React, { useState, useEffect, useRef } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import Logout from "../Buttons/Logout";
import { useSetRecoilState } from "recoil";
import { authModalState } from "@/atoms/authModalAtom";
import Image from "next/image";
import Logo from "../Logo/Logo";
import {
	FaChevronLeft, FaChevronRight, FaUser, FaCog,
	FaShieldAlt, FaBell, FaSearch, FaTrophy,
	FaCode, FaStream, FaBars, FaTimes,
	FaCoffee, FaCalendarAlt, FaUsers, FaComments,
} from "react-icons/fa";
import { BsList } from "react-icons/bs";
import Timer from "../Timer/Timer";
import { useRouter } from "next/router";
import { problems } from "@/utils/problems";
import { Problem } from "@/utils/types/problem";
import { useAdmin } from "@/hooks/useAdmin";
import { doc, onSnapshot, collection, query, where, writeBatch, updateDoc } from "firebase/firestore";
import { useNotifications } from "@/context/RealtimeNotificationProvider";
import { useConversations } from "@/hooks/chat/useConversations";

type TopbarProps = {
	problemPage?: boolean;
};

const THEMES = [
	{ id: "default", label: "Dark",   color: "#f97316" },
	{ id: "light",   label: "Light",  color: "#2563eb" },
	{ id: "sakura",  label: "Sakura", color: "#db7093" },
	{ id: "red",     label: "Red",    color: "#dc2626" },
];

// Primary nav tabs — shown in the center of the bar on non-problem pages
const NAV_TABS = [
	{ name: "Problems",      path: "/",          icon: <FaCode  size={14} />, exact: true  },
	{ name: "Rankings",      path: "/rankings",  icon: <FaTrophy size={14} />, exact: false },
	{ name: "Contests",      path: "/contests",  icon: <FaCalendarAlt size={14} />, exact: false },
	{ name: "Threads",       path: "/threads",   icon: <FaStream size={14} />, exact: false },
	{ name: "Organizations", path: "/orgs",      icon: <FaUsers size={14} />, exact: false },
];

interface RankInfo {
	name: string;
	color: string;
	minScore: number;
}

const RANK_TIERS: RankInfo[] = [
	{ name: "Newbie", color: "#94a3b8", minScore: 0 },
	{ name: "Beginner", color: "#22c55e", minScore: 5 },
	{ name: "Apprentice", color: "#14b8a6", minScore: 15 },
	{ name: "Intermediate", color: "#3b82f6", minScore: 30 },
	{ name: "Advanced", color: "#6366f1", minScore: 50 },
	{ name: "Expert", color: "#a855f7", minScore: 85 },
	{ name: "Master", color: "#ec4899", minScore: 130 },
	{ name: "Grandmaster", color: "#ef4444", minScore: 190 },
	{ name: "Legend", color: "#f59e0b", minScore: 270 },
	{ name: "Mythic", color: "#d946ef", minScore: 370 },
];

const getRankAndXP = (score: number) => {
	let currentRank = RANK_TIERS[0];
	for (let i = 0; i < RANK_TIERS.length; i++) {
		if (score >= RANK_TIERS[i].minScore) {
			currentRank = RANK_TIERS[i];
		}
	}
	const level = Math.floor(score / 10) + 1;
	const currentXP = score % 10;
	const xpPercent = currentXP * 10;
	return { currentRank, level, xpPercent };
};

const Topbar: React.FC<TopbarProps> = ({ problemPage }) => {
	const [user, loading] = useAuthState(auth);
	const setAuthModal   = useSetRecoilState(authModalState);
	const router         = useRouter();
	const [isAdmin]      = useAdmin();
	const [dropdownOpen, setDropdownOpen] = useState(false);
	const [mobileOpen,   setMobileOpen]   = useState(false);
	const dropdownRef    = useRef<HTMLDivElement>(null);
	const mobileRef      = useRef<HTMLDivElement>(null);
	const [userData, setUserData]         = useState<{ displayName: string | null; avatarUrl: string | null; score: number } | null>(null);
	const [activeTheme, setActiveTheme]   = useState("default");
	const [scrolled, setScrolled]         = useState(false);
	const [dbProblemIds, setDbProblemIds] = useState<string[]>([]);
	const { currentRank, level, xpPercent } = getRankAndXP(userData?.score || 0);

	// Notification dropdown states
	const { notifications, markAllAsRead, markAsRead } = useNotifications();
	const { totalUnreadCount: unreadChatCount } = useConversations();
	const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
	const notifDropdownRef = useRef<HTMLDivElement>(null);

	/* ── user subscription (avatar & score/rank tier) ── */
	useEffect(() => {
		if (!user) { setUserData(null); return; }
		const unsub = onSnapshot(doc(firestore, "users", user.uid), (snap) => {
			if (snap.exists()) {
				const data = snap.data();
				setUserData({
					displayName: data.displayName || null,
					avatarUrl: data.avatarUrl || null,
					score: data.score || 0,
				});
			}
		});
		return () => unsub();
	}, [user]);

	/* ── database problems navigation sync ── */
	useEffect(() => {
		if (!problemPage) return;
		const q = query(collection(firestore, "problems"));
		const unsub = onSnapshot(q, (snap) => {
			const list: { id: string; title: string }[] = [];
			snap.forEach((d) => {
				list.push({ id: d.id, title: d.data().title || d.id });
			});
			list.sort((a, b) => a.title.localeCompare(b.title));
			setDbProblemIds(list.map((p) => p.id));
		}, (err) => {
			console.error("Error listening to db problems for nav:", err);
		});
		return () => unsub();
	}, [problemPage]);

	/* ── theme init ── */
	useEffect(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("theme") || "default";
			setActiveTheme(saved);
		}
		const onTheme = () => setActiveTheme(localStorage.getItem("theme") || "default");
		window.addEventListener("themechange", onTheme);
		return () => window.removeEventListener("themechange", onTheme);
	}, []);

	/* ── scroll detection — passive, no layout thrashing ── */
	useEffect(() => {
		let ticking = false;
		const handleScroll = () => {
			if (!ticking) {
				requestAnimationFrame(() => {
					setScrolled(window.scrollY > 4);
					ticking = false;
				});
				ticking = true;
			}
		};
		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	/* ── close dropdown on outside click ── */
	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
				setDropdownOpen(false);
			if (mobileRef.current && !mobileRef.current.contains(e.target as Node))
				setMobileOpen(false);
			if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target as Node))
				setNotifDropdownOpen(false);
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, []);

	/* ── close mobile/notif/profile dropdown on route change ── */
	useEffect(() => {
		setMobileOpen(false);
		setNotifDropdownOpen(false);
		setDropdownOpen(false);
	}, [router.pathname]);

	const markAllNotifsRead = async () => {
		await markAllAsRead();
	};

	const handleThemeChange = (t: string) => {
		localStorage.setItem("theme", t);
		document.documentElement.setAttribute("data-theme", t);
		setActiveTheme(t);
		window.dispatchEvent(new Event("themechange"));
		if (t === "light") document.documentElement.classList.remove("dark");
		else               document.documentElement.classList.add("dark");
	};

	const handleProblemChange = (isForward: boolean) => {
		const keys = dbProblemIds.length > 0 ? dbProblemIds : Object.keys(problems);
		if (keys.length === 0) return;
		const currentPid = router.query.pid as string;
		const currentIndex = keys.indexOf(currentPid);
		if (currentIndex === -1) {
			router.push(`/problems/${keys[0]}`);
			return;
		}
		let nextIndex = currentIndex + (isForward ? 1 : -1);
		if (nextIndex >= keys.length) {
			nextIndex = 0;
		} else if (nextIndex < 0) {
			nextIndex = keys.length - 1;
		}
		router.push(`/problems/${keys[nextIndex]}`);
	};

	const isTabActive = (tab: typeof NAV_TABS[number]) =>
		tab.exact
			? router.pathname === "/" || router.pathname === "/problems"
			: router.pathname.startsWith(tab.path);

	/* ── nav background: glassmorphic header ── */
	const navStyle: React.CSSProperties = {
		background:    "rgba(10, 10, 12, 0.75)",
		borderBottom:  "1px solid var(--border-default)",
		backdropFilter: "blur(12px) saturate(180%)",
		WebkitBackdropFilter: "blur(12px) saturate(180%)",
		fontFamily: "var(--font-sans)",
		transition: "border-color 200ms ease, backdrop-filter 200ms ease",
	};

	/* ── shared tab style helper ── */
	const tabCls = (active: boolean) =>
		`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 select-none`;

	/* ── icon button style helper ── */
	const iconBtnCls = (active?: boolean) =>
		`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150 cursor-pointer ${
			active
				? "text-brand-orange bg-brand-orange/10"
				: "text-text-secondary hover:text-text-primary hover:bg-dark-fill-3"
		}`;

	const notifActive = router.pathname === "/notifications";
	const searchActive = router.pathname === "/search";

	return (
		<>
			{/* ════════════════════════════════ NAV BAR ════════════════════════════════ */}
			<nav
				className="sticky top-0 z-50 h-[68px] w-full flex shrink-0 items-center px-6 nav-glass shadow-sm"
				aria-label="Main navigation"
			>
				<div className={`flex w-full items-center gap-3 ${!problemPage ? "max-w-[1200px] mx-auto" : ""}`}>

					{/* ── LOGO ── */}
					<Link href="/" className="flex items-center shrink-0 mr-4" aria-label="BeastCode home">
						<Logo size={36} />
					</Link>

					{/* ── CENTER: PRIMARY TABS (non-problem pages, desktop) ── */}
					{!problemPage && (
						<div className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
							{NAV_TABS.map((tab) => {
								const active = isTabActive(tab);
								return (
									<Link
										key={tab.name}
										href={tab.path}
										className={`${tabCls(active)} border ${active ? "glow-active border-brand-orange bg-brand-orange/5" : "border-transparent text-text-secondary hover:text-text-primary hover:bg-dark-fill-3"}`}
										aria-current={active ? "page" : undefined}
									>
										{tab.icon && (
											<span className={`flex-shrink-0 ${active ? "text-[var(--brand-orange)]" : ""}`}>
												{tab.icon}
											</span>
										)}
										{active ? (
											<span className="text-brand-gradient">{tab.name}</span>
										) : (
											<span>{tab.name}</span>
										)}
									</Link>
								);
							})}
						</div>
					)}

					{/* ── CENTER: PROBLEM NAV (problem page only) ── */}
					{problemPage && (
						<div className="flex items-center gap-2.5 flex-1 justify-center">
							<button
								onClick={() => handleProblemChange(false)}
								className={iconBtnCls()}
								aria-label="Previous problem"
								style={{ border: "1px solid var(--border-subtle)" }}
							>
								<FaChevronLeft size={12} />
							</button>

							<Link
								href="/"
								className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150"
								style={{ background: "var(--bg-dark-fill-3)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}
							>
								<BsList size={16} />
								Problem List
							</Link>

							<button
								onClick={() => handleProblemChange(true)}
								className={iconBtnCls()}
								aria-label="Next problem"
								style={{ border: "1px solid var(--border-subtle)" }}
							>
								<FaChevronRight size={12} />
							</button>
						</div>
					)}

					{/* ── RIGHT UTILITIES ── */}
					<div className="flex items-center gap-1.5 ml-auto shrink-0">

						{/* Search icon */}
						{!problemPage && (
							<Link
								href="/search"
								className={iconBtnCls(searchActive)}
								aria-label="Search"
								title="Search"
							>
								<FaSearch size={16} />
							</Link>
						)}

						{/* Messages icon */}
						{user && !problemPage && (
							<Link
								href="/messages"
								className={`${iconBtnCls(router.pathname.startsWith("/messages"))} relative flex items-center justify-center`}
								aria-label="Messages"
								title="Messages"
							>
								<FaComments size={16} className={unreadChatCount > 0 ? "text-brand-orange" : ""} />
								{unreadChatCount > 0 && (
									<span className="absolute top-1.5 right-1.5 flex h-3 w-3">
										<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-orange opacity-75"></span>
										<span className="relative inline-flex rounded-full h-3 w-3 bg-brand-orange text-[8px] font-black text-white items-center justify-center">
											{unreadChatCount > 9 ? "9+" : unreadChatCount}
										</span>
									</span>
								)}
							</Link>
						)}

						{/* Notifications icon with floating preview dropdown */}
						{user && !problemPage && (
							<div className="relative" ref={notifDropdownRef}>
								<button
									onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
									className={`${iconBtnCls(notifDropdownOpen || notifActive)} relative flex items-center justify-center`}
									aria-label="Notifications menu"
									aria-expanded={notifDropdownOpen}
									aria-haspopup="true"
								>
									<FaBell size={16} className={notifications.some((n) => !n.read) ? "animate-bounce text-brand-orange" : ""} />
									{notifications.filter((n) => !n.read).length > 0 && (
										<span className="absolute top-1.5 right-1.5 flex h-3 w-3">
											<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-orange opacity-75"></span>
											<span className="relative inline-flex rounded-full h-3 w-3 bg-brand-orange text-[8px] font-black text-white items-center justify-center">
												{notifications.filter((n) => !n.read).length}
											</span>
										</span>
									)}
								</button>

								{/* ── NOTIFICATION PREVIEW DROPDOWN PANEL ── */}
								{notifDropdownOpen && (
									<div
										className="absolute top-[calc(100%+8px)] right-0 w-80 rounded-xl overflow-hidden animate-fade-in z-[100]"
										style={{
											background: "var(--bg-elevated)",
											border: "1px solid var(--border-default)",
											boxShadow: "var(--shadow-lg)",
										}}
										role="menu"
									>
										{/* Header */}
										<div
											className="flex items-center justify-between px-4 py-3"
											style={{ borderBottom: "1px solid var(--border-subtle)" }}
										>
											<div className="flex items-center gap-1.5">
												<span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
													Notifications
												</span>
												{notifications.filter((n) => !n.read).length > 0 && (
													<span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-brand-orange text-white">
														{notifications.filter((n) => !n.read).length}
													</span>
												)}
											</div>
											{notifications.some((n) => !n.read) && (
												<button
													onClick={markAllNotifsRead}
													className="text-[10px] font-bold text-brand-orange hover:underline"
												>
													Mark all read
												</button>
											)}
										</div>

										{/* List of Recent 5 */}
										<div className="max-h-64 overflow-y-auto divide-y divide-border-subtle">
											{notifications.length === 0 ? (
												<div className="px-4 py-8 text-center text-xs text-text-muted">
													No new notifications
												</div>
											) : (
												notifications.slice(0, 5).map((n) => {
													const hasUnread = !n.read;
													const getNotifTimeStr = (t: number) => {
														const diff = Date.now() - t;
														const secs = Math.floor(diff / 1000);
														if (secs < 60) return "now";
														const mins = Math.floor(secs / 60);
														if (mins < 60) return `${mins}m`;
														const hrs = Math.floor(mins / 60);
														if (hrs < 24) return `${hrs}h`;
														return `${Math.floor(hrs / 24)}d`;
													};

													const handleNotifClick = async () => {
														if (hasUnread) {
															await markAsRead(n.id);
														}
														setNotifDropdownOpen(false);
														let target = n.ctaUrl || "";
														if (!target) {
															if (n.contestId) target = `/contests/${n.contestId}`;
															else if (n.problemId) target = `/problems/${n.problemId}`;
															else if (n.threadId) target = `/threads?threadId=${n.threadId}`;
														}
														if (target) {
															router.push(target);
														}
													};

													return (
														<div
															key={n.id}
															onClick={handleNotifClick}
															className={`px-4 py-3 text-xs transition-all duration-100 cursor-pointer hover:bg-dark-fill-3 flex items-start gap-3 ${
																hasUnread ? "bg-brand-glow" : ""
															}`}
														>
															{/* Unread indicator */}
															{hasUnread && (
																<span className="w-1.5 h-1.5 rounded-full bg-brand-orange mt-1.5 flex-shrink-0" />
															)}
															<div className="flex-1 min-w-0 space-y-0.5">
																<div className="flex items-center justify-between gap-2">
																	<span className="font-bold text-text-primary truncate">
																		{n.title || "Platform Update"}
																	</span>
																	<span className="text-[9px] text-text-muted font-mono whitespace-nowrap">
																		{getNotifTimeStr(n.createdAt)}
																	</span>
																</div>
																<p className="text-[10px] text-text-muted truncate">
																	{n.body || ""}
																</p>
															</div>
														</div>
													);
												})
											)}
										</div>

										{/* Footer */}
										<div
											className="bg-dark-fill-3 text-center"
											style={{ borderTop: "1px solid var(--border-subtle)" }}
										>
											<Link
												href="/notifications"
												onClick={() => setNotifDropdownOpen(false)}
												className="block w-full py-2.5 text-[10px] font-bold text-text-secondary hover:text-brand-orange transition-all"
											>
												View All Notifications
											</Link>
										</div>
									</div>
								)}
							</div>
						)}

						{/* Timer (problem page only) */}
						{user && problemPage && <Timer />}

						{/* Support */}
						<Link
							href="/qr"
							className="hidden sm:flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150 text-text-secondary hover:text-brand-orange hover:bg-brand-glow"
							title="Support"
						>
							<FaCoffee size={16} />
						</Link>

						{/* Admin badge */}
						{isAdmin && (
							<Link
								href="/admin"
								className="hidden sm:flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all duration-150 text-text-secondary bg-dark-fill-3 border border-border-subtle hover:text-brand-orange hover:border-border-accent"
							>
								<FaShieldAlt size={12} style={{ color: "var(--brand-orange)" }} />
								Admin
							</Link>
						)}

						{/* Divider */}
						<div className="h-4 w-px mx-1 hidden sm:block" style={{ background: "var(--border-subtle)" }} />

						{/* SIGN IN / SKELETON */}
						{loading ? (
							<div className="w-10 h-10 rounded-xl bg-dark-fill-3 animate-pulse shrink-0" />
						) : !user ? (
							<button
								type="button"
								onClick={() => setAuthModal((p) => ({ ...p, isOpen: true, type: "login" }))}
								className="inline-flex items-center px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-150 bc-btn-brand"
							>
								Sign In
							</button>
						) : null}

						{/* AVATAR + DROPDOWN */}
						{user && (
							<div className="relative" ref={dropdownRef}>
								<button
									onClick={() => setDropdownOpen(!dropdownOpen)}
									className="flex items-center gap-3 bg-[var(--bg-dark-layer-1)] px-3 py-1.5 rounded-2xl border border-[var(--border-default)] select-none transition-all duration-150 hover:border-[var(--brand-orange)] hover:shadow-brand-glow"
									aria-label="Account menu"
									aria-expanded={dropdownOpen}
									aria-haspopup="true"
								>
									{/* Avatar Image with Numerical Level Overlay */}
									<div className="relative w-9 h-9 flex-shrink-0">
										{userData?.avatarUrl ? (
											<img
												src={userData.avatarUrl}
												alt="Avatar"
												className="w-9 h-9 rounded-full object-cover"
												style={{ border: `2px solid ${currentRank.color}` }}
											/>
										) : (
											<div
												className="w-9 h-9 rounded-full flex items-center justify-center"
												style={{ background: "var(--bg-dark-layer-2)", border: `2px solid ${currentRank.color}`, color: "var(--text-muted)" }}
											>
												<FaUser size={14} />
											</div>
										)}
										{/* Numerical Level Index Overlay Badge */}
										<span 
											className="absolute -bottom-1 -right-1 flex h-4 w-4 rounded-full items-center justify-center text-[8px] font-black text-white border border-[var(--bg-dark-layer-1)]"
											style={{ background: currentRank.color }}
										>
											{level}
										</span>
									</div>

									{/* User Details & XP Bar */}
									<div className="hidden sm:flex flex-col text-left">
										<div className="flex items-center gap-2">
											<span className="text-xs font-bold text-[var(--text-primary)] truncate max-w-[80px]">
												{userData?.displayName || user.displayName || "User"}
											</span>
											<span 
												className="px-1.5 py-0.5 rounded-full text-[8px] font-black tracking-wide border uppercase"
												style={{
													borderColor: currentRank.color,
													color: currentRank.color,
													background: `${currentRank.color}15`,
												}}
											>
												{currentRank.name}
											</span>
										</div>
										{/* XP Progress Linear Tracker */}
										<div className="w-24 h-1.5 bg-[var(--bg-dark-layer-2)] rounded-full overflow-hidden mt-1 border border-[var(--border-subtle)] relative">
											<div 
												className="h-full rounded-full transition-all duration-500 ease-out" 
												style={{ 
													width: `${xpPercent}%`,
													background: currentRank.color,
													boxShadow: `0 0 8px ${currentRank.color}`,
												}}
											/>
										</div>
									</div>
								</button>

								{/* ── DROPDOWN PANEL ── */}
								{dropdownOpen && (
									<div
										className="absolute top-[calc(100%+8px)] right-0 w-52 rounded-xl overflow-hidden animate-fade-in z-[100]"
										style={{
											background: "var(--bg-elevated)",
											border: "1px solid var(--border-default)",
											boxShadow: "var(--shadow-lg)",
										}}
										role="menu"
									>
										{/* User info */}
										<div
											className="flex items-center gap-3 px-4 py-3"
											style={{ borderBottom: "1px solid var(--border-subtle)" }}
										>
											{userData?.avatarUrl ? (
												<img src={userData.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover flex-shrink-0" style={{ border: `1px solid ${currentRank.color}` }} />
											) : (
												<div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "var(--bg-dark-fill-3)", border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
													<FaUser size={12} />
												</div>
											)}
											<div className="overflow-hidden">
												<p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{userData?.displayName || user.displayName || "User"}</p>
												<p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{user.email}</p>
											</div>
										</div>

										{/* Links */}
										<div className="py-1">
											{[
												{ href: "/profile",  label: "My Profile", icon: <FaUser size={10} /> },
												{ href: "/settings", label: "Settings",   icon: <FaCog  size={10} /> },
												...(isAdmin ? [{ href: "/admin", label: "Admin Panel", icon: <FaShieldAlt size={10} /> }] : []),
											].map((item) => (
												<Link
													key={item.href}
													href={item.href}
													onClick={() => setDropdownOpen(false)}
													className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium transition-all duration-100 text-text-secondary hover:text-text-primary hover:bg-dark-fill-3"
													role="menuitem"
												>
													<span style={{ color: "var(--brand-orange)", opacity: 0.7 }}>{item.icon}</span>
													{item.label}
												</Link>
											))}
										</div>

										{/* Theme picker */}
										<div className="px-4 py-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
											<p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Theme</p>
											<div className="grid grid-cols-4 gap-1">
												{THEMES.map((t) => (
													<button
														key={t.id}
														onClick={() => handleThemeChange(t.id)}
														title={t.label}
														className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg transition-all duration-150"
														style={{
															border: activeTheme === t.id ? "1px solid var(--border-accent)" : "1px solid var(--border-subtle)",
															background: activeTheme === t.id ? "var(--brand-glow)" : "transparent",
															boxShadow: activeTheme === t.id ? "var(--shadow-glow-sm)" : "none",
															color: activeTheme === t.id ? "var(--brand-orange)" : "var(--text-muted)",
															fontSize: "8px",
															fontWeight: 700,
														}}
													>
														<span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t.color }} />
														{t.label}
													</button>
												))}
											</div>
										</div>

										{/* Sign out */}
										<div
											className="px-4 py-2 flex items-center justify-between"
											style={{ borderTop: "1px solid var(--border-subtle)" }}
										>
											<span className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>Sign Out</span>
											<Logout />
										</div>
									</div>
								)}
							</div>
						)}

						{/* MOBILE HAMBURGER (non-problem pages) */}
						{!problemPage && (
							<button
								onClick={() => setMobileOpen(!mobileOpen)}
								className="flex md:hidden items-center justify-center w-10 h-10 rounded-xl ml-1 transition-all duration-150"
								style={{ color: "var(--text-secondary)", background: mobileOpen ? "var(--bg-dark-fill-3)" : "transparent" }}
								aria-label={mobileOpen ? "Close menu" : "Open menu"}
								aria-expanded={mobileOpen}
							>
								{mobileOpen ? <FaTimes size={16} /> : <FaBars size={16} />}
							</button>
						)}
					</div>
				</div>
			</nav>

			{/* ════════════════════════════════ MOBILE DRAWER ════════════════════════════════ */}
			{!problemPage && mobileOpen && (
				<div
					ref={mobileRef}
					className="md:hidden fixed top-[68px] left-0 right-0 z-40 animate-fade-in"
					style={{
						background: "var(--bg-elevated)",
						borderBottom: "1px solid var(--border-subtle)",
						boxShadow: "var(--shadow-lg)",
					}}
					role="navigation"
					aria-label="Mobile navigation"
				>
					<div className="flex flex-col py-2 px-3">
						{NAV_TABS.map((tab) => {
							const active = isTabActive(tab);
							return (
								<Link
									key={tab.name}
									href={tab.path}
									className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold transition-all duration-150 border ${
										active ? "glow-active" : "border-transparent text-gray-400 hover:text-white"
									}`}
									style={{
										color: active ? "var(--brand-orange)" : "var(--text-secondary)",
									}}
									aria-current={active ? "page" : undefined}
								>
									{tab.icon && <span>{tab.icon}</span>}
									{tab.name}
								</Link>
							);
						})}

						<div className="my-1.5" style={{ borderTop: "1px solid var(--border-subtle)" }} />

						<Link href="/search" className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold transition-all duration-150" style={{ color: router.pathname === "/search" ? "var(--brand-orange)" : "var(--text-secondary)" }}>
							<FaSearch size={12} /> Search
						</Link>

						{user && (
							<Link href="/notifications" className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold transition-all duration-150" style={{ color: router.pathname === "/notifications" ? "var(--brand-orange)" : "var(--text-secondary)" }}>
								<FaBell size={12} /> Notifications
							</Link>
						)}

						{user && (
							<Link href="/messages" className="flex items-center justify-between px-3 py-3 rounded-lg text-sm font-semibold transition-all duration-150" style={{ color: router.pathname.startsWith("/messages") ? "var(--brand-orange)" : "var(--text-secondary)" }}>
								<div className="flex items-center gap-3">
									<FaComments size={13} /> Messages
								</div>
								{unreadChatCount > 0 && (
									<span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-orange text-white">
										{unreadChatCount}
									</span>
								)}
							</Link>
						)}

						<Link href="/settings" className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold transition-all duration-150" style={{ color: router.pathname === "/settings" ? "var(--brand-orange)" : "var(--text-secondary)" }}>
							<FaCog size={12} /> Settings
						</Link>

						{user && (
							<Link href="/profile" className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold transition-all duration-150" style={{ color: router.pathname === "/profile" ? "var(--brand-orange)" : "var(--text-secondary)" }}>
								<FaUser size={12} /> Profile
							</Link>
						)}

						<div className="my-1.5" style={{ borderTop: "1px solid var(--border-subtle)" }} />

						<Link href="/qr" className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-150" style={{ color: "var(--text-muted)" }}>
							<FaCoffee size={12} /> Support
						</Link>

						{!user && (
							<button
								type="button"
								onClick={() => {
									setMobileOpen(false);
									setAuthModal((p) => ({ ...p, isOpen: true, type: "login" }));
								}}
								className="mt-2 flex items-center justify-center py-2.5 rounded-lg text-sm font-bold transition-all duration-150 w-full"
								style={{ background: "var(--brand-orange)", color: "var(--bg-base)" }}
							>
								Sign In
							</button>
						)}
					</div>
				</div>
			)}
		</>
	);
};

export default Topbar;