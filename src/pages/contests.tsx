import React, { useEffect, useState } from "react";
import Topbar from "@/components/Topbar/Topbar";
import BeastCodePagination from "@/components/UI/BeastCodePagination";
import { getServerTime, getContestStatus, syncContestStatus } from "@/utils/contestStatusService";
import useHasMounted from "@/hooks/useHasMounted";
import { getFriendlyErrorMessage } from "@/utils/errorFilter";
import { auth, firestore } from "@/firebase/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import {
	collection, getDocs, doc, setDoc, getDoc, query, where, orderBy, updateDoc, increment
} from "firebase/firestore";
import Link from "next/link";
import { useSetRecoilState } from "recoil";
import { authModalState } from "@/atoms/authModalAtom";
import {
	FaGlobe, FaLock, FaCalendarAlt, FaHourglassHalf, FaHistory,
	FaCheckCircle, FaUserCheck, FaTrophy, FaChevronRight,
	FaSpinner, FaArrowRight, FaUniversity
} from "react-icons/fa";

interface ContestItem {
	id: string;
	title: string;
	description: string;
	banner: string;
	startTime: number;
	endTime: number;
	duration: number;
	visibility: string;
	securityLevel: string;
	status: string;
	virtualEnabled: boolean;
	registrationEnabled: boolean;
	university?: string;
	leaderboardFreeze: number;
}

