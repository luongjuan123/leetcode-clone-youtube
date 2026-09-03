import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { RecoilRoot } from "recoil";
import React, { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, firestore } from "@/firebase/firebase";
import { doc, getDoc } from "firebase/firestore";
import ProfileSetupModal from "@/components/Modals/ProfileSetupModal";
import { useRouter } from "next/router";
import ErrorBoundary from "@/components/ErrorBoundary/ErrorBoundary";
import { RealtimeNotificationProvider } from "@/context/RealtimeNotificationProvider";

const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
	console.log = () => {};
	console.info = () => {};
	console.debug = () => {};
	console.warn = () => {};
	console.error = (...args) => {
		if (typeof window !== "undefined") {
			(window as any).__developer_errors = (window as any).__developer_errors || [];
			(window as any).__developer_errors.push({ type: "console_error", args, timestamp: Date.now() });
		}
	};
}

if (typeof window !== "undefined" && isProduction) {
	window.addEventListener("error", (e) => e.preventDefault());
	window.addEventListener("unhandledrejection", (e) => e.preventDefault());
}

function GlobalAuthAndProfileCheck() {
	const [user, loading] = useAuthState(auth);
	const router = useRouter();
	const [showProfileModal, setShowProfileModal] = useState(false);

	// Routes exempt from all auth guards
	const isVerifyPage = router.pathname === "/verify-email";
	const isExemptPage =
		router.pathname === "/auth" ||
		router.pathname === "/suspended" ||
		router.pathname === "/account-appeal" ||
		isVerifyPage ||
		router.pathname === "/unsubscribe" ||
		router.pathname === "/reset-password" ||
		router.pathname === "/error";

	useEffect(() => {
		if (loading) return;

		// ── Unverified user session guard ─────────────────────────────────────────
		// If there is an authenticated user but the email is not yet verified,
		// intercept navigation to any protected path and force them to /verify-email.
		if (user && !user.emailVerified && !isExemptPage) {
			router.replace("/verify-email");
			return;
		}

		if (!user || isExemptPage) {
			setShowProfileModal(false);
			return;
		}

		const checkModerationAndProfile = async () => {
			try {
				// 1. Check moderation status
				const modRef = doc(firestore, "userModeration", user.uid);
				const modSnap = await getDoc(modRef);

				if (modSnap.exists()) {
					const modData = modSnap.data();
					if (modData.status === "BANNED") {
						// Check if temporary ban is expired
						if (modData.expiresAt && Date.now() > modData.expiresAt) {
							const idToken = await user.getIdToken(true);
							const res = await fetch("/api/auth/check-status", {
								method: "POST",
								headers: {
									"Content-Type": "application/json",
									"Authorization": `Bearer ${idToken}`
								}
							});
							if (res.ok) {
								window.location.reload();
								return;
							}
						}
						router.push("/suspended");
						return;
					}

					if (modData.status === "PENDING_DELETION" || modData.status === "APPEALED") {
						router.push("/account-appeal");
						return;
					}
				}

				// 2. Ensure the /users/{uid} document exists (lazy provision check)
				const userRef = doc(firestore, "users", user.uid);
				const userSnap = await getDoc(userRef);

				if (!userSnap.exists()) {
					// Document missing — call the provision endpoint to create it atomically.
					// This handles edge cases where the user verified email on another device.
					try {
						const token = await user.getIdToken(true);
						await fetch("/api/auth/provision", {
							method: "POST",
							headers: { Authorization: `Bearer ${token}` },
						});
					} catch {
						// Non-critical: will retry on next navigation
					}
					setShowProfileModal(true);
					return;
				}

				const data = userSnap.data();

				if (data.status === "PENDING_DELETION" || data.status === "APPEALED") {
					router.push("/account-appeal");
					return;
				}

				// 3. Profile completeness check — show setup modal if missing required fields
				const hasCompleteProfile =
					data.displayName &&
					data.studentId &&
					data.school &&
					data.faculty &&
					data.class &&
					data.username &&
					data.experienceLevel;

				setShowProfileModal(!hasCompleteProfile);
			} catch (e) {
				console.error("Error in auth and moderation check:", e);
			}
		};

		checkModerationAndProfile();
	}, [user, loading, router.pathname]);

	return (
		<>
			{showProfileModal && (
				<ProfileSetupModal
					isOpen={showProfileModal}
					onClose={() => setShowProfileModal(false)}
				/>
			)}
		</>
	);
}

export default function App({ Component, pageProps }: AppProps) {
	const [activeTheme, setActiveTheme] = useState("default");

	useEffect(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("theme") || "default";
			setActiveTheme(saved);
			document.documentElement.setAttribute("data-theme", saved);
			if (saved === "light") {
				document.documentElement.classList.remove("dark");
			} else {
				document.documentElement.classList.add("dark");
			}

			const handleSync = () => {
				const current = localStorage.getItem("theme") || "default";
				setActiveTheme(current);
				document.documentElement.setAttribute("data-theme", current);
				if (current === "light") {
					document.documentElement.classList.remove("dark");
				} else {
					document.documentElement.classList.add("dark");
				}
			};
			window.addEventListener("themechange", handleSync);
			return () => window.removeEventListener("themechange", handleSync);
		}
	}, []);

	return (
		<RecoilRoot>
			<Head>
				<title>BeastCode</title>
				<meta name='viewport' content='width=device-width, initial-scale=1' />
				<link rel='icon' href={`/favicon-${activeTheme}.svg`} />
				<meta name='description' content='BeastCode — Online Judge platform with coding problems, contests, and video solutions.' />
				<meta property='og:type' content='website' />
				<meta property='og:title' content='BeastCode' />
				<meta property='og:description' content='BeastCode — Online Judge platform with coding problems, contests, and video solutions.' />
				<meta property='og:site_name' content='BeastCode' />
				<meta name='twitter:card' content='summary' />
				<meta name='twitter:title' content='BeastCode' />
				<meta name='twitter:description' content='BeastCode — Online Judge platform with coding problems, contests, and video solutions.' />
			</Head>
			<GlobalAuthAndProfileCheck />
			<ErrorBoundary>
				<RealtimeNotificationProvider>
					<Component {...pageProps} />
				</RealtimeNotificationProvider>
			</ErrorBoundary>
		</RecoilRoot>
	);
}
