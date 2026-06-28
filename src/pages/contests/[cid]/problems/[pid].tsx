import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import Topbar from "@/components/Topbar/Topbar";
import SecondaryNav from "@/components/TabsNavigation/SecondaryNav";
import { getServerTime, getContestStatus } from "@/utils/contestStatusService";
import Workspace from "@/components/Workspace/Workspace";
import useHasMounted from "@/hooks/useHasMounted";
import { Problem } from "@/utils/types/problem";
import { auth, firestore } from "@/firebase/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, query, where, orderBy } from "firebase/firestore";
import { problems as staticProblems } from "@/utils/problems";
import Link from "next/link";
import { FaLock, FaExclamationTriangle, FaExpand, FaClock, FaChevronLeft, FaSpinner } from "react-icons/fa";
import { SubmissionProvider } from "@/context/SubmissionContext";
import ErrorDisplay from "@/components/UI/ErrorDisplay";

interface Contest {
	id: string;
	title: string;
	status: string;
	securityLevel: string;
	duration: number;
	startTime: number;
	endTime: number;
	leaderboardFreeze?: number;
	registrationEnabled?: boolean;
}

interface ContestProblem {
	problemId: string;
	label: string;
	title: string;
}

const ContestProblemPage: React.FC = () => {
	const router = useRouter();
	const { cid, pid } = router.query;
	const hasMounted = useHasMounted();
	const [user, loadingUser] = useAuthState(auth);

	const [problem, setProblem] = useState<Problem | null>(null);
	const [contest, setContest] = useState<Contest | null>(null);
	const [allContestProblems, setAllContestProblems] = useState<ContestProblem[]>([]);
	const [participantStatus, setParticipantStatus] = useState<string | null>(null);
	const [isVirtual, setIsVirtual] = useState(false);
	const [virtualEndTime, setVirtualEndTime] = useState<number | null>(null);

	const [loading, setLoading] = useState(true);

	// Anti-cheat state
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [warnings, setWarnings] = useState(0);
	const [showExamLockModal, setShowExamLockModal] = useState(false);
	const [terminatedReason, setTerminatedReason] = useState<string | null>(null);
	const [showWarningModal, setShowWarningModal] = useState(false);
	const [violationType, setViolationType] = useState<"fullscreen" | "tab">("fullscreen");
	const [pendingWarningCount, setPendingWarningCount] = useState(0);

	// Timer state
	const [timeLeft, setTimeLeft] = useState("");

	const warningsRef = useRef(0);
	warningsRef.current = warnings;

	const lastWarningTimeRef = useRef<number>(0);
	const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Fetch everything
	const fetchData = useCallback(async () => {
		if (!cid || !pid) return;

		const isInitialLoad = !contest;
		if (isInitialLoad) {
			setLoading(true);
		}

		try {
			let currentContest = contest;
			
			// 1. Fetch Contest
			if (!currentContest) {
				const contestDoc = await getDoc(doc(firestore, "contests", cid as string));
				if (!contestDoc.exists()) {
					setLoading(false);
					return;
				}
				const cData = contestDoc.data();
				currentContest = { id: contestDoc.id, ...cData } as Contest;
				setContest(currentContest);
			}

			// 2. Fetch Participant status
			if (user) {
				const partDoc = await getDoc(doc(firestore, "contest_participants", `${cid}_${user.uid}`));
				if (partDoc.exists()) {
					const pData = partDoc.data();
					setParticipantStatus(pData.status);
					setIsVirtual(!!pData.isVirtual);
					setWarnings(pData.warningsCount || 0);
					if (pData.isVirtual && pData.virtualStartTime) {
						setVirtualEndTime(pData.virtualStartTime + currentContest.duration * 60000);
					}
					if (pData.status === "terminated") {
						setTerminatedReason("Your session was terminated by administrators or security rules.");
						setLoading(false);
						return;
					}
				} else {
					setParticipantStatus(null);
				}
			}

			// 3. Fetch Problem details
			let probObj: any = null;
			const problemDoc = await getDoc(doc(firestore, "problems", pid as string));
			if (problemDoc.exists()) {
				const data = problemDoc.data();
				const dbTags = data.tags && Array.isArray(data.tags) && data.tags.length > 0
					? data.tags
					: (data.category ? [data.category] : ["Array"]);
				probObj = {
					id: problemDoc.id,
					title: data.title || "",
					problemStatement: data.problemStatement || "",
					examples: data.examples || [],
					constraints: data.constraints || "",
					starterCode: data.starterCode || "",
					handlerFunction: data.handlerFunction || "",
					starterFunctionName: data.starterFunctionName || "",
					inputFormat: data.inputFormat || "",
					outputFormat: data.outputFormat || "",
					tags: dbTags,
					description: data.description || "",
					language: data.language || "English",
					difficulty: data.difficulty || "Medium",
					points: data.points || 100,
				};
			} else if (staticProblems[pid as string]) {
				const staticProb = staticProblems[pid as string];
				const dbTags = staticProb.tags && Array.isArray(staticProb.tags) && staticProb.tags.length > 0
					? staticProb.tags
					: ((staticProb as any).category ? [(staticProb as any).category] : ["Array"]);
				probObj = {
					id: pid as string,
					title: staticProb.title || "",
					problemStatement: staticProb.problemStatement || "",
					examples: staticProb.examples || [],
					constraints: staticProb.constraints || "",
					starterCode: staticProb.starterCode || "",
					handlerFunction: typeof staticProb.handlerFunction === "function" ? staticProb.handlerFunction.toString() : staticProb.handlerFunction,
					starterFunctionName: staticProb.starterFunctionName || "",
					inputFormat: staticProb.inputFormat || "",
					outputFormat: staticProb.outputFormat || "",
					tags: dbTags,
					description: staticProb.description || "",
					language: staticProb.language || "English",
					difficulty: staticProb.difficulty || "Medium",
					points: staticProb.points || 100,
				};
			}
			setProblem(probObj);

			// 4. Fetch list of all problems in this contest for the header tabs
			if (allContestProblems.length === 0) {
				const cpSnap = await getDocs(
					query(collection(firestore, "contest_problems"), where("contestId", "==", cid), orderBy("order", "asc"))
				);
				const cpList: ContestProblem[] = [];
				cpSnap.forEach((d) => {
					const cpData = d.data();
					cpList.push({
						problemId: cpData.problemId,
						label: cpData.label,
						title: cpData.problemId
					});
				});
				setAllContestProblems(cpList);
			}

			// Trigger Exam mode lock modal if security is enabled (only on initial load)
			if (isInitialLoad && (currentContest.securityLevel === "standard" || currentContest.securityLevel === "strict")) {
				setShowExamLockModal(true);
			}

		} catch (err) {
			console.error("Error loading contest problem:", err);
		} finally {
			if (isInitialLoad) {
				setLoading(false);
			}
		}
	}, [cid, pid, user, contest, allContestProblems.length]);

	useEffect(() => {
		if (cid && pid && !loadingUser) {
			fetchData();
		}
	}, [cid, pid, user, loadingUser, fetchData]);

	// --- TIMER ENGINE ---
	useEffect(() => {
		if (!contest) return;

		const timer = setInterval(() => {
			const now = getServerTime();
			let target = 0;

			if (isVirtual && virtualEndTime) {
				target = virtualEndTime;
			} else {
				target = contest.endTime;
			}

			if (now >= target) {
				setTimeLeft("00:00:00");
				clearInterval(timer);
				return;
			}

			const diff = target - now;
			const hrs = Math.floor(diff / 3600000);
			const mins = Math.floor((diff % 3600000) / 60000);
			const secs = Math.floor((diff % 60000) / 1000);

			const format = (n: number) => n.toString().padStart(2, "0");
			setTimeLeft(`${format(hrs)}:${format(mins)}:${format(secs)}`);
		}, 1000);

		return () => clearInterval(timer);
	}, [contest, isVirtual, virtualEndTime]);

	// --- ANTI-CHEAT HANDLERS ---
	const terminateUser = useCallback(async (reason: string) => {
		if (!cid || !user) return;
		try {
			// Update status in db
			const regRef = doc(firestore, "contest_participants", `${cid}_${user.uid}`);
			await updateDoc(regRef, { status: "terminated" });
			setParticipantStatus("terminated");
			setTerminatedReason(reason);
			
			// Exit fullscreen if active
			if (document.fullscreenElement) {
				document.exitFullscreen().catch(() => {});
			}

			// Send termination confirmation/informational email if not in virtual mode
			if (!isVirtual) {
				try {
					const userToken = await user.getIdToken();
					await fetch("/api/send-termination-email", {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${userToken}`
						},
						body: JSON.stringify({
							contestId: cid,
							reason
						})
					});
				} catch (emailErr) {
					console.error("Failed to send termination email:", emailErr);
				}
			}
		} catch (e) {
			console.error("Error terminating user:", e);
		}
	}, [cid, user, isVirtual]);

	const logIntegrityEvent = useCallback(async (type: string, details: string) => {
		if (!cid || !user) return;
		try {
			await addDoc(collection(firestore, "contest_integrity_events"), {
				contestId: cid,
				uid: user.uid,
				username: user.email?.split("@")[0] || "user",
				type,
				timestamp: Date.now(),
				details
			});
		} catch (e) {
			console.error("Error logging integrity event:", e);
		}
	}, [cid, user]);

	const triggerSecurityWarning = useCallback(async (type: "fullscreen" | "tab", details: string) => {
		if (showWarningModal || showExamLockModal || participantStatus === "terminated" || !cid || !user || !contest) return;

		const nowTime = Date.now();
		if (nowTime - lastWarningTimeRef.current < 2000) {
			return;
		}
		lastWarningTimeRef.current = nowTime;

		if (contest.securityLevel === "standard" || contest.securityLevel === "strict") {
			const isStrict = contest.securityLevel === "strict";
			const newWarnCount = warningsRef.current + 1;
			setWarnings(newWarnCount);

			try {
				const regRef = doc(firestore, "contest_participants", `${cid}_${user.uid}`);
				await updateDoc(regRef, { warningsCount: newWarnCount });
			} catch (dbErr) {
				console.error("Failed to sync warning count to DB:", dbErr);
			}

			logIntegrityEvent(type === "fullscreen" ? "fullscreen_exit" : "tab_switch", details);

			if (isStrict || newWarnCount >= 3) {
				terminateUser(type === "fullscreen" ? "Terminated due to fullscreen violation." : "Terminated due to focus switch violation.");
			} else {
				setViolationType(type);
				setPendingWarningCount(newWarnCount);
				setShowWarningModal(true);
			}
		}
	}, [contest, cid, user, showWarningModal, showExamLockModal, participantStatus, logIntegrityEvent, terminateUser]);

	// Listeners
	useEffect(() => {
		if (!contest || contest.securityLevel === "casual") return;

		const onFullscreenChange = () => {
			const isFull = !!document.fullscreenElement;
			setIsFullscreen(isFull);
			if (!isFull) {
				triggerSecurityWarning("fullscreen", "User exited fullscreen mode.");
			}
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState === "hidden") {
				triggerSecurityWarning("tab", "User switched tabs or minimized browser window.");
			}
		};

		const handleBlur = () => {
			if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
			blurTimeoutRef.current = setTimeout(() => {
				if (!document.hasFocus() && document.visibilityState === "visible") {
					triggerSecurityWarning("tab", "User lost focus on the contest window.");
				}
			}, 1200);
		};

		const handleFocus = () => {
			if (blurTimeoutRef.current) {
				clearTimeout(blurTimeoutRef.current);
				blurTimeoutRef.current = null;
			}
		};

		document.addEventListener("fullscreenchange", onFullscreenChange);
		document.addEventListener("visibilitychange", handleVisibilityChange);
		window.addEventListener("blur", handleBlur);
		window.addEventListener("focus", handleFocus);

		return () => {
			document.removeEventListener("fullscreenchange", onFullscreenChange);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			window.removeEventListener("blur", handleBlur);
			window.removeEventListener("focus", handleFocus);
			if (blurTimeoutRef.current) {
				clearTimeout(blurTimeoutRef.current);
			}
		};
	}, [contest, triggerSecurityWarning]);

	const now = getServerTime();
	const computedStatus = contest
		? getContestStatus(
				{
					id: contest.id,
					startTime: contest.startTime,
					endTime: contest.endTime,
					leaderboardFreeze: contest.leaderboardFreeze || 0,
					status: contest.status,
					registrationEnabled: contest.registrationEnabled !== false,
				},
				now
		  )
		: null;

	const isVirtualActive = isVirtual && virtualEndTime && now < virtualEndTime;
	const isRegularActive = computedStatus === "running" || computedStatus === "frozen";
	const isContestActive = !!((isVirtualActive || isRegularActive) && participantStatus !== "terminated");

	useEffect(() => {
		if (!isContestActive) return;

		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			e.preventDefault();
			e.returnValue = "Are you sure you want to leave the contest? Your progress might not be saved.";
			return e.returnValue;
		};

		const handleRouteChange = (url: string) => {
			if (url.startsWith(`/contests/${cid}/problems/`)) {
				return;
			}
			router.events.emit("routeChangeError");
			alert("You cannot leave the problem-solving workspace while the contest is active. Please complete the contest first.");
			throw "Route change aborted";
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		router.events.on("routeChangeStart", handleRouteChange);

		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);
			router.events.off("routeChangeStart", handleRouteChange);
		};
	}, [isContestActive, cid, router]);

	// Fullscreen request
	const enterFullscreenMode = () => {
		const elem = document.documentElement;
		const requestMethod = elem.requestFullscreen || (elem as any).mozRequestFullScreen || (elem as any).webkitRequestFullscreen || (elem as any).msRequestFullscreen;
		
		if (requestMethod) {
			requestMethod.call(elem)
				.then(() => {
					setIsFullscreen(true);
					setShowExamLockModal(false);
					logIntegrityEvent("session_start", "User locked into Secure Mode.");
				})
				.catch((err: any) => {
					console.error("Fullscreen lock failed:", err);
					alert("Could not enter secure fullscreen mode. Please check browser permissions.");
				});
		}
	};

	if (!hasMounted) return null;

	if (loading || loadingUser) {
		return (
			<div className='min-h-screen flex flex-col justify-center items-center gap-4 bg-dark-layer-2 text-white'>
				<FaSpinner className='animate-spin text-brand-orange' size={30} />
				<p className='text-gray-400'>Setting up Secure Compiler...</p>
			</div>
		);
	}

	if (!contest) {
		return <ErrorDisplay type="contest_not_found" />;
	}

	if (!problem) {
		return <ErrorDisplay type="problem_not_found" />;
	}

	// Admission Checks
	if (!user) {
		return (
			<div className='bg-dark-layer-2 min-h-screen text-white flex flex-col'>
				<Topbar />
				<main className='flex-1 flex flex-col justify-center items-center gap-4 px-4 pb-20'>
					<h3 className='text-2xl font-bold'>Authentication Required</h3>
					<p className='text-sm text-gray-400'>Sign in to join the contest arena.</p>
				</main>
			</div>
		);
	}

	const isContestEnded = computedStatus === "ended" || computedStatus === "archived";

	if (participantStatus === "terminated" || terminatedReason) {
		return (
			<div className='bg-dark-layer-2 min-h-screen text-white flex flex-col'>
				<Topbar />
				<main className='flex-1 flex flex-col justify-center items-center gap-4 px-4 pb-20'>
					<FaExclamationTriangle className='text-red-500 animate-pulse' size={48} />
					<h3 className='text-2xl font-bold text-red-500'>Participation Terminated</h3>
					<p className='text-sm text-gray-400 max-w-md text-center leading-relaxed'>
						{terminatedReason || "Your exam workspace session has been terminated due to multiple security violations."}
					</p>
					<Link href={`/contests/${cid}`} className='bg-dark-fill-3 hover:bg-dark-fill-2 text-white border border-border-default font-bold px-6 py-2.5 rounded-xl text-sm mt-4 transition-all duration-200 hover:scale-105 shadow-lg shadow-black/20'>
						Return to Portal
					</Link>
				</main>
			</div>
		);
	}

	if (!isContestEnded && (!participantStatus || participantStatus === "registered")) {
		return (
			<div className='bg-dark-layer-2 min-h-screen text-white flex flex-col'>
				<Topbar />
				<main className='flex-1 flex flex-col justify-center items-center gap-4 px-4 pb-20'>
					<h3 className='text-2xl font-bold'>Contest Entry Required</h3>
					<p className='text-sm text-gray-400 mb-2'>You must join the contest from the dashboard before viewing challenges.</p>
					<Link href={`/contests/${cid}`} className='bg-brand-orange hover:bg-brand-orange-s text-bg-base font-bold px-6 py-2.5 rounded-xl text-sm transition-all duration-200 hover:scale-105 shadow-md'>
						Back to Contest Dashboard
					</Link>
				</main>
			</div>
		);
	}


	const isProblemLoading = !problem || problem.id !== pid;

	return (
		<div className='min-h-screen bg-dark-layer-2 text-white flex flex-col'>
			{/* Custom Contest Header */}
			<header className='flex justify-between items-center px-6 py-3 border-b border-border-default' style={{ background: "var(--bg-surface)" }}>
				<div className='flex items-center gap-4'>
					{!isContestActive && (
						<>
							<Link
								href={`/contests/${cid}`}
								className='text-xs font-semibold flex items-center gap-1 hover:text-brand-orange text-gray-400'
							>
								<FaChevronLeft size={10} /> Back to Portal
							</Link>
							<span className='h-4 w-px bg-border-default' />
						</>
					)}
					<h2 className='text-sm font-bold text-white'>{contest?.title}</h2>
					<div className='flex gap-1 items-center bg-dark-fill-3 border border-border-subtle rounded-lg px-2 py-0.5 text-xs text-gray-400 font-semibold'>
						<FaClock size={10} className='text-brand-orange' />
						{timeLeft}
					</div>
				</div>

				{/* Problem set tabs */}
				<SecondaryNav
					tabs={allContestProblems.map((cp) => ({
						id: cp.problemId,
						label: cp.label,
						href: `/contests/${cid}/problems/${cp.problemId}`
					}))}
					activeTab={pid as string}
				/>

				<div className='text-xs font-semibold text-gray-500'>
					Secure Mode: <span className='capitalize text-emerald-400 font-bold'>{contest?.securityLevel}</span>
				</div>
			</header>

			{isProblemLoading ? (
				<div className='flex-1 flex flex-col justify-center items-center gap-4 bg-dark-layer-2 text-white'>
					<FaSpinner className='animate-spin text-brand-orange' size={30} />
					<p className='text-gray-400'>Loading problem details...</p>
				</div>
			) : (
				problem && (
					<div className='flex-1 overflow-hidden relative'>
						<SubmissionProvider problemId={problem.id} contestId={cid as string}>
							<Workspace problem={problem} contestId={cid as string} />
						</SubmissionProvider>
					</div>
				)
			)}

			{/* Lock Overlay Modal */}
			{showExamLockModal && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md'>
					<div className='bg-dark-layer-1 border border-border-default rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl text-center space-y-6'>
						<FaLock className='text-brand-orange mx-auto' size={45} />
						<div className='space-y-2'>
							<h3 className='text-xl font-bold text-white'>Secure Exam Mode Required</h3>
							<p className='text-xs text-gray-400 leading-relaxed'>
								This contest requires Fullscreen secure browser mode. Escaping fullscreen, resizing, or switching browser tabs will trigger integrity warnings. Reaching 3 violations terminates your session.
							</p>
						</div>

						<button
							onClick={enterFullscreenMode}
							className='w-full py-3 rounded-xl font-bold text-sm bg-brand-orange hover:bg-brand-orange-s text-bg-base transition flex items-center justify-center gap-2'
							style={{ color: "var(--bg-base)" }}
						>
							<FaExpand size={12} /> Enter Secure Arena
						</button>
					</div>
				</div>
			)}

			{/* Custom Warning Modal */}
			{showWarningModal && (
				<div className='fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 transition-all duration-300'>
					<div className='bg-dark-layer-1 border border-red-500/20 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center space-y-6 relative overflow-hidden animate-scale-up'>
						<div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-500 via-amber-500 to-red-500" />
						
						<div className="relative">
							<div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-500/10 text-red-500 mb-2">
								<FaExclamationTriangle size={30} className="animate-pulse" />
							</div>
							
							<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-extrabold bg-red-500/10 text-red-400 border border-red-500/20">
								Security Alert
							</span>
						</div>

						<div className='space-y-2'>
							<h3 className='text-xl font-bold text-white tracking-tight'>
								{violationType === "fullscreen" ? "Fullscreen Mode Exited" : "Tab Switch Detected"}
							</h3>
							<p className='text-xs text-gray-400 leading-relaxed'>
								{violationType === "fullscreen" 
									? "You have exited secure fullscreen mode. Escaping secure mode is a policy violation."
									: "You switched tabs or lost window focus. Leaving the exam workspace page is not permitted."}
							</p>
						</div>

						{/* Warning indicator counter */}
						<div className="bg-dark-fill-3 border border-border-default rounded-xl p-4 flex justify-between items-center" style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>
							<span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Violation Warning:</span>
							<span className="text-sm font-black text-red-400 tracking-wider">
								{pendingWarningCount} / 3
							</span>
						</div>

						<button
							onClick={() => {
								setShowWarningModal(false);
								if (!document.fullscreenElement) {
									enterFullscreenMode();
								}
							}}
							className='w-full py-3 rounded-xl font-bold text-sm bg-red-500 hover:bg-red-600 text-white transition flex items-center justify-center gap-2 shadow-lg shadow-red-500/25'
						>
							I Understand & Resume
						</button>
					</div>
				</div>
			)}
		</div>
	);
};

export default ContestProblemPage;
