import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { auth, firestore } from "@/firebase/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { FaBell, FaUser, FaCog, FaSearch, FaTrophy, FaCode, FaStream } from "react-icons/fa";

const TabsNavigation: React.FC = () => {
	const router = useRouter();
	const pathname = router.pathname;
	const [user] = useAuthState(auth);
	const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
	const [mounted, setMounted] = useState(false);

	useEffect(() => { setMounted(true); }, []);

	useEffect(() => {
		if (!user) { setAvatarUrl(null); return; }
		const unsub = onSnapshot(doc(firestore, "users", user.uid), (snap) => {
			if (snap.exists()) setAvatarUrl(snap.data().avatarUrl || null);
		});
		return () => unsub();
	}, [user]);

	if (!mounted) {
		return (
			<div className="h-[52px] mb-6 max-w-[860px] mx-auto w-full" />
		);
	}

	const tabs = [
		{
			name: "Problems",
			path: "/",
			icon: <FaCode size={13} />,
			exact: true,
		},
		{
			name: "Rankings",
			path: "/rankings",
			icon: <FaTrophy size={13} />,
		},
		{
			name: "Contests",
			path: "/contests",
			icon: null,
			label: "Contests",
		},
		{
			name: "Threads",
			path: "/threads",
			icon: <FaStream size={13} />,
		},
		{
			name: "Search",
			path: "/search",
			icon: <FaSearch size={13} />,
			iconOnly: true,
		},
		...(user
			? [
				{
					name: "Notifications",
					path: "/notifications",
					icon: <FaBell size={13} />,
					iconOnly: true,
				},
			]
			: []),
		{
			name: "Settings",
			path: "/settings",
			icon: <FaCog size={13} />,
			iconOnly: true,
		},
	];

	return (
		<div
			className="sticky top-[56px] z-30 mb-6 max-w-[860px] mx-auto w-full px-1"
			style={{ background: "var(--bg-dark-layer-2)" }}
		>
			<div className="flex items-center border-b"
				style={{ borderColor: "var(--border-subtle)" }}>
				{tabs.map((tab) => {
					const isActive = tab.exact
						? pathname === "/" || pathname === "/problems"
						: pathname.startsWith(tab.path);

					return (
						<Link
							key={tab.name}
							href={tab.path}
							title={tab.name}
							className={`
								relative flex items-center gap-1.5 px-3.5 py-3 text-xs font-semibold
								whitespace-nowrap transition-all duration-200 group
								${isActive
									? "text-brand-orange"
									: "text-dark-gray-6 hover:text-dark-gray-8"
								}
							`}
						>
							{/* Active indicator underline */}
							{isActive && (
								<span
									className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full transition-all duration-300"
									style={{
										width: "70%",
										background: "var(--brand-orange)",
										boxShadow: "0 0 8px var(--brand-orange)",
									}}
								/>
							)}

							{/* Icon */}
							{tab.icon && (
								<span className={`flex-shrink-0 transition-transform duration-200 ${isActive ? "scale-110" : "group-hover:scale-105"}`}>
									{tab.icon}
								</span>
							)}

							{/* Label — hide on icon-only items */}
							{!tab.iconOnly && (
								<span className="hidden sm:inline">{tab.name}</span>
							)}
						</Link>
					);
				})}
			</div>
		</div>
	);
};

export default TabsNavigation;
