import { auth, firestore } from "@/firebase/firebase";
import Link from "next/link";
import React, { useState, useEffect, useRef } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import Logout from "../Buttons/Logout";
import { useSetRecoilState } from "recoil";
import { authModalState } from "@/atoms/authModalAtom";
import Image from "next/image";
import {
	FaChevronLeft, FaChevronRight, FaUser, FaCog,
	FaShieldAlt, FaBell, FaSearch, FaTrophy,
	FaCode, FaStream, FaBars, FaTimes,
} from "react-icons/fa";
import { BsList } from "react-icons/bs";
import Timer from "../Timer/Timer";
import { useRouter } from "next/router";
import { problems } from "@/utils/problems";
import { Problem } from "@/utils/types/problem";
import { useAdmin } from "@/hooks/useAdmin";
import { doc, onSnapshot } from "firebase/firestore";

type TopbarProps = {
	problemPage?: boolean;
};

const THEMES = [
	{ id: "default", label: "Dark",   color: "#f59e0b" },
	{ id: "light",   label: "Light",  color: "#7c3aed" },
	{ id: "sakura",  label: "Sakura", color: "#ffb7c5" },
	{ id: "red",     label: "Red",    color: "#ef4444" },
];

// Primary nav tabs — shown in the center of the bar on non-problem pages
const NAV_TABS = [
	{ name: "Problems",  path: "/",          icon: <FaCode  size={11} />, exact: true  },
	{ name: "Rankings",  path: "/rankings",  icon: <FaTrophy size={11} />, exact: false },
	{ name: "Contests",  path: "/contests",  icon: null,                  exact: false },
	{ name: "Threads",   path: "/threads",   icon: <FaStream size={11} />, exact: false },
];