export default function ContestsPage() {
	const hasMounted = useHasMounted();
	const [user] = useAuthState(auth);
	const setAuthModal = useSetRecoilState(authModalState);

	const [contests, setContests] = useState<ContestItem[]>([]);
	const [userRegistrations, setUserRegistrations] = useState<Record<string, boolean>>({});
	const [loading, setLoading] = useState(true);
	const [actionId, setActionId] = useState<string | null>(null);

	// Password modal state
	const [showPassModal, setShowPassModal] = useState<ContestItem | null>(null);
	const [passInput, setPassInput] = useState("");

	const [statusRibbon, setStatusRibbon] = useState<{ type: "success" | "error"; message: string } | null>(null);
	const [pastPage, setPastPage] = useState(1);

	const triggerRibbon = (type: "success" | "error", message: string) => {
		setStatusRibbon({ type, message });
		setTimeout(() => setStatusRibbon(null), 4000);
	};

	const fetchContests = async () => {
		setLoading(true);
		try {
			// Get contests (exclude draft unless admin. For now, get all where status != draft)
			const q = query(collection(firestore, "contests"), orderBy("createdAt", "desc"));
			const querySnapshot = await getDocs(q);
			const list: ContestItem[] = [];
			const now = getServerTime();
			querySnapshot.forEach((doc) => {
				const data = doc.data();
				// Hide draft contests for non-logged-in/non-admin users
				if (data.status === "draft") return;

				const contestData = {
					id: doc.id,
					startTime: data.startTime || 0,
					endTime: data.endTime || 0,
					leaderboardFreeze: data.leaderboardFreeze || 0,
					status: data.status || "draft",
					registrationEnabled: data.registrationEnabled !== false,
				};

				const computedStatus = getContestStatus(contestData, now);

				// Sync to database in background if status drifted
				if (data.status !== computedStatus) {
					syncContestStatus(doc.id, data.status || "draft", computedStatus);
				}

				list.push({
					id: doc.id,
					title: data.title || doc.id,
					description: data.description || "",
					banner: data.banner || "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=800&auto=format&fit=crop&q=60",
					startTime: contestData.startTime,
					endTime: contestData.endTime,
					duration: data.duration || 120,
					visibility: data.visibility || "public",
					securityLevel: data.securityLevel || "standard",
					status: computedStatus,
					virtualEnabled: !!data.virtualEnabled,
					registrationEnabled: contestData.registrationEnabled,
					university: data.university || "",
					leaderboardFreeze: contestData.leaderboardFreeze,
				});
			});
			setContests(list);

			// Fetch user registrations if logged in
			if (user) {
				const regSnap = await getDocs(
					query(collection(firestore, "contest_participants"), where("uid", "==", user.uid))
				);
				const regs: Record<string, boolean> = {};
				regSnap.forEach((doc) => {
					const data = doc.data();
					regs[data.contestId] = true;
				});
				setUserRegistrations(regs);
			}
		} catch (err) {
			console.error("Error loading contests:", err);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchContests();
	}, [user]);

	// Auto-transition contests dynamically in-memory every 5 seconds
	useEffect(() => {
		if (contests.length === 0) return;

		const interval = setInterval(() => {
			const now = getServerTime();
			let hasChanges = false;
			const updated = contests.map((c) => {
				const contestData = {
					id: c.id,
					startTime: c.startTime,
					endTime: c.endTime,
					leaderboardFreeze: c.leaderboardFreeze || 0,
					status: c.status,
					registrationEnabled: c.registrationEnabled,
				};
				const computed = getContestStatus(contestData, now);
				if (computed !== c.status) {
					hasChanges = true;
					syncContestStatus(c.id, c.status, computed);
					return { ...c, status: computed };
				}
				return c;
			});

			if (hasChanges) {
				setContests(updated);
			}
		}, 5000);

		return () => clearInterval(interval);
	}, [contests]);

	// Register logic
	const handleRegister = async (contest: ContestItem) => {
		if (!user) {
			setAuthModal({ isOpen: true, type: "login" });
			return;
		}

		setActionId(contest.id);

		try {
			// 1. Password check if password visibility
			if (contest.visibility === "password") {
				setShowPassModal(contest);
				setPassInput("");
				setActionId(null);
				return;
			}

			// 2. University email domain check
			if (contest.visibility === "university" && contest.university) {
				const userEmail = user.email || "";
				if (!userEmail.endsWith(`@${contest.university}`) && !userEmail.endsWith(`.${contest.university}`)) {
					triggerRibbon("error", `This contest is restricted to users with a domain of "${contest.university}".`);
					setActionId(null);
					return;
				}
			}

			await executeRegister(contest.id);
		} catch (err: any) {
			console.error("Registration error:", err);
			triggerRibbon("error", getFriendlyErrorMessage(err, "Registration failed. Please try again."));
			setActionId(null);
		}
	};

	const handlePasswordSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!showPassModal || !user) return;

		const targetContest = showPassModal;
		setShowPassModal(null);
		setActionId(targetContest.id);

		try {
			// Fetch the password to verify
			const contestDoc = await getDoc(doc(firestore, "contests", targetContest.id));
			const actualPassword = contestDoc.data()?.password;

			if (passInput.trim() !== actualPassword) {
				triggerRibbon("error", "Incorrect password.");
				setActionId(null);
				return;
			}

			await executeRegister(targetContest.id);
		} catch (err: any) {
			console.error("Password verify error:", err);
			triggerRibbon("error", "Verification failed.");
			setActionId(null);
		}
	};

	const executeRegister = async (contestId: string) => {
		if (!user) return;
		try {
			const regId = `${contestId}_${user.uid}`;
			const regRef = doc(firestore, "contest_participants", regId);
			
			await setDoc(regRef, {
				id: regId,
				contestId,
				uid: user.uid,
				username: user.email?.split("@")[0] || "user",
				displayName: user.displayName || user.email?.split("@")[0] || "User",
				registeredAt: Date.now(),
				status: "registered",
				isVirtual: false
			});

			// Update stats counter
			const statsRef = doc(firestore, "contest_statistics", contestId);
			const statsDoc = await getDoc(statsRef);
			if (statsDoc.exists()) {
				await updateDoc(statsRef, { participantsCount: increment(1) });
			}

			setUserRegistrations(prev => ({ ...prev, [contestId]: true }));
			triggerRibbon("success", "Successfully registered for the contest!");

			// Send registration confirmation email
			try {
				const userToken = await user.getIdToken();
				await fetch("/api/send-registration-confirmation-email", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${userToken}`
					},
					body: JSON.stringify({
						contestId
					})
				});
			} catch (emailErr) {
				console.error("Failed to send registration confirmation email:", emailErr);
			}
		} catch (e: any) {
			triggerRibbon("error", getFriendlyErrorMessage(e, "Failed to register. Please try again."));
		} finally {
			setActionId(null);
		}
	};

	// Start Virtual Participation
	const handleStartVirtual = async (contestId: string) => {
		if (!user) {
			setAuthModal({ isOpen: true, type: "login" });
			return;
		}

		setActionId(contestId);
		try {
			const regId = `${contestId}_${user.uid}`;
			const regRef = doc(firestore, "contest_participants", regId);

			const existingSnap = await getDoc(regRef);
			if (existingSnap.exists() && existingSnap.data().status === "active") {
				// Redirect directly if already active virtual participant
				window.location.href = `/contests/${contestId}`;
				return;
			}

			const now = Date.now();
			await setDoc(regRef, {
				id: regId,
				contestId,
				uid: user.uid,
				username: user.email?.split("@")[0] || "user",
				displayName: user.displayName || user.email?.split("@")[0] || "User",
				registeredAt: now,
				joinedAt: now,
				status: "active",
				isVirtual: true,
				virtualStartTime: now
			});

			triggerRibbon("success", "Virtual participation session started!");
			window.location.href = `/contests/${contestId}`;
		} catch (e: any) {
			console.error("Virtual join error:", e);
			triggerRibbon("error", "Failed to start virtual session.");
			setActionId(null);
		}
	};

	if (!hasMounted) return null;

	const running = contests.filter((c) => c.status === "running" || c.status === "frozen");
	const upcoming = contests.filter((c) => c.status === "scheduled" || c.status === "registration_open");
	const past = contests.filter((c) => c.status === "ended" || c.status === "archived");

	const pastPageSize = 20;
	const paginatedPast = past.slice((pastPage - 1) * pastPageSize, pastPage * pastPageSize);
	const totalPastPages = Math.ceil(past.length / pastPageSize);

	return (
		<main className='bg-dark-layer-2 min-h-screen pb-16 font-sans text-white'>
			<Topbar />

			{/* Status Alert Banner */}
			{statusRibbon && (
				<div className={`fixed top-20 right-6 z-50 p-4 rounded-xl border shadow-xl text-sm font-semibold transition-all duration-300 ${
					statusRibbon.type === "success"
						? "bg-emerald-950/90 text-emerald-400 border-emerald-800"
						: "bg-rose-950/90 text-rose-400 border-rose-800"
				}`}>
					{statusRibbon.message}
				</div>
			)}

			<div className='max-w-[1000px] mx-auto px-4 pt-8'>
				<div className='mb-8'>
					<h1 className='text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-brand-orange to-yellow-500'>
						BeastCode Contests
					</h1>
					<p className='text-sm text-gray-400 mt-1'>
						Compete in real-time, test your algorithms, and build your community profile.
					</p>
				</div>

				{loading ? (
					<div className='flex flex-col justify-center items-center py-20 gap-4'>
						<div className='w-12 h-12 border-4 border-brand-orange border-t-transparent rounded-full animate-spin'></div>
						<div className='text-gray-400'>Loading Arena...</div>
					</div>
				) : (
					<div className='space-y-10'>
						
						{/* 1. RUNNING SECTION */}
						{running.length > 0 && (
							<div>
								<h2 className='text-lg font-bold mb-4 flex items-center gap-2 text-shadow-glow' style={{ color: "var(--brand-orange)" }}>
									<span className='w-2 h-2 rounded-full bg-emerald-500 animate-ping' />
									Running Contests
								</h2>
								<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
									{running.map((c) => {
										const isReg = userRegistrations[c.id];
										return (
											<div key={c.id} className='rounded-2xl border overflow-hidden transition-all duration-300 hover:-translate-y-0.5' style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
												<div className='h-28 bg-cover bg-center relative' style={{ backgroundImage: `url(${c.banner})` }}>
													<div className='absolute inset-0 bg-black/40 backdrop-blur-[1px]' />
													<div className='absolute bottom-3 left-4 right-4'>
														<span className='text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-600 text-white rounded'>
															{c.status === "frozen" ? "Frozen" : "Active"}
														</span>
														<h3 className='text-lg font-bold text-white mt-1 leading-tight'>{c.title}</h3>
													</div>
												</div>
												<div className='p-5 space-y-4'>
													<p className='text-xs text-gray-400 line-clamp-2'>{c.description}</p>
													<div className='flex items-center justify-between text-xs font-semibold' style={{ color: "var(--text-secondary)" }}>
														<span className='flex items-center gap-1.5'><FaHourglassHalf className='text-brand-orange' /> {c.duration} mins</span>
														<span className='flex items-center gap-1.5 capitalize'>
															{c.visibility === "public" ? <FaGlobe className='text-emerald-400' /> : <FaLock className='text-yellow-500' />}
															{c.visibility}
														</span>
													</div>
													
													{/* Action button */}
													{isReg || !c.registrationEnabled ? (
														<Link
															href={`/contests/${c.id}`}
															className='w-full py-2.5 rounded-xl font-bold text-sm bg-brand-orange hover:bg-brand-orange-s text-bg-base transition flex items-center justify-center gap-1.5'
															style={{ color: "var(--bg-base)" }}
														>
															Enter Arena <FaArrowRight size={10} />
														</Link>
													) : (
														<button
															onClick={() => handleRegister(c)}
															disabled={actionId === c.id}
															className='w-full py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition border flex items-center justify-center gap-1.5'
															style={{ background: "var(--brand-glow)", border: "1px solid var(--border-accent)", color: "var(--brand-orange)" }}
														>
															{actionId === c.id ? <FaSpinner className='animate-spin' /> : "Register & Join"}
														</button>
													)}
												</div>
											</div>
										);
									})}
								</div>
							</div>
						)}

						{/* 2. UPCOMING SECTION */}
						<div>
							<h2 className='text-lg font-bold mb-4 flex items-center gap-2' style={{ color: "var(--text-primary)" }}>
								<FaCalendarAlt size={16} className='text-blue-400' />
								Upcoming Scheduled Contests
							</h2>
							{upcoming.length === 0 ? (
								<p className='text-sm text-gray-500 italic py-4 pl-2 border-l border-border-subtle'>No scheduled contests at this time. Stay tuned!</p>
							) : (
								<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
									{upcoming.map((c) => {
										const isReg = userRegistrations[c.id];
										return (
											<div key={c.id} className='rounded-2xl border overflow-hidden transition-all duration-300' style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
												<div className='h-24 bg-cover bg-center relative' style={{ backgroundImage: `url(${c.banner})` }}>
													<div className='absolute inset-0 bg-black/40' />
													<div className='absolute bottom-3 left-4 right-4'>
														<h3 className='text-base font-bold text-white leading-tight'>{c.title}</h3>
													</div>
												</div>
												<div className='p-5 space-y-4'>
													<p className='text-xs text-gray-400 line-clamp-2'>{c.description}</p>
													
													<div className='space-y-1.5 text-xs' style={{ color: "var(--text-secondary)" }}>
														<p><span className='text-gray-500 font-semibold'>Starts:</span> {new Date(c.startTime).toLocaleString()}</p>
														<p><span className='text-gray-500 font-semibold'>Duration:</span> {c.duration} minutes</p>
														{c.visibility === "university" && (
															<p className='text-[10px] text-blue-400 font-bold flex items-center gap-1 mt-1'>
																<FaUniversity /> Restricted to @{c.university} domain
															</p>
														)}
													</div>

													<div className='flex items-center justify-between pt-2'>
														<span className='flex items-center gap-1 text-xs font-semibold capitalize'>
															{c.visibility === "public" ? <FaGlobe className='text-emerald-400' /> : <FaLock className='text-yellow-500' />}
															{c.visibility}
														</span>

														{isReg ? (
															<Link
																href={`/contests/${c.id}`}
																className='text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-950/40 bg-emerald-950/20 transition'
															>
																<FaCheckCircle /> Registered (View Portal)
															</Link>
														) : (
															<button
																onClick={() => handleRegister(c)}
																disabled={actionId === c.id}
																className='px-5 py-2.5 rounded-xl text-xs font-bold bg-brand-orange hover:bg-brand-orange-s transition text-bg-base flex items-center gap-1.5'
																style={{ color: "var(--bg-base)" }}
															>
																{actionId === c.id ? <FaSpinner className='animate-spin' /> : "Register Now"}
															</button>
														)}
													</div>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>

						{/* 3. PAST SECTION */}
						<div>
							<h2 className='text-lg font-bold mb-4 flex items-center gap-2' style={{ color: "var(--text-primary)" }}>
								<FaHistory size={16} className='text-amber-500' />
								Past Contests & Archives
							</h2>
							{past.length === 0 ? (
								<p className='text-sm text-gray-500 italic py-4 pl-2 border-l border-border-subtle'>No archived contests yet.</p>
							) : (
								<div className="space-y-4">
									<div className='border rounded-2xl overflow-hidden' style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
										<div className='overflow-x-auto'>
											<table className='w-full text-sm text-left text-gray-300'>
												<thead>
													<tr style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-dark-layer-1)" }}>
														<th className='px-6 py-4'>Contest Name</th>
														<th className='px-6 py-4 w-40'>Ended Date</th>
														<th className='px-6 py-4 w-32'>Duration</th>
														<th className='px-6 py-4 w-40 text-right'>Participation</th>
													</tr>
												</thead>
												<tbody className='divide-y divide-border-subtle'>
													{paginatedPast.map((c) => (
														<tr key={c.id} className='hover:bg-dark-fill-3 transition'>
															<td className='px-6 py-4'>
																<Link
																	href={`/contests/${c.id}`}
																	className='font-semibold text-white hover:text-brand-orange transition'
																>
																	{c.title}
																</Link>
																<p className='text-[10px] text-gray-500 line-clamp-1 mt-0.5'>{c.description}</p>
															</td>
															<td className='px-6 py-4 text-xs font-medium text-gray-400'>
																{new Date(c.endTime).toLocaleDateString()}
															</td>
															<td className='px-6 py-4 text-xs font-medium text-gray-400'>
																{c.duration} mins
															</td>
															<td className='px-6 py-4 text-right'>
																<div className='flex justify-end gap-2'>
																	{c.virtualEnabled && (
																		<button
																			onClick={() => handleStartVirtual(c.id)}
																			disabled={actionId === c.id}
																			className='text-xs font-bold px-3 py-1.5 rounded-lg border border-brand-orange/40 hover:bg-brand-orange/5 text-brand-orange transition flex items-center gap-1.5'
																		>
																			{actionId === c.id ? <FaSpinner className='animate-spin' /> : "Virtual Join"}
																		</button>
																	)}
																	<Link
																		href={`/contests/${c.id}`}
																		className='text-xs font-bold px-3 py-1.5 rounded-lg bg-dark-fill-3 hover:bg-dark-fill-2 text-white border border-border-default transition flex items-center gap-1'
																	>
																		Results <FaChevronRight size={8} />
																	</Link>
																</div>
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									</div>

									{totalPastPages > 1 && (
										<div className="rounded-2xl border" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
											<BeastCodePagination
												currentPage={pastPage}
												totalPages={totalPastPages}
												onPageChange={setPastPage}
												totalItems={past.length}
												pageSize={pastPageSize}
											/>
										</div>
									)}
								</div>
							)}
						</div>

					</div>
				)}
			</div>

			{/* Join Password Modal */}
			{showPassModal && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm'>
					<form onSubmit={handlePasswordSubmit} className='bg-dark-layer-1 border border-border-default rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl'>
						<h3 className='text-lg font-bold text-white mb-1'>Join Password Required</h3>
						<p className='text-gray-400 text-xs mb-4'>
							Contest <span className='text-brand-orange font-semibold'>&quot;{showPassModal.title}&quot;</span> is password-protected.
						</p>

						<input
							type='password'
							placeholder='Enter passcode'
							value={passInput}
							onChange={(e) => setPassInput(e.target.value)}
							className='w-full p-2.5 text-sm rounded-xl outline-none border border-border-default bg-dark-layer-2 focus:border-brand-orange font-mono mb-4 text-white'
							required
							autoFocus
						/>

						<div className='flex justify-end gap-2'>
							<button
								type='button'
								onClick={() => setShowPassModal(null)}
								className='px-4 py-2 bg-dark-fill-3 text-gray-300 rounded-lg text-xs font-semibold'
							>
								Cancel
							</button>
							<button
								type='submit'
								className='px-5 py-2 bg-brand-orange text-bg-base rounded-lg text-xs font-bold hover:bg-brand-orange-s'
								style={{ color: "var(--bg-base)" }}
							>
								Verify & Register
							</button>
						</div>
					</form>
				</div>
			)}
		</main>
	);
}
