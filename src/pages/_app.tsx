import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { RecoilRoot } from "recoil";
import React, { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, firestore } from "@/firebase/firebase";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import ProfileSetupModal from "@/components/Modals/ProfileSetupModal";
import AuthModal from "@/components/Modals/AuthModal";
import { useRouter } from "next/router";
import ErrorBoundary from "@/components/ErrorBoundary/ErrorBoundary";
import { RealtimeNotificationProvider } from "@/context/RealtimeNotificationProvider";

import { apiClient } from "@/utils/apiClient";

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

// Setup global fetch interceptor to guarantee JSON outputs and wrap with apiClient logic
if (typeof window !== "undefined" && !(window as any).__fetchIntercepted) {
	(window as any).__fetchIntercepted = true;
	const originalFetch = window.fetch;
	(window as any).__originalFetch = originalFetch;

	window.fetch = async function (input, init) {
		const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;

		// We only intercept requests to organization module APIs
		const isOrgApi = url.startsWith("/api/organizations") ||
			url.startsWith("/api/orgs") ||
			url.startsWith("/api/users/invitations") ||
			url.startsWith("/api/invite-links");

		const isApiClient = init?.headers && (
			(init.headers instanceof Headers && init.headers.has("x-api-client")) ||
			(typeof init.headers === "object" && (init.headers as any)["x-api-client"])
		);

		if (isOrgApi && !isApiClient) {
			console.log(`[Fetch Interceptor] Routing organization request via apiClient: ${url}`);
			try {
				const data = await apiClient.request(url, {
					...init,
				});

				// Return a valid JSON Response
				return new Response(JSON.stringify(data), {
					status: 200,
					statusText: "OK",
					headers: {
						"Content-Type": "application/json"
					}
				});
			} catch (err: any) {
				console.error(`[Fetch Interceptor Error] Failed request for ${url}:`, err);
				
				const status = err.status || 500;
				const errorPayload = {
					success: false,
					error: err.message || "Internal Server Error",
					code: err.code || "API_ERROR",
					details: err.details
				};

				return new Response(JSON.stringify(errorPayload), {
					status: status,
					statusText: err.message || "Error",
					headers: {
						"Content-Type": "application/json"
					}
				});
			}
		}

		return originalFetch(input, init);
	};
}

function GlobalAuthAndProfileCheck() {
	const [user, loading] = useAuthState(auth);
	const router = useRouter();
	const [showProfileModal, setShowProfileModal] = useState(false);

	// Routes exempt from all auth guards
	const isVerifyPage = router.pathname === "/auth/verify-email" || router.pathname === "/verify-email";
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
		// intercept navigation to any protected path and force them to /auth/verify-email.
		if (user && !user.emailVerified && !isExemptPage) {
			router.replace("/auth/verify-email");
			return;
		}

		if (!user || isExemptPage) {
			setShowProfileModal(false);
			return;
		}

		// Set up real-time listener for user moderation status
		const modRef = doc(firestore, "userModeration", user.uid);
		let unsubMod = () => {};
		try {
			unsubMod = onSnapshot(modRef, async (modSnap) => {
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
			}, (err) => {
				console.error("Moderation listener error:", err);
			});
		} catch (e) {
			console.error("Error setting up moderation listener:", e);
		}

		// Set up real-time listener for user profile/onboarding completeness
		const userRef = doc(firestore, "users", user.uid);
		let unsubUser = () => {};
		try {
			unsubUser = onSnapshot(userRef, async (userSnap) => {
				if (!userSnap.exists()) {
					// Document missing — call the provision endpoint to create it atomically.
					try {
						const token = await user.getIdToken(true);
						await fetch("/api/auth/provision", {
							method: "POST",
							headers: { Authorization: `Bearer ${token}` },
						});
					} catch (e) {
						console.error("Failed to call provision endpoint:", e);
					}
					setShowProfileModal(true);
					return;
				}

				const data = userSnap.data();

				if (data.status === "PENDING_DELETION" || data.status === "APPEALED") {
					router.push("/account-appeal");
					return;
				}

				// Profile completeness check — show setup modal if missing required fields
				const hasCompleteProfile =
					data.displayName &&
					data.studentId &&
					data.school &&
					data.faculty &&
					data.class &&
					data.username &&
					data.experienceLevel;

				setShowProfileModal(!hasCompleteProfile);
			}, (err) => {
				console.error("User listener error:", err);
			});
		} catch (e) {
			console.error("Error setting up user listener:", e);
		}

		return () => {
			unsubMod();
			unsubUser();
		};
	}, [user, loading, router.pathname]);

	useEffect(() => {
		if (loading || !user || !user.emailVerified || isExemptPage) return;

		const syncSession = async () => {
			try {
				let sessionId = localStorage.getItem("bc_session_id");
				if (!sessionId) {
					sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
					localStorage.setItem("bc_session_id", sessionId);
				}

				const idToken = await user.getIdToken();
				const res = await fetch("/api/security/sessions", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"Authorization": `Bearer ${idToken}`
					},
					body: JSON.stringify({ sessionId })
				});

				if (!res.ok) {
					const data = await res.json().catch(() => ({}));
					if (res.status === 401) {
						// Token is truly expired or invalid
						localStorage.removeItem("bc_session_id");
						await auth.signOut();
					} else if (res.status === 403) {
						// User moderation: route to suspended or appeal if applicable;
						// do not destroy the session if this was an auxiliary check or transient state.
						if (data?.error?.code === "BANNED") {
							router.push("/suspended");
						} else if (data?.error?.code === "PENDING_DELETION") {
							router.push("/account-appeal");
						}
					}
				}
			} catch (err) {
				console.error("Session sync failed:", err);
			}
		};

		syncSession();
		const interval = setInterval(syncSession, 2 * 60 * 1000);
		return () => clearInterval(interval);
	}, [user, loading, router, isExemptPage]);

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
			<AuthModal />
			<ErrorBoundary>
				<RealtimeNotificationProvider>
					<Component {...pageProps} />
				</RealtimeNotificationProvider>
			</ErrorBoundary>
		</RecoilRoot>
	);
}
