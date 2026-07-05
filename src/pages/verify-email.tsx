import React, { useEffect, useRef, useState } from "react";
import { auth } from "@/firebase/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { useRouter } from "next/router";
import { sendEmailVerification } from "firebase/auth";
import Head from "next/head";

// ── SVG circular progress ring constants ─────────────────────────────────────
const RING_R = 10;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;
const RESEND_COOLDOWN = 60;

function CountdownRing({ secondsLeft }: { secondsLeft: number }) {
	const offset =
		RING_CIRCUMFERENCE * (1 - secondsLeft / RESEND_COOLDOWN);
	return (
		<svg width="28" height="28" className="shrink-0 -rotate-90" aria-hidden="true">
			<circle
				cx="14"
				cy="14"
				r={RING_R}
				fill="none"
				stroke="#2a2a30"
				strokeWidth="2.5"
			/>
			<circle
				cx="14"
				cy="14"
				r={RING_R}
				fill="none"
				stroke="#f97316"
				strokeWidth="2.5"
				strokeLinecap="round"
				strokeDasharray={RING_CIRCUMFERENCE}
				strokeDashoffset={offset}
				style={{ transition: "stroke-dashoffset 1s linear" }}
			/>
		</svg>
	);
}

export default function VerifyEmailPage() {
	const [user, loading] = useAuthState(auth);
	const router = useRouter();

	const [verifying, setVerifying] = useState(false);
	const [resending, setResending] = useState(false);
	const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
	const [cooldown, setCooldown] = useState(0); // seconds remaining in resend lock
	const intervalRef = useRef<NodeJS.Timeout | null>(null);

	// If user is already verified and provisioned, send them home
	useEffect(() => {
		if (loading) return;
		if (!user) {
			router.replace("/auth");
			return;
		}
		if (user.emailVerified) {
			// Check provision state then push home
			(async () => {
				try {
					const token = await user.getIdToken(true);
					await fetch("/api/auth/provision", {
						method: "POST",
						headers: { Authorization: `Bearer ${token}` },
					});
				} catch {
					// non-critical
				}
				router.replace("/");
			})();
		}
	}, [user, loading, router]);

	// Cleanup interval on unmount
	useEffect(() => {
		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
	}, []);

	function showToast(msg: string, type: "ok" | "err" = "err") {
		setToast({ msg, type });
		setTimeout(() => setToast(null), 5000);
	}

	function startCooldown() {
		setCooldown(RESEND_COOLDOWN);
		if (intervalRef.current) clearInterval(intervalRef.current);
		intervalRef.current = setInterval(() => {
			setCooldown((prev) => {
				if (prev <= 1) {
					if (intervalRef.current) clearInterval(intervalRef.current);
					return 0;
				}
				return prev - 1;
			});
		}, 1000);
	}

	async function handleVerifyClick() {
		if (!auth.currentUser || verifying) return;
		setVerifying(true);
		try {
			await auth.currentUser.reload();
			if (auth.currentUser.emailVerified) {
				const token = await auth.currentUser.getIdToken(true);
				const res = await fetch("/api/auth/provision", {
					method: "POST",
					headers: { Authorization: `Bearer ${token}` },
				});
				if (res.ok) {
					showToast("Email verified! Redirecting…", "ok");
					setTimeout(() => router.push("/"), 800);
				} else {
					const body = await res.json().catch(() => ({})) as { message?: string };
					showToast(body.message ?? "Provisioning failed. Please try again.", "err");
				}
			} else {
				showToast("Email not yet verified. Please check your spam folder or resend the link.", "err");
			}
		} catch {
			showToast("Something went wrong. Please try again.", "err");
		} finally {
			setVerifying(false);
		}
	}

	async function handleResend() {
		if (!auth.currentUser || cooldown > 0 || resending) return;
		setResending(true);
		try {
			await sendEmailVerification(auth.currentUser);
			showToast("Verification email sent! Check your inbox.", "ok");
			startCooldown();
		} catch {
			showToast("Failed to resend. Please wait a moment and try again.", "err");
		} finally {
			setResending(false);
		}
	}

	if (loading || !user) {
		return (
			<div
				className="min-h-screen flex items-center justify-center"
				style={{ background: "#0a0a0c" }}
			>
				<div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
					style={{ borderColor: "#f97316", borderTopColor: "transparent" }}
				/>
			</div>
		);
	}

	return (
		<>
			<Head>
				<title>Verify Your Email — BeastCode</title>
				<meta name="description" content="Verify your email address to complete your BeastCode account setup." />
			</Head>

			{/* Base canvas */}
			<div
				className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
				style={{ background: "#0a0a0c" }}
			>
				{/* Glassmorphic card */}
				<div
					className="w-full max-w-md rounded-2xl p-8 relative overflow-hidden"
					style={{
						background: "#121216",
						border: "1px solid rgba(249,115,22,0.18)",
						boxShadow: "0 0 60px rgba(249,115,22,0.08), 0 20px 60px rgba(0,0,0,0.6)",
					}}
				>
					{/* Subtle glow backdrop */}
					<div
						className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full pointer-events-none"
						style={{
							background: "radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)",
						}}
						aria-hidden="true"
					/>

					{/* Animated mail icon */}
					<div className="flex flex-col items-center mb-8 relative">
						<div className="relative mb-5">
							<div
								className="w-20 h-20 rounded-2xl flex items-center justify-center"
								style={{
									background: "linear-gradient(135deg, rgba(249,115,22,0.15) 0%, rgba(249,115,22,0.05) 100%)",
									border: "1px solid rgba(249,115,22,0.25)",
								}}
							>
								{/* Mail SVG */}
								<svg
									className="animate-pulse"
									width="40"
									height="40"
									viewBox="0 0 24 24"
									fill="none"
									aria-hidden="true"
								>
									<path
										d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
										stroke="url(#mailGrad)"
										strokeWidth="1.5"
										strokeLinejoin="round"
									/>
									<polyline
										points="22,6 12,13 2,6"
										stroke="url(#mailGrad)"
										strokeWidth="1.5"
										strokeLinejoin="round"
									/>
									<defs>
										<linearGradient id="mailGrad" x1="0" y1="0" x2="24" y2="24">
											<stop offset="0%" stopColor="#f97316" />
											<stop offset="100%" stopColor="#fb923c" />
										</linearGradient>
									</defs>
								</svg>
							</div>
							{/* Ping indicator */}
							<span
								className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
								style={{ background: "#f97316" }}
							>
								<span className="absolute w-full h-full rounded-full animate-ping opacity-40"
									style={{ background: "#f97316" }}
								/>
								<svg width="8" height="8" viewBox="0 0 24 24" fill="white" aria-hidden="true">
									<path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
								</svg>
							</span>
						</div>

						<h1
							className="text-2xl font-bold text-center mb-2"
							style={{
								fontFamily: "'Outfit', sans-serif",
								color: "#f0f0f5",
							}}
						>
							Verify Your Email
						</h1>
						<p className="text-sm text-center" style={{ color: "#8888a0" }}>
							We sent a verification link to:
						</p>
						{/* Email monospace display */}
						<div
							className="mt-2 px-4 py-2 rounded-lg text-sm font-medium truncate max-w-full"
							style={{
								fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
								background: "rgba(249,115,22,0.08)",
								border: "1px solid rgba(249,115,22,0.2)",
								color: "#f97316",
							}}
						>
							{user.email}
						</div>
					</div>

					{/* Instructions */}
					<p className="text-xs text-center leading-relaxed mb-7" style={{ color: "#6666808" }}>
						<span style={{ color: "#8888a0" }}>
							Open the link in the email then return here and click the button below.
							Check your spam folder if you don&apos;t see it.
						</span>
					</p>

					{/* Primary action */}
					<button
						id="verify-email-btn"
						onClick={handleVerifyClick}
						disabled={verifying}
						className="w-full flex items-center justify-center gap-2.5 rounded-xl py-3.5 text-sm font-bold transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mb-3"
						style={{
							background: verifying
								? "rgba(249,115,22,0.4)"
								: "linear-gradient(135deg, #f97316 0%, #ea6c0a 100%)",
							color: "#fff",
							boxShadow: verifying ? "none" : "0 4px 20px rgba(249,115,22,0.3)",
						}}
					>
						{verifying ? (
							<>
								<svg
									className="animate-spin"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									aria-hidden="true"
								>
									<circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
									<path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
								</svg>
								<span>Checking Verification…</span>
							</>
						) : (
							<>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
									<path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
								</svg>
								<span>I Have Verified My Email</span>
							</>
						)}
					</button>

					{/* Resend button with countdown ring */}
					<button
						id="resend-email-btn"
						onClick={handleResend}
						disabled={cooldown > 0 || resending}
						className="w-full flex items-center justify-center gap-2.5 rounded-xl py-3 text-sm font-medium transition-all duration-200"
						style={{
							background: "#1a1a22",
							border: "1px solid #2a2a35",
							color: cooldown > 0 ? "#55556a" : "#a0a0b8",
							cursor: cooldown > 0 ? "not-allowed" : "pointer",
						}}
					>
						{cooldown > 0 ? (
							<>
								<CountdownRing secondsLeft={cooldown} />
								<span>Resend Email ({cooldown}s)</span>
							</>
						) : resending ? (
							<>
								<svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
									<circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
									<path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
								</svg>
								<span>Sending…</span>
							</>
						) : (
							<>
								<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
									<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="1.5" />
									<polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="1.5" />
								</svg>
								<span>Resend Verification Email</span>
							</>
						)}
					</button>

					{/* Sign out link */}
					<p className="text-center text-xs mt-5" style={{ color: "#55556a" }}>
						Wrong account?{" "}
						<button
							id="signout-link"
							className="underline hover:opacity-80 transition-opacity"
							style={{ color: "#8888a0" }}
							onClick={async () => {
								await auth.signOut();
								router.push("/auth");
							}}
						>
							Sign out
						</button>
					</p>
				</div>

				{/* Toast notification */}
				{toast && (
					<div
						className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl text-sm font-medium shadow-xl flex items-center gap-2 z-50 animate-fade-in"
						style={{
							background: toast.type === "ok"
								? "rgba(16,185,129,0.15)"
								: "rgba(239,68,68,0.15)",
							border: `1px solid ${toast.type === "ok" ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)"}`,
							color: toast.type === "ok" ? "#10b981" : "#ef4444",
							backdropFilter: "blur(12px)",
						}}
						role="alert"
					>
						{toast.type === "ok" ? (
							<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
								<path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
							</svg>
						) : (
							<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
								<circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
								<path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
							</svg>
						)}
						{toast.msg}
					</div>
				)}
			</div>
		</>
	);
}