const Topbar: React.FC<TopbarProps> = ({ problemPage }) => {
	const [user]         = useAuthState(auth);
	const setAuthModal   = useSetRecoilState(authModalState);
	const router         = useRouter();
	const [isAdmin]      = useAdmin();
	const [dropdownOpen, setDropdownOpen] = useState(false);
	const [mobileOpen,   setMobileOpen]   = useState(false);
	const dropdownRef    = useRef<HTMLDivElement>(null);
	const mobileRef      = useRef<HTMLDivElement>(null);
	const [avatarUrl, setAvatarUrl]       = useState<string | null>(null);
	const [activeTheme, setActiveTheme]   = useState("default");
	const [scrolled, setScrolled]         = useState(false);

	/* ── avatar subscription ── */
	useEffect(() => {
		if (!user) { setAvatarUrl(null); return; }
		const unsub = onSnapshot(doc(firestore, "users", user.uid), (snap) => {
			if (snap.exists()) setAvatarUrl(snap.data().avatarUrl || null);
		});
		return () => unsub();
	}, [user]);

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
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, []);

	/* ── close mobile on route change ── */
	useEffect(() => { setMobileOpen(false); }, [router.pathname]);

	const handleThemeChange = (t: string) => {
		localStorage.setItem("theme", t);
		document.documentElement.setAttribute("data-theme", t);
		setActiveTheme(t);
		window.dispatchEvent(new Event("themechange"));
		if (t === "light") document.documentElement.classList.remove("dark");
		else               document.documentElement.classList.add("dark");
	};

	const handleProblemChange = (isForward: boolean) => {
		const { order } = problems[router.query.pid as string] as Problem;
		const nextOrder = order + (isForward ? 1 : -1);
		const nextKey   = Object.keys(problems).find((k) => problems[k].order === nextOrder);
		if (!nextKey) {
			const fallback = Object.keys(problems).find((k) =>
				isForward ? problems[k].order === 1 : problems[k].order === Object.keys(problems).length
			);
			router.push(`/problems/${fallback}`);
		} else {
			router.push(`/problems/${nextKey}`);
		}
	};

	const isTabActive = (tab: typeof NAV_TABS[number]) =>
		tab.exact
			? router.pathname === "/" || router.pathname === "/problems"
			: router.pathname.startsWith(tab.path);

	/* ── nav background: always derived from CSS variable, never `bg-white` ── */
	const navStyle: React.CSSProperties = {
		background:    scrolled ? "var(--bg-dark-layer-2)" : "var(--bg-dark-layer-2)",
		borderBottom:  scrolled ? "1px solid var(--border-subtle)" : "1px solid transparent",
		backdropFilter: scrolled ? "blur(12px)" : "none",
		WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
		fontFamily: "var(--font-sans)",
		transition: "border-color 200ms ease, backdrop-filter 200ms ease",
	};

	/* ── shared tab style helper ── */
	const tabCls = (active: boolean) =>
		`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 select-none`;

	/* ── icon button style helper ── */
	const iconBtnCls = (active?: boolean) =>
		`flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150 cursor-pointer ${
			active
				? "text-brand-orange bg-brand-orange/10"
				: "text-dark-gray-6 hover:text-dark-gray-8 hover:bg-dark-fill-3"
		}`;

	const notifActive = router.pathname === "/notifications";
	const searchActive = router.pathname === "/search";

	return (
		<>
			{/* ════════════════════════════════ NAV BAR ════════════════════════════════ */}
			<nav
				className="sticky top-0 z-50 h-[52px] w-full flex shrink-0 items-center px-4"
				style={navStyle}
				aria-label="Main navigation"
			>
				<div className={`flex w-full items-center gap-2 ${!problemPage ? "max-w-[1200px] mx-auto" : ""}`}>

					{/* ── LOGO ── */}
					<Link href="/" className="flex items-center shrink-0 mr-2" aria-label="BeastCode home">
						<Image src="/logo-full.png" alt="BeastCode" height={24} width={90} className="h-6 w-auto object-contain" />
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
										className={tabCls(active)}
										style={{ color: active ? "var(--brand-orange)" : "var(--text-secondary)", background: active ? "var(--brand-glow)" : "transparent" }}
										onMouseEnter={(e) => { if (!active) { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--bg-dark-fill-3)"; } }}
										onMouseLeave={(e) => { if (!active) { e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.background = "transparent"; } }}
										aria-current={active ? "page" : undefined}
									>
										{active && (
											<span
												className="absolute inset-x-2 bottom-0 h-[2px] rounded-full"
												style={{ background: "var(--brand-orange)" }}
											/>
										)}
										{tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
										{tab.name}
									</Link>
								);
							})}
						</div>
					)}

					{/* ── CENTER: PROBLEM NAV (problem page only) ── */}
					{problemPage && (
						<div className="flex items-center gap-2 flex-1 justify-center">
							<button
								onClick={() => handleProblemChange(false)}
								className={iconBtnCls()}
								aria-label="Previous problem"
								style={{ border: "1px solid var(--border-subtle)" }}
							>
								<FaChevronLeft size={10} />
							</button>

							<Link
								href="/"
								className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
								style={{ background: "var(--bg-dark-fill-3)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}
							>
								<BsList size={13} />
								Problem List
							</Link>

							<button
								onClick={() => handleProblemChange(true)}
								className={iconBtnCls()}
								aria-label="Next problem"
								style={{ border: "1px solid var(--border-subtle)" }}
							>
								<FaChevronRight size={10} />
							</button>
						</div>
					)}

					{/* ── RIGHT UTILITIES ── */}
					<div className="flex items-center gap-1 ml-auto shrink-0">

						{/* Search icon */}
						{!problemPage && (
							<Link
								href="/search"
								className={iconBtnCls(searchActive)}
								aria-label="Search"
								title="Search"
							>
								<FaSearch size={13} />
							</Link>
						)}

						{/* Notifications icon */}
						{user && !problemPage && (
							<Link
								href="/notifications"
								className={iconBtnCls(notifActive)}
								aria-label="Notifications"
								title="Notifications"
							>
								<FaBell size={13} />
							</Link>
						)}

						{/* Timer (problem page only) */}
						{user && problemPage && <Timer />}

						{/* Support */}
						<Link
							href="/qr"
							className="hidden sm:flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-all duration-150"
							style={{ color: "var(--text-muted)" }}
							onMouseEnter={(e) => { e.currentTarget.style.color = "var(--brand-orange)"; e.currentTarget.style.background = "var(--brand-glow)"; }}
							onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}
							title="Support"
						>
							☕
						</Link>

						{/* Admin badge */}
						{isAdmin && (
							<Link
								href="/admin"
								className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all duration-150"
								style={{ color: "var(--text-secondary)", background: "var(--bg-dark-fill-3)", border: "1px solid var(--border-subtle)" }}
								onMouseEnter={(e) => { e.currentTarget.style.color = "var(--brand-orange)"; e.currentTarget.style.borderColor = "var(--border-accent)"; }}
								onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.borderColor = "var(--border-subtle)"; }}
							>
								<FaShieldAlt size={10} style={{ color: "var(--brand-orange)" }} />
								Admin
							</Link>
						)}

						{/* Divider */}
						<div className="h-4 w-px mx-1 hidden sm:block" style={{ background: "var(--border-subtle)" }} />

						{/* SIGN IN */}
						{!user && (
							<Link
								href="/auth"
								onClick={() => setAuthModal((p) => ({ ...p, isOpen: true, type: "login" }))}
								className="inline-flex items-center px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-150"
								style={{ background: "var(--brand-orange)", color: "#0d0d0f" }}
								onMouseEnter={(e) => { e.currentTarget.style.background = "var(--brand-orange-s)"; }}
								onMouseLeave={(e) => { e.currentTarget.style.background = "var(--brand-orange)"; }}
							>
								Sign In
							</Link>
						)}

						{/* AVATAR + DROPDOWN */}
						{user && (
							<div className="relative" ref={dropdownRef}>
								<button
									onClick={() => setDropdownOpen(!dropdownOpen)}
									className="flex items-center p-0.5 rounded-full transition-all duration-150 cursor-pointer"
									style={{ outline: dropdownOpen ? "2px solid var(--border-accent)" : "2px solid transparent", outlineOffset: "1px" }}
									aria-label="Account menu"
									aria-expanded={dropdownOpen}
									aria-haspopup="true"
								>
									{avatarUrl ? (
										<img
											src={avatarUrl}
											alt="Avatar"
											className="w-7 h-7 rounded-full object-cover"
											style={{ border: "2px solid var(--border-accent)" }}
										/>
									) : (
										<div
											className="w-7 h-7 rounded-full flex items-center justify-center"
											style={{ background: "var(--bg-dark-fill-3)", border: "2px solid var(--border-accent)", color: "var(--text-muted)" }}
										>
											<FaUser size={11} />
										</div>
									)}
								</button>

								{/* ── DROPDOWN PANEL ── */}
								{dropdownOpen && (
									<div
										className="absolute top-[calc(100%+8px)] right-0 w-52 rounded-xl overflow-hidden animate-fade-in"
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
											{avatarUrl ? (
												<img src={avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover flex-shrink-0" style={{ border: "1px solid var(--border-accent)" }} />
											) : (
												<div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "var(--bg-dark-fill-3)", border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>
													<FaUser size={12} />
												</div>
											)}
											<div className="overflow-hidden">
												<p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{user.displayName || "User"}</p>
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
													className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium transition-all duration-100"
													style={{ color: "var(--text-secondary)" }}
													onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-primary)"; e.currentTarget.style.background = "var(--bg-dark-fill-3)"; }}
													onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-secondary)"; e.currentTarget.style.background = "transparent"; }}
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
								className="flex md:hidden items-center justify-center w-8 h-8 rounded-lg ml-1 transition-all duration-150"
								style={{ color: "var(--text-secondary)", background: mobileOpen ? "var(--bg-dark-fill-3)" : "transparent" }}
								aria-label={mobileOpen ? "Close menu" : "Open menu"}
								aria-expanded={mobileOpen}
							>
								{mobileOpen ? <FaTimes size={14} /> : <FaBars size={14} />}
							</button>
						)}
					</div>
				</div>
			</nav>

			{/* ════════════════════════════════ MOBILE DRAWER ════════════════════════════════ */}
			{!problemPage && mobileOpen && (
				<div
					ref={mobileRef}
					className="md:hidden fixed top-[52px] left-0 right-0 z-40 animate-fade-in"
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
									className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold transition-all duration-150"
									style={{
										color: active ? "var(--brand-orange)" : "var(--text-secondary)",
										background: active ? "var(--brand-glow)" : "transparent",
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
							☕ Support
						</Link>

						{!user && (
							<Link href="/auth" className="mt-2 flex items-center justify-center py-2.5 rounded-lg text-sm font-bold transition-all duration-150" style={{ background: "var(--brand-orange)", color: "#0d0d0f" }}>
								Sign In
							</Link>
						)}
					</div>
				</div>
			)}
		</>
	);
};

export default Topbar;