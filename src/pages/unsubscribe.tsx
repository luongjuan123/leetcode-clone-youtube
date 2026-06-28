import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Topbar from "@/components/Topbar/Topbar";
import { FaEnvelopeOpen, FaCheckCircle, FaExclamationTriangle, FaBellSlash } from "react-icons/fa";

export default function UnsubscribePage() {
	const router = useRouter();
	const { email: queryEmail, type: queryType } = router.query;
	const [email, setEmail] = useState("");
	const [preferenceType, setPreferenceType] = useState("");
	const [unsubscribedAll, setUnsubscribedAll] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [successMessage, setSuccessMessage] = useState("");

	useEffect(() => {
		if (queryEmail) {
			setEmail(String(queryEmail));
		}
		if (queryType) {
			setPreferenceType(String(queryType));
		}
	}, [queryEmail, queryType]);

	const handleUnsubscribe = async (all: boolean) => {
		if (!email || !email.includes("@")) {
			setError("Please provide a valid email address.");
			return;
		}

		setLoading(true);
		setError("");
		setSuccessMessage("");

		try {
			const res = await fetch("/api/unsubscribe", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email,
					type: all ? "all" : preferenceType || "all",
				}),
			});

			const data = await res.json();
			if (data.success) {
				setSuccessMessage(data.message);
				if (all) {
					setUnsubscribedAll(true);
				}
			} else {
				setError(data.message || "Failed to update notification settings.");
			}
		} catch (err: any) {
			setError("An error occurred. Please try again later.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<main className='bg-dark-layer-2 min-h-screen pb-16'>
			<Topbar />
			<div className='max-w-[500px] mx-auto w-full mt-16 px-4 p-2'>
				<div
					className='rounded-2xl p-8 space-y-6 text-center relative'
					style={{
						background: "var(--bg-dark-layer-1)",
						border: "1px solid var(--border-subtle)",
						boxShadow: "var(--shadow-lg)",
					}}
				>
					{/* Glowing top line */}
					<div
						className='absolute top-0 left-0 w-full h-[3px]'
						style={{
							background: "linear-gradient(90deg, var(--brand-orange) 0%, var(--border-accent) 100%)",
						}}
					/>

					<div className='flex justify-center'>
						<div
							className='w-16 h-16 rounded-full flex items-center justify-center'
							style={{ background: "rgba(249, 115, 22, 0.08)", border: "1px solid rgba(249, 115, 22, 0.2)" }}
						>
							<FaBellSlash className='text-brand-orange text-2xl animate-pulse' />
						</div>
					</div>

					<div className='space-y-2'>
						<h1 className='text-xl font-extrabold tracking-tight' style={{ color: "var(--text-primary)" }}>
							Notification Opt-Out
						</h1>
						<p className='text-xs font-medium' style={{ color: "var(--text-muted)" }}>
							Manage your competitive mailing preferences for BeastCode.
						</p>
					</div>

					{successMessage ? (
						<div className='space-y-6 pt-4'>
							<div
								className='flex items-center gap-3 p-4 rounded-xl text-left border'
								style={{ background: "rgba(16, 185, 129, 0.04)", borderColor: "rgba(16, 185, 129, 0.15)" }}
							>
								<FaCheckCircle className='text-green-400 text-lg shrink-0' />
								<p className='text-xs text-green-300 font-medium leading-relaxed'>{successMessage}</p>
							</div>
							<button
								onClick={() => router.push("/")}
								className='w-full bg-brand-orange hover:bg-brand-orange-s text-white py-3 rounded-xl font-bold transition shadow-lg text-sm'
							>
								Back to BeastCode Home
							</button>
						</div>
					) : (
						<div className='space-y-6 pt-2 text-left'>
							<div className='space-y-1.5'>
								<label className='text-xs font-bold' style={{ color: "var(--text-secondary)" }}>
									Email Address
								</label>
								<input
									type='email'
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder='developer@domain.com'
									disabled={!!queryEmail}
									className='outline-none text-xs rounded-xl focus:ring-1 focus:ring-brand-orange focus:border-brand-orange block w-full p-3.5 font-medium'
									style={{
										background: "var(--bg-dark-fill-3)",
										border: "1px solid var(--border-subtle)",
										color: "var(--text-primary)",
									}}
								/>
							</div>

							{preferenceType && (
								<div
									className='p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium'
									style={{ background: "var(--bg-dark-fill-3)", borderColor: "var(--border-subtle)" }}
								>
									<span style={{ color: "var(--text-secondary)" }}>
										Selected Category:
									</span>
									<span className='capitalize text-brand-orange font-bold font-mono bg-brand-orange/5 px-2.5 py-0.5 rounded-md border border-brand-orange/15'>
										{preferenceType}
									</span>
								</div>
							)}

							{error && (
								<div
									className='flex items-center gap-3 p-3.5 rounded-xl border text-xs font-medium'
									style={{ background: "rgba(239, 68, 68, 0.04)", borderColor: "rgba(239, 68, 68, 0.15)" }}
								>
									<FaExclamationTriangle className='text-red-400 shrink-0 text-sm' />
									<span className='text-red-350 leading-snug'>{error}</span>
								</div>
							)}

							<div className='flex flex-col gap-3 pt-2'>
								{preferenceType && preferenceType !== "all" && (
									<button
										onClick={() => handleUnsubscribe(false)}
										disabled={loading}
										className='w-full text-white py-3.5 rounded-xl font-bold transition shadow-md text-xs border border-brand-orange/20 hover:bg-brand-orange/5 disabled:opacity-50'
										style={{ background: "var(--bg-dark-fill-3)" }}
									>
										{loading ? "Processing..." : `Unsubscribe from ${preferenceType} notifications only`}
									</button>
								)}
								<button
									onClick={() => handleUnsubscribe(true)}
									disabled={loading}
									className='w-full bg-brand-orange hover:bg-brand-orange-s text-white py-3.5 rounded-xl font-bold transition shadow-lg text-xs disabled:opacity-50'
								>
									{loading ? "Processing..." : "Unsubscribe from all communications"}
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</main>
	);
}
