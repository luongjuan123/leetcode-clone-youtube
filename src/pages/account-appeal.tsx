import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { auth, firestore } from "@/firebase/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import Link from "next/link";

interface ModState {
	status: string;
	reason?: string;
	duration?: string;
	deleteAfter?: number;
	appealDeadline?: number;
	deleteTimerPaused?: boolean;
	email?: string;
	caseId?: string;
}

const AccountAppealPage: React.FC = () => {
	const [user, loadingAuth] = useAuthState(auth);
	const router = useRouter();
	const { refId } = router.query;

	const [loadingData, setLoadingData] = useState(true);
	const [modState, setModState] = useState<ModState | null>(null);
	
	// Appeal form states
	const [appealMessage, setAppealMessage] = useState("");
	const [appealRefId, setAppealRefId] = useState("");
	const [appealFiles, setAppealFiles] = useState<{ name: string; base64: string }[]>([]);
	const [acceptTerms1, setAcceptTerms1] = useState(false);
	const [acceptTerms2, setAcceptTerms2] = useState(false);
	
	const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [downloading, setDownloading] = useState(false);

	useEffect(() => {
		if (refId) {
			setAppealRefId(String(refId).toUpperCase());
		}
	}, [refId]);

	useEffect(() => {
		if (loadingAuth) return;

		const fetchStatus = async () => {
			try {
				if (user) {
					// Authenticated user path
					const modRef = doc(firestore, "userModeration", user.uid);
					const modSnap = await getDoc(modRef);

					if (modSnap.exists()) {
						const data = modSnap.data() as ModState;
						setModState(data);
						if (data.caseId) {
							setAppealRefId(data.caseId);
						} else {
							setAppealRefId(user.uid.substring(0, 8).toUpperCase());
						}
					} else {
						// No moderation doc, check user doc directly
						const userRef = doc(firestore, "users", user.uid);
						const userSnap = await getDoc(userRef);
						const userData = userSnap.data() || {};
						if (userData.status === "PENDING_DELETION") {
							setModState({
								status: "PENDING_DELETION",
								deleteAfter: userData.deleteAfter,
								appealDeadline: userData.appealDeadline,
								caseId: userData.caseId
							});
							if (userData.caseId) {
								setAppealRefId(userData.caseId);
							} else {
								setAppealRefId(user.uid.substring(0, 8).toUpperCase());
							}
						} else {
							setModState({ status: "ACTIVE" });
						}
					}
				} else if (refId) {
					// Unauthenticated path: lookup moderation status by referenceId
					const res = await fetch(`/api/moderation/status-by-ref?refId=${refId}`);
					if (res.ok) {
						const data = await res.json();
						setModState({
							status: data.status,
							reason: data.reason,
							duration: data.duration,
							deleteAfter: data.deleteAfter,
							appealDeadline: data.appealDeadline,
							deleteTimerPaused: data.deleteTimerPaused,
							email: data.email,
							caseId: data.caseId
						});
						if (data.caseId) {
							setAppealRefId(data.caseId);
						}
					} else {
						setModState({ status: "UNKNOWN" });
					}
				} else {
					// No user and no refId: redirect to login
					router.push("/auth");
				}
			} catch (err) {
				console.error("Failed to load account status:", err);
				if (!user && !refId) {
					router.push("/auth");
				}
			} finally {
				setLoadingData(false);
			}
		};

		fetchStatus();
	}, [user, loadingAuth, refId, router]);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files) return;

		if (appealFiles.length + files.length > 3) {
			setFeedback({ type: "error", text: "You can upload a maximum of 3 files." });
			return;
		}

		Array.from(files).forEach((file) => {
			if (file.size > 5 * 1024 * 1024) {
				setFeedback({ type: "error", text: `${file.name} exceeds 5MB size limit.` });
				return;
			}

			const reader = new FileReader();
			reader.onload = (ev) => {
				const base64 = ev.target?.result as string;
				setAppealFiles((prev) => [...prev, { name: file.name, base64 }]);
			};
			reader.readAsDataURL(file);
		});
	};

	const handleAppealSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (submitting) return;

		if (!appealRefId.trim()) {
			setFeedback({ type: "error", text: "Reference ID is required." });
			return;
		}
		if (appealMessage.length < 100) {
			setFeedback({ type: "error", text: "Appeal message must be at least 100 characters." });
			return;
		}
		if (!acceptTerms1 || !acceptTerms2) {
			setFeedback({ type: "error", text: "You must accept all terms to submit an appeal." });
			return;
		}

		setSubmitting(true);
		setFeedback(null);

		try {
			const idToken = user ? await user.getIdToken(true) : null;
			const headers: Record<string, string> = {
				"Content-Type": "application/json"
			};
			if (idToken) {
				headers["Authorization"] = `Bearer ${idToken}`;
			}

			const res = await fetch("/api/moderation/appeal", {
				method: "POST",
				headers,
				body: JSON.stringify({
					referenceId: appealRefId,
					appealMessage,
					files: appealFiles,
					acceptTerms: true
				})
			});

			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error?.message || data.message || "Failed to submit appeal.");
			}

			setFeedback({ type: "success", text: "Appeal submitted successfully. Page will reload..." });
			setTimeout(() => {
				window.location.reload();
			}, 2500);
		} catch (err: any) {
			setFeedback({ type: "error", text: err.message });
		} finally {
			setSubmitting(false);
		}
	};

	const handleAcceptDeletion = async () => {
		if (!user) return;
		if (!window.confirm("Are you absolutely sure you want to permanently delete your account immediately? This action is irreversible.")) {
			return;
		}
		
		setSubmitting(true);
		try {
			const idToken = await user.getIdToken(true);
			const res = await fetch("/api/moderation/self-delete", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${idToken}`
				}
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error?.message || data.message || "Failed to complete deletion.");
			}

			alert("Your account has been deleted permanently.");
			await auth.signOut();
			router.push("/");
		} catch (err: any) {
			alert("Deletion failed: " + err.message);
		} finally {
			setSubmitting(false);
		}
	};

	const handleDownloadData = async () => {
		if (!user) return;
		setDownloading(true);

		try {
			const dbFirestore = firestore;
			const userDoc = await getDoc(doc(dbFirestore, "users", user.uid));
			const userData = userDoc.exists() ? userDoc.data() : {};

			// Query user submissions
			const subsQuery = query(collection(dbFirestore, "submissions"), where("uid", "==", user.uid));
			const subsSnap = await getDocs(subsQuery);
			const submissions = subsSnap.docs.map(d => d.data());

			const exportBundle = {
				exportedAt: new Date().toISOString(),
				profile: {
					uid: user.uid,
					email: user.email,
					displayName: userData.displayName || "",
					username: userData.username || "",
					school: userData.school || "",
					studentId: userData.studentId || "",
					class: userData.class || "",
					faculty: userData.faculty || "",
					bio: userData.bio || "",
					createdAt: userData.createdAt || null
				},
				solvedProblems: userData.solvedProblems || [],
				submissions
			};

			const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportBundle, null, 2));
			const downloadAnchor = document.createElement("a");
			downloadAnchor.setAttribute("href", dataStr);
			downloadAnchor.setAttribute("download", `beastcode-data-export-${user.uid.substring(0, 8)}.json`);
			document.body.appendChild(downloadAnchor);
			downloadAnchor.click();
			downloadAnchor.remove();
		} catch (err) {
			alert("Failed to export data. Please try again.");
		} finally {
			setDownloading(false);
		}
	};

	if (loadingAuth || loadingData) {
		return (
			<div className="bg-dark-layer-2 min-h-screen flex items-center justify-center text-white">
				<div className="text-center space-y-4">
					<div className="w-12 h-12 border-4 border-brand-orange border-t-transparent rounded-full animate-spin mx-auto"></div>
					<p className="text-gray-400 text-sm animate-pulse">Verifying security parameters...</p>
				</div>
			</div>
		);
	}

	if (modState?.status === "ACTIVE") {
		return (
			<div className="bg-dark-layer-2 min-h-screen flex items-center justify-center text-white px-6">
				<div className="max-w-md w-full bg-dark-layer-1 border border-gray-850 rounded-2xl p-8 text-center space-y-4 shadow-xl">
					<span className="text-4xl">✅</span>
					<h3 className="text-xl font-bold">Account is Active</h3>
					<p className="text-sm text-gray-400">
						Your account is in good standing. You are being redirected to the home page.
					</p>
					<button
						onClick={() => router.push("/")}
						className="w-full bg-brand-orange hover:bg-brand-orange-s text-white py-2 rounded-lg font-bold transition"
					>
						Go to Home
					</button>
				</div>
			</div>
		);
	}

	if (modState?.status === "UNKNOWN") {
		return (
			<div className="bg-dark-layer-2 min-h-screen flex items-center justify-center text-white px-6">
				<div className="max-w-md w-full bg-dark-layer-1 border border-red-950 rounded-2xl p-8 text-center space-y-4 shadow-xl">
					<span className="text-4xl">⚠️</span>
					<h3 className="text-xl font-bold text-red-400">Case Not Found</h3>
					<p className="text-sm text-gray-400">
						No active moderation action or scheduled deletion was found matching this Reference ID. Please check the URL link in your email or contact support.
					</p>
					<button
						onClick={() => router.push("/")}
						className="w-full bg-dark-fill-3 hover:bg-dark-fill-2 text-white py-2 rounded-lg font-bold transition"
					>
						Go to Home
					</button>
				</div>
			</div>
		);
	}

	const isAppealed = modState?.status === "APPEALED";
	const isDeletedPending = modState?.status === "PENDING_DELETION";
	const isBanned = modState?.status === "BANNED";

	return (
		<main className="bg-dark-layer-2 min-h-screen text-white flex items-center justify-center p-6">
			<div className="max-w-2xl w-full bg-dark-layer-1 border border-gray-850 rounded-2xl shadow-2xl overflow-hidden">
				{/* Top Warning Banner */}
				<div className="bg-red-950/30 border-b border-red-900/30 px-8 py-6 flex items-center gap-4">
					<span className="text-3xl shrink-0">🛡️</span>
					<div>
						<h1 className="text-xl font-bold">Trust & Safety Center</h1>
						<p className="text-xs text-red-400 mt-1 font-semibold uppercase tracking-wider">
							{isAppealed ? "Appeal Under Review" : isDeletedPending ? "Account Scheduled for Deletion" : "Account Suspended"}
						</p>
					</div>
				</div>

				<div className="p-8 space-y-6">
					{/* Status Details */}
					<div className="bg-dark-fill-3 border border-gray-850 rounded-xl p-5 space-y-3">
						<div className="grid grid-cols-2 gap-4 text-xs">
							{user && (
								<div>
									<span className="text-gray-500 block uppercase tracking-wider font-bold">Account UID</span>
									<span className="font-mono text-gray-300">{user.uid}</span>
								</div>
							)}
							<div className={!user ? "col-span-2" : ""}>
								<span className="text-gray-500 block uppercase tracking-wider font-bold">Appeal Ref ID</span>
								<span className="font-mono text-brand-orange font-bold">
									{appealRefId}
								</span>
							</div>
							{modState?.reason && (
								<div className="col-span-2">
									<span className="text-gray-500 block uppercase tracking-wider font-bold">Reason for Action</span>
									<p className="text-gray-300 mt-1 text-sm bg-dark-layer-2 p-3 rounded border border-gray-850">
										{modState.reason}
									</p>
								</div>
							)}
							{isDeletedPending && modState?.deleteAfter && (
								<div className="col-span-2 flex justify-between bg-red-950/10 border border-red-900/20 p-3 rounded text-sm">
									<span className="text-red-400 font-semibold">Scheduled Deletion:</span>
									<span className="font-bold text-white">
										{new Date(modState.deleteAfter).toLocaleDateString()}
									</span>
								</div>
							)}
						</div>
					</div>

					{isAppealed ? (
						<div className="text-center py-6 space-y-4">
							<span className="text-4xl animate-pulse inline-block">⏳</span>
							<h3 className="text-lg font-bold text-gray-200">Appeal Under Investigation</h3>
							<p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
								An appeal has been submitted for this case. The deletion timer remains paused while our team reviews the details. We will notify you via email at <strong className="text-white">{user?.email || modState?.email || "your registered email"}</strong> once a decision has been reached.
							</p>
						</div>
					) : (
						<form onSubmit={handleAppealSubmit} className="space-y-4">
							<h3 className="text-base font-bold text-gray-200 border-b border-gray-850 pb-2">
								Submit a Request for Reinstatement
							</h3>

							<div className="grid grid-cols-2 gap-4">
								<div className="col-span-2">
									<label className="block text-xs uppercase tracking-wider text-gray-400 font-bold mb-2">
										Reference Case ID <span className="text-red-500">*</span>
									</label>
									{(user || refId || appealRefId) ? (
										<div className="w-full bg-dark-layer-2 border border-gray-850 rounded-lg p-3 font-mono text-brand-orange uppercase text-sm font-semibold select-all">
											{appealRefId || "Resolving ID..."}
										</div>
									) : (
										<input
											value={appealRefId}
											onChange={(e) => setAppealRefId(e.target.value)}
											required
											type="text"
											className="w-full bg-dark-layer-2 border border-gray-850 rounded-lg p-2.5 outline-none font-mono text-brand-orange uppercase text-sm"
											placeholder="e.g. CASE-YYYY-XXXXXXXX"
										/>
									)}
								</div>

								<div className="col-span-2">
									<div className="flex justify-between items-center mb-2">
										<label className="block text-xs uppercase tracking-wider text-gray-400 font-bold">
											Appeal Statement <span className="text-red-500">*</span>
										</label>
										<span className={`text-[10px] ${appealMessage.length < 100 ? "text-yellow-500" : "text-gray-500"}`}>
											{appealMessage.length} / 5000 chars (min 100)
										</span>
									</div>
									<textarea
										value={appealMessage}
										onChange={(e) => setAppealMessage(e.target.value)}
										required
										minLength={100}
										maxLength={5000}
										rows={5}
										placeholder="Explain clearly why the decision should be reversed. Provide any necessary context or explanations of what occurred..."
										className="w-full bg-dark-layer-2 border border-gray-850 text-white rounded-lg p-3 outline-none text-sm placeholder:text-gray-600 resize-none"
									/>
								</div>

								<div className="col-span-2">
									<label className="block text-xs uppercase tracking-wider text-gray-400 font-bold mb-2">
										Attach Supporting Evidence (Optional)
									</label>
									<input
										type="file"
										multiple
										accept="image/*,.pdf,.txt,.zip"
										onChange={handleFileChange}
										className="w-full bg-dark-layer-2 border border-gray-850 text-gray-400 text-xs rounded-lg file:bg-dark-fill-3 file:text-white file:border-0 file:py-2 file:px-4 file:mr-4 file:hover:bg-dark-fill-2 cursor-pointer"
									/>
									<p className="text-[10px] text-gray-500 mt-1">Images, PDF, TXT, or ZIP up to 5MB total.</p>

									{appealFiles.length > 0 && (
										<div className="mt-2 space-y-1">
											{appealFiles.map((f, i) => (
												<div key={i} className="flex justify-between bg-dark-fill-3 px-3 py-1.5 rounded border border-gray-850 text-xs">
													<span className="font-mono truncate max-w-[300px]">{f.name}</span>
													<button
														type="button"
														onClick={() => setAppealFiles(prev => prev.filter((_, idx) => idx !== i))}
														className="text-red-400 hover:text-red-500 font-bold ml-2"
													>
														✕
													</button>
												</div>
											))}
										</div>
									)}
								</div>

								<div className="col-span-2 space-y-2">
									<label className="flex gap-2.5 items-start cursor-pointer select-none">
										<input
											type="checkbox"
											checked={acceptTerms1}
											onChange={(e) => setAcceptTerms1(e.target.checked)}
											className="mt-0.5 accent-brand-orange"
										/>
										<span className="text-[11px] text-gray-400 leading-tight">
											I agree that all statements, documents, and evidence submitted in this appeal are accurate, truthful, and provided in good faith.
										</span>
									</label>
									<label className="flex gap-2.5 items-start cursor-pointer select-none">
										<input
											type="checkbox"
											checked={acceptTerms2}
											onChange={(e) => setAcceptTerms2(e.target.checked)}
											className="mt-0.5 accent-brand-orange"
										/>
										<span className="text-[11px] text-gray-400 leading-tight">
											I understand that the review decision is final and that submitting false or misleading information will result in immediate permanent termination of all platform privileges.
										</span>
									</label>
								</div>
							</div>

							{feedback && (
								<div className={`p-3 rounded-lg text-xs font-semibold ${
									feedback.type === "success" ? "bg-green-950/40 text-green-400 border border-green-900/35" : "bg-red-950/40 text-red-400 border border-red-900/35"
								}`}>
									{feedback.text}
								</div>
							)}

							<button
								type="submit"
								disabled={submitting}
								className="w-full bg-brand-orange hover:bg-brand-orange-s text-white font-bold py-2.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
							>
								{submitting ? "Submitting Appeal..." : "Submit Appeal"}
							</button>
						</form>
					)}

					{/* Standard Compliance and Lifecycle Actions */}
					<div className="border-t border-gray-850 pt-6 flex flex-wrap justify-between items-center gap-4">
						<div className="flex gap-3">
							<button
								onClick={handleDownloadData}
								disabled={downloading || !user}
								className="px-4 py-2 bg-dark-fill-3 hover:bg-dark-fill-2 border border-gray-850 text-xs font-bold rounded-lg transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
								title={!user ? "Please login to download your data" : ""}
							>
								📥 {downloading ? "Exporting..." : "Download My Data"}
							</button>
							{isDeletedPending && (
								<button
									onClick={handleAcceptDeletion}
									disabled={submitting || !user}
									className="px-4 py-2 bg-red-950/30 hover:bg-red-900/30 border border-red-900/30 text-red-400 text-xs font-bold rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
									title={!user ? "Please login to accept deletion" : ""}
								>
									Accept Deletion
								</button>
							)}
						</div>

						{user ? (
							<button
								onClick={async () => {
									await auth.signOut();
									router.push("/");
								}}
								className="px-4 py-2 bg-dark-layer-2 hover:bg-dark-fill-3 border border-gray-850 text-xs font-bold rounded-lg transition"
							>
								Logout Session
							</button>
						) : (
							<Link
								href="/auth"
								className="px-4 py-2 bg-brand-orange hover:bg-brand-orange-s text-black text-xs font-bold rounded-lg transition"
							>
								Log In to Dashboard
							</Link>
						)}
					</div>
				</div>
			</div>
		</main>
	);
};

export default AccountAppealPage;
