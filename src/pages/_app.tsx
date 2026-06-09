import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { RecoilRoot } from "recoil";
import React, { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, firestore } from "@/firebase/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import ProfileSetupModal from "@/components/Modals/ProfileSetupModal";
import EmailVerificationModal from "@/components/Modals/EmailVerificationModal";
import { useRouter } from "next/router";

console.log = () => {};
console.error = () => {};
console.warn = () => {};
console.info = () => {};
console.debug = () => {};

if (typeof window !== "undefined") {
	window.addEventListener("error", (e) => e.preventDefault());
	window.addEventListener("unhandledrejection", (e) => e.preventDefault());
}

function GlobalAuthAndProfileCheck() {
	const [user, loading] = useAuthState(auth);
	const router = useRouter();
	const [showVerificationModal, setShowVerificationModal] = useState(false);
	const [showProfileModal, setShowProfileModal] = useState(false);

	useEffect(() => {
		if (loading) return;

		if (!user || router.pathname === "/auth") {
			setShowVerificationModal(false);
			setShowProfileModal(false);
			return;
		}

		// 1. Check email verification
		if (!user.emailVerified) {
			setShowVerificationModal(true);
			setShowProfileModal(false);
			return;
		} else {
			setShowVerificationModal(false);
		}

		// 2. Check profile fields in Firestore
		const checkProfile = async () => {
			try {
				const userRef = doc(firestore, "users", user.uid);
				const userSnap = await getDoc(userRef);

				if (!userSnap.exists()) {
					await setDoc(userRef, {
						uid: user.uid,
						email: user.email,
						displayName: user.displayName || "Anonymous User",
						createdAt: Date.now(),
						updatedAt: Date.now(),
						likedProblems: [],
						dislikedProblems: [],
						solvedProblems: [],
						starredProblems: [],
						showStudentInfo: true,
					});
					setShowProfileModal(true);
				} else {
					const data = userSnap.data();
					const hasCompleteProfile =
						data.displayName &&
						data.studentId &&
						data.school &&
						data.faculty &&
						data.class &&
						data.username &&
						data.experienceLevel;

					if (!hasCompleteProfile) {
						setShowProfileModal(true);
					} else {
						setShowProfileModal(false);
					}
				}
			} catch (e) {
				console.error("Error checking user profile setup:", e);
			}
		};

		checkProfile();
	}, [user, loading, router.pathname]);

	return (
		<>
			{showVerificationModal && (
				<EmailVerificationModal
					isOpen={showVerificationModal}
					onClose={() => setShowVerificationModal(false)}
				/>
			)}
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
	useEffect(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("theme") || "default";
			document.documentElement.setAttribute("data-theme", saved);
			if (saved === "light") {
				document.documentElement.classList.remove("dark");
			} else {
				document.documentElement.classList.add("dark");
			}

			const handleSync = () => {
				const current = localStorage.getItem("theme") || "default";
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
				<link rel='icon' href='/favicon.png' />
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
			<Component {...pageProps} />
		</RecoilRoot>
	);
}
