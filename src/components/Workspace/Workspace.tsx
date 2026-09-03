import { useState, useEffect } from "react";
import ProblemDescription from "./ProblemDescription/ProblemDescription";
import SecondaryNav from "../TabsNavigation/SecondaryNav";
import Playground from "./Playground/Playground";
import ProblemDiscussions from "./ProblemDiscussions";
import { Problem } from "@/utils/types/problem";
import Confetti from "react-confetti";
import useWindowSize from "@/hooks/useWindowSize";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, firestore } from "@/firebase/firebase";
import useHasMounted from "@/hooks/useHasMounted";
import { collection, query, where, getDocs, doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { FaFacebook, FaTwitter, FaLinkedin, FaStar, FaGlobe, FaTimes, FaCheck, FaCode, FaLightbulb } from "react-icons/fa";
import { FiChevronRight, FiArrowLeft, FiZap, FiCheck, FiX } from "react-icons/fi";
import CodeMirror from "@uiw/react-codemirror";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { useSubmission } from "@/context/SubmissionContext";
import { getSubmissionStateMetadata } from "@/utils/submissionUtils";
import TestcaseScorecard from "./TestcaseScorecard/TestcaseScorecard";

const SocialIcon: React.FC<{ Icon: any; title: string }> = ({ Icon, title }) => {
	return (
		<button
			className="transition-all duration-200 p-2.5 rounded-full flex items-center justify-center cursor-pointer hover:scale-110 text-text-muted hover:text-brand-orange hover:bg-brand-orange/10"
			title={title}
		>
			<Icon size={18} />
		</button>
	);
};

const getDifficultyBadgeStyle = (difficulty: string) => {
	const diff = (difficulty || "Easy").toLowerCase();
	let varColor = "var(--color-success)";
	let shadowGlow = "var(--shadow-glow-success)";
	if (diff === "medium") {
		varColor = "var(--color-warning)";
		shadowGlow = "var(--shadow-glow-warning)";
	}
	if (diff === "hard") {
		varColor = "var(--color-error)";
		shadowGlow = "var(--shadow-glow-error)";
	}

	return {
		color: varColor,
		backgroundColor: `color-mix(in srgb, ${varColor} 10%, transparent)`,
		boxShadow: shadowGlow,
		outline: `1px solid color-mix(in srgb, ${varColor} 20%, transparent)`,
	};
};

type WorkspaceProps = {
	problem: Problem;
	contestId?: string;
};

const Workspace: React.FC<WorkspaceProps> = ({ problem, contestId }) => {
	const { width, height } = useWindowSize();
	const [user, loading] = useAuthState(auth);
	const [success, setSuccess] = useState(false);
	const [solved, setSolved] = useState(false);
	const [activeTab, setActiveTab] = useState<"problem" | "submissions" | "leaderboard" | "discussions" | "editorial">("problem");

	const hasMounted = useHasMounted();
	const [leftPercent, setLeftPercent] = useState<number>(45);
	const [isDragging, setIsDragging] = useState(false);

	useEffect(() => {
		if (!isDragging) return;
		const handlePointerMove = (e: PointerEvent) => {
			const containerWidth = window.innerWidth;
			if (containerWidth <= 0) return;
			const newPercent = (e.clientX / containerWidth) * 100;
			const minPercent = (300 / containerWidth) * 100;
			const maxPercent = ((containerWidth - 300) / containerWidth) * 100;
			setLeftPercent(Math.max(minPercent, Math.min(maxPercent, newPercent)));
		};
		const handlePointerUp = () => {
			setIsDragging(false);
		};
		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", handlePointerUp);
		return () => {
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", handlePointerUp);
		};
	}, [isDragging]);

	const [activeTheme, setActiveTheme] = useState<string>("default");
	useEffect(() => {
		if (typeof window !== "undefined") {
			setActiveTheme(localStorage.getItem("theme") || "default");
			const handleSync = () => {
				setActiveTheme(localStorage.getItem("theme") || "default");
			};
			window.addEventListener("themechange", handleSync);
			return () => window.removeEventListener("themechange", handleSync);
		}
	}, []);

	const [activeLanguage, setActiveLanguage] = useState<string>("en");
	const [translations, setTranslations] = useState<Record<string, any>>({});
	const [translating, setTranslating] = useState<boolean>(false);

	const handleTranslate = async (langCode: string) => {
		if (langCode === "en") {
			setActiveLanguage("en");
			return;
		}

		if (translations[langCode]) {
			setActiveLanguage(langCode);
			return;
		}

		setTranslating(true);
		try {
			const fieldsToTranslate = [
				{ key: "title", text: problem.title },
				{ key: "problemStatement", text: problem.problemStatement },
				{ key: "inputFormat", text: problem.inputFormat || "" },
				{ key: "constraints", text: problem.constraints || "" },
				{ key: "outputFormat", text: problem.outputFormat || "" },
				{ key: "editorialMarkdown", text: problem.editorial?.markdown || "" },
				...problem.examples.map((ex, idx) => ({
					key: `example_${idx}`,
					text: ex.explanation || "",
				})),
			].filter(item => item.text.trim() !== "");

			const separator = " ||||| ";
			const combinedText = fieldsToTranslate.map(item => item.text).join(separator);

			const res = await fetch("/api/translate", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					text: combinedText,
					targetLang: langCode,
				}),
			});

			if (!res.ok) {
				throw new Error("Translation failed");
			}

			const data = await res.json();
			if (data.error) {
				throw new Error(data.error);
			}

			const translatedCombined = data.translatedText || "";
			const splitRegex = /\s*\|\|\|\|\|\s*/;
			const translatedParts = translatedCombined.split(splitRegex);

			const newTranslatedProblem: any = { ...problem };
			let partIdx = 0;
			fieldsToTranslate.forEach((item) => {
				const translatedVal = translatedParts[partIdx] || item.text;
				partIdx++;

				if (item.key === "title") {
					newTranslatedProblem.title = translatedVal;
				} else if (item.key === "problemStatement") {
					newTranslatedProblem.problemStatement = translatedVal;
				} else if (item.key === "inputFormat") {
					newTranslatedProblem.inputFormat = translatedVal;
				} else if (item.key === "constraints") {
					newTranslatedProblem.constraints = translatedVal;
				} else if (item.key === "outputFormat") {
					newTranslatedProblem.outputFormat = translatedVal;
				} else if (item.key === "editorialMarkdown") {
					if (newTranslatedProblem.editorial) {
						newTranslatedProblem.editorial = {
							...newTranslatedProblem.editorial,
							markdown: translatedVal,
						};
					}
				} else if (item.key.startsWith("example_")) {
					const idx = parseInt(item.key.split("_")[1]);
					if (newTranslatedProblem.examples[idx]) {
						newTranslatedProblem.examples[idx] = {
							...newTranslatedProblem.examples[idx],
							explanation: translatedVal,
						};
					}
				}
			});

			setTranslations((prev) => ({ ...prev, [langCode]: newTranslatedProblem }));
			setActiveLanguage(langCode);
		} catch (error) {
			console.error("Translation error:", error);
			alert("Failed to translate the problem. Please try again.");
		} finally {
			setTranslating(false);
		}
	};

	const displayProblem = activeLanguage === "en" ? problem : (translations[activeLanguage] || problem);

	// Sidebar statistics & ratings states
	const [submissionsCount, setSubmissionsCount] = useState(5);
	const [userRating, setUserRating] = useState(0);
	const [hoverRating, setHoverRating] = useState(0);
	const [isAdmin, setIsAdmin] = useState(false);
	const [contestDetails, setContestDetails] = useState<any>(null);

	const [ratingError, setRatingError] = useState<string | null>(null);
	const [shakeRating, setShakeRating] = useState(false);

	const triggerRatingError = (msg: string) => {
		setRatingError(msg);
		setShakeRating(true);
		setTimeout(() => setShakeRating(false), 500);
	};

	// Submissions tab state hook
	const {
		submissions,
		loadingSubs,
		selectedSub,
		setSelectedSub,
		selectedSubTestCaseIndex,
		setSelectedSubTestCaseIndex,
		isSubmitting,
		submittingStage,
		submittingProgress,
		submittingVerdict
	} = useSubmission();

	const [langFilter, setLangFilter] = useState<string>("all");
	const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
	const [searchQuery, setSearchQuery] = useState<string>("");
	const [currentPage, setCurrentPage] = useState<number>(1);
	const itemsPerPage = 8;

	// Leaderboard tab states
	const [leaderboard, setLeaderboard] = useState<any[]>([]);
	const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

	// Fetch submissions count, check admin status, and load user's rating on mount
	useEffect(() => {
		const fetchInitialData = async () => {
			try {
				// 1. Fetch total submissions count for this problem
				const q = query(
					collection(firestore, contestId ? "contest_submissions" : "submissions"),
					where("problemId", "==", problem.id),
					...(contestId ? [where("contestId", "==", contestId)] : [])
				);
				const snap = await getDocs(q);
				if (snap.size > 0) {
					setSubmissionsCount(snap.size);
				}

				// 2. Check if logged-in user is admin/owner
				if (user) {
					const userRef = doc(firestore, "users", user.uid);
					const userDoc = await getDoc(userRef);
					if (userDoc.exists()) {
						const userData = userDoc.data();
						if (userData.role === "admin" || userData.isAdmin === true) {
							setIsAdmin(true);
						}
						if (userData.problemRatings && userData.problemRatings[problem.id]) {
							setUserRating(userData.problemRatings[problem.id]);
						} else {
							setUserRating(0);
						}
					}
				} else {
					setUserRating(0);
				}

				// 3. Fetch contest details if contestId exists
				if (contestId) {
					const contestDoc = await getDoc(doc(firestore, "contests", contestId));
					if (contestDoc.exists()) {
						setContestDetails(contestDoc.data());
					}
				}
			} catch (e) {
				console.error("Error fetching workspace initial metadata:", e);
			}
		};

		fetchInitialData();
	}, [problem.id, user, contestId]);


	// Fetch standings when activeTab switches to leaderboard
	useEffect(() => {
		if (activeTab === "leaderboard") {
			const fetchLeaderboard = async () => {
				setLoadingLeaderboard(true);
				try {
					// 1. Fetch user map
					const usersSnap = await getDocs(collection(firestore, "users"));
					const usersMap: Record<string, any> = {};
					usersSnap.forEach((docSnap) => {
						usersMap[docSnap.id] = docSnap.data();
					});

					// 2. Fetch submissions for this problem
					const q = query(
						collection(firestore, contestId ? "contest_submissions" : "submissions"),
						where("problemId", "==", problem.id),
						...(contestId ? [where("contestId", "==", contestId)] : [])
					);
					const snap = await getDocs(q);

					const userBest: Record<string, { score: number; timestamp: number; language: string }> = {};

					snap.forEach((docSnap) => {
						const sub = docSnap.data();
						const uid = sub.uid;
						if (!uid) return;
						const score = sub.score !== undefined ? sub.score : (sub.status === "passed" ? 100 : 0);
						const timestamp = sub.timestamp || Date.now();

						if (!userBest[uid]) {
							userBest[uid] = { score, timestamp, language: sub.language || "" };
						} else {
							if (score > userBest[uid].score) {
								userBest[uid] = { score, timestamp, language: sub.language || "" };
							} else if (score === userBest[uid].score && timestamp < userBest[uid].timestamp) {
								userBest[uid] = { score, timestamp, language: sub.language || "" };
							}
						}
					});

					const standings = Object.keys(userBest).map((uid) => {
						const userObj = usersMap[uid] || {};
						return {
							uid,
							displayName: userObj.displayName || "Anonymous User",
							avatarUrl: userObj.avatarUrl || "",
							score: userBest[uid].score,
							timestamp: userBest[uid].timestamp,
							language: userBest[uid].language,
						};
					});

					// Sort by score desc, then by earliest timestamp
					standings.sort((a, b) => {
						if (b.score !== a.score) return b.score - a.score;
						return a.timestamp - b.timestamp;
					});

					setLeaderboard(standings);
				} catch (err) {
					console.error("Error building leaderboard:", err);
				} finally {
					setLoadingLeaderboard(false);
				}
			};

			fetchLeaderboard();
		}
	}, [activeTab, problem.id]);

	// Helpers
	const formatLanguage = (lang: string) => {
		switch (lang?.toLowerCase()) {
			case "cpp":
				return "C++20";
			case "c":
				return "C";
			case "python":
				return "Python 3";
			case "javascript":
				return "JavaScript";
			case "java":
				return "Java";
			default:
				return lang;
		}
	};

	const formatRelativeTime = (ts: number) => {
		const diff = Date.now() - ts;
		const secs = Math.floor(diff / 1000);
		const mins = Math.floor(secs / 60);
		const hours = Math.floor(mins / 60);
		const days = Math.floor(hours / 24);

		if (secs < 60) return "just now";
		if (mins < 60) return `${mins} mins ago`;
		if (hours < 24) return `${hours} hours ago`;
		if (days === 1) return "yesterday";
		if (days < 30) return `${days} days ago`;
		return new Date(ts).toLocaleDateString();
	};

	const filteredSubmissions = submissions.filter((sub) => {
		const langMatch = langFilter === "all" || sub.language === langFilter;
		
		let outcomeMatch = true;
		if (outcomeFilter !== "all") {
			const subVerdict = (sub.verdict || "").toLowerCase();
			const subStatus = (sub.status || "").toLowerCase();
			if (outcomeFilter === "passed") {
				outcomeMatch = subStatus === "passed";
			} else if (outcomeFilter === "failed") {
				outcomeMatch = subStatus === "failed";
			} else {
				outcomeMatch = subVerdict.includes(outcomeFilter);
			}
		}
		
		const searchMatch =
			!searchQuery ||
			(sub.code || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
			(sub.verdict || "").toLowerCase().includes(searchQuery.toLowerCase());
			
		return langMatch && outcomeMatch && searchMatch;
	});

	const totalPages = Math.ceil(filteredSubmissions.length / itemsPerPage);
	const paginatedSubmissions = filteredSubmissions.slice(
		(currentPage - 1) * itemsPerPage,
		currentPage * itemsPerPage
	);

	const getPerformanceStats = (currentSub: any) => {
		if (!currentSub || currentSub.status !== "passed") return null;
		const peerSubs = submissions.filter(s => s.language === currentSub.language && s.status === "passed");
		if (peerSubs.length <= 1) {
			return { runtimeBeats: 100, memoryBeats: 100 };
		}
		
		const currentRuntime = currentSub.runtime || 10;
		const currentMemory = currentSub.memory || 2048;
		
		const fasterCount = peerSubs.filter(s => (s.runtime || 10) > currentRuntime).length;
		const lessMemoryCount = peerSubs.filter(s => (s.memory || 2048) > currentMemory).length;
		
		const runtimeBeats = Math.round((fasterCount / (peerSubs.length - 1)) * 100);
		const memoryBeats = Math.round((lessMemoryCount / (peerSubs.length - 1)) * 100);
		
		return {
			runtimeBeats: Math.max(5, Math.min(99, runtimeBeats)),
			memoryBeats: Math.max(5, Math.min(99, memoryBeats))
		};
	};

	const handleRateChallenge = async (stars: number) => {
		if (!user) {
			triggerRatingError("Sign in to rate");
			return;
		}

		try {
			const userRef = doc(firestore, "users", user.uid);
			await updateDoc(userRef, {
				[`problemRatings.${problem.id}`]: stars,
			});
			setUserRating(stars);
			setRatingError(null);
		} catch (error) {
			console.error("Error saving rating:", error);
			triggerRatingError("Failed to save rating");
		}
	};

	const handleOpenInEditor = () => {
		if (!selectedSub) return;
		if (loading) return;
		const key = user ? `code-${user.uid}-${problem.id}-${selectedSub.language}` : `code-${problem.id}-${selectedSub.language}`;
		localStorage.setItem(key, JSON.stringify(selectedSub.code));
		setActiveTab("problem");
	};

	useEffect(() => {
		if (isSubmitting) {
			setActiveTab("submissions");
		}
	}, [isSubmitting]);

	if (!hasMounted) return null;

	return (
		<div className="min-h-screen bg-bg-base text-text-primary font-sans select-text" style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)" }}>
			<div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-y-8">
				{/* Block A: The Information & Navigation Header */}
				<div className="bg-bg-surface border border-border-default rounded-2xl p-4 sm:p-6 md:p-8 shadow-sm flex flex-col gap-6" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-default)" }}>
					{/* Title & Metadata Area */}
					<div>
						{!contestId && (
							<div className="flex items-center text-[10px] font-bold uppercase tracking-wider select-none mb-2 text-text-muted">
								<Link href="/" className="hover:text-brand-orange transition-colors duration-200">
									Problem List
								</Link>
								{displayProblem.tags && displayProblem.tags.length > 0 && (
									<>
										<FiChevronRight className="w-3.5 h-3.5 mx-1 opacity-50 text-text-muted" />
										<Link
											href={`/tags/${encodeURIComponent(displayProblem.tags[0].toLowerCase())}`}
											className="hover:text-brand-orange transition-colors duration-200"
										>
											{displayProblem.tags[0]}
										</Link>
									</>
								)}
								<FiChevronRight className="w-3.5 h-3.5 mx-1 opacity-50 text-text-muted" />
								<span className="text-text-primary">{displayProblem.title}</span>
							</div>
						)}

						<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
							<h1 className="text-2xl md:text-3xl font-black tracking-tight text-text-primary" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text-primary)" }}>
								{displayProblem.title}
							</h1>
							
							{/* Compact Meta Info Row */}
							<div className="flex flex-wrap items-center gap-3 bg-dark-fill-3/20 border border-border-subtle rounded-xl p-3 text-xs font-semibold select-none">
								<div className="flex items-center gap-2">
									<span className="text-text-muted">Difficulty:</span>
									<span
										className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase outline-1 outline-offset-0 transition-all duration-300"
										style={getDifficultyBadgeStyle(displayProblem.difficulty || "Easy")}
									>
										{displayProblem.difficulty}
									</span>
								</div>

								<div className="h-4 w-px bg-border-subtle" />

								<div>
									<span className="text-text-muted">Points: </span>
									<span className="font-bold text-text-primary">{displayProblem.points || 100}</span>
								</div>

								<div className="h-4 w-px bg-border-subtle" />

								<div className="flex items-center gap-1.5 font-sans">
									<span className="text-text-muted">Rate:</span>
									<div className={`flex gap-1 ${shakeRating ? "animate-shake" : ""}`}>
										{[1, 2, 3, 4, 5].map((star) => {
											const isFilled = star <= (hoverRating || userRating);
											return (
												<button
													key={star}
													type="button"
													onClick={() => handleRateChallenge(star)}
													onMouseEnter={() => setHoverRating(star)}
													onMouseLeave={() => setHoverRating(0)}
													className="focus:outline-none transition-transform duration-200 hover:scale-110 active:scale-125"
													style={{
														color: isFilled ? "var(--brand-orange)" : "color-mix(in srgb, var(--text-muted) 30%, transparent)",
														filter: isFilled ? "drop-shadow(0 0 8px color-mix(in srgb, var(--brand-orange) 60%, transparent))" : "none",
													}}
												>
													<FaStar size={14} />
												</button>
											);
										})}
									</div>
								</div>

								{isAdmin && (
									<>
										<div className="h-4 w-px bg-border-subtle" />
										<Link href={`/admin/problems/${problem.id}`} className="hover:text-brand-orange text-brand-orange transition-colors font-extrabold flex items-center gap-1">
											✎ Edit Challenge
										</Link>
									</>
								)}
							</div>
						</div>
					</div>

					{/* Horizontal Tab Navigation */}
					<div className="border-b border-border-default pb-0.5 overflow-x-auto whitespace-nowrap scrollbar-none" style={{ borderColor: "var(--border-default)", msOverflowStyle: "none", scrollbarWidth: "none" }}>
						<SecondaryNav
							tabs={[
								{ id: "problem", label: "Problem" },
								{ id: "submissions", label: "Submissions" },
								{ id: "leaderboard", label: "Leaderboard" },
								{ id: "discussions", label: "Discussions" },
								{ id: "editorial", label: "Editorial" },
							]}
							activeTab={activeTab}
							onChange={setActiveTab}
							className="mb-0"
						/>
					</div>

					{/* Content Expansion Area */}
					<div className="w-full">
						{activeTab === "problem" && (
							<div className="space-y-6 animate-fade-in">
								<ProblemDescription
									problem={displayProblem}
									_solved={solved}
									lightTheme={activeTheme === "light"}
									activeLanguage={activeLanguage}
									translating={translating}
									handleTranslate={handleTranslate}
								/>
							</div>
						)}

						{activeTab === "submissions" && (
							<div className="space-y-6 animate-fade-in">
								{selectedSub ? (
									<div className="space-y-6">
										{/* Header row */}
										<div className="flex justify-between items-center pb-4 border-b border-border-subtle" style={{ borderColor: "var(--border-subtle)" }}>
											<button
												onClick={() => setSelectedSub(null)}
												className="flex items-center gap-1.5 text-xs font-bold text-text-secondary hover:text-text-primary transition bg-dark-fill-3 hover:bg-dark-fill-2 border border-border-subtle px-3.5 py-1.5 rounded-lg shadow-sm"
												style={{ borderColor: "var(--border-subtle)" }}
											>
												<FiArrowLeft size={14} /> Back to Submissions List
											</button>
											<span className="text-xs text-text-muted" style={{ color: "var(--text-muted)" }}>
												ID: {selectedSub.id}
											</span>
										</div>

										{/* Pipeline Stage Indicator */}
										{(() => {
											const currentStage = (selectedSub.stage || submittingStage || selectedSub.status || "submitting").toLowerCase();
											const isFinished = !["submitting", "queued", "compiling", "running", "evaluating", "pending"].includes(currentStage);
											if (isFinished) return null;

											const stages = [
												{ key: "submitting", label: "Submitting", desc: "Preparing execution payload" },
												{ key: "queued", label: "Queued", desc: "Waiting for queue slot" },
												{ key: "compiling", label: "Compiling", desc: "Running compiler toolchain" },
												{ key: "running", label: "Running", desc: "Executing tests" },
												{ key: "evaluating", label: "Evaluating", desc: "Checking constraints" },
												{ key: "completed", label: "Completed", desc: "Rendering scorecard" }
											];

											const getStageStatus = (stageKey: string) => {
												const stageOrder = ["submitting", "queued", "compiling", "running", "evaluating", "completed"];
												const currentIdx = stageOrder.indexOf(currentStage);
												const targetIdx = stageOrder.indexOf(stageKey);
												
												if (currentIdx > targetIdx) return "completed";
												if (currentIdx === targetIdx) return "active";
												return "upcoming";
											};

											const currentProgress = selectedSub.progress || (currentStage === "running" ? submittingProgress : null);

											return (
												<div className="py-8 px-4 bg-dark-fill-3/30 border border-border-subtle rounded-2xl mb-8 flex flex-col md:flex-row justify-between items-center gap-6 md:gap-4 relative overflow-hidden" style={{ borderColor: "var(--border-subtle)" }}>
													{stages.map((stg, index) => {
														const status = getStageStatus(stg.key);
														return (
															<div key={stg.key} className="flex-1 flex flex-col items-center text-center relative z-10">
																{/* Icon circle */}
																<div className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-300 ${
																	status === "completed"
																		? "bg-bc-success/20 border-bc-success text-bc-success shadow-glow-success"
																		: status === "active"
																		? "bg-brand-orange/20 border-brand-orange text-brand-orange animate-pulse shadow-glow-warning"
																		: "bg-dark-fill-3 border-border-subtle text-text-muted"
																}`}>
																	{status === "completed" ? (
																		<FaCheck size={14} />
																	) : status === "active" ? (
																		<div className="w-2.5 h-2.5 rounded-full bg-brand-orange" />
																	) : (
																		<div className="w-2.5 h-2.5 rounded-full bg-gray-600" />
																	)}
																</div>
																{/* Text */}
																<div className="mt-3">
																	<p className={`text-xs font-bold ${
																		status === "active" ? "text-brand-orange font-extrabold" : "text-text-primary"
																	}`}>
																		{stg.label}
																	</p>
																	<p className="text-[10px] text-text-muted mt-0.5" style={{ color: "var(--text-muted)" }}>
																		{stg.key === "running" && currentProgress
																			? `Cases: ${typeof currentProgress === "object" && currentProgress !== null ? `${currentProgress.current} / ${currentProgress.total}` : currentProgress}`
																			: stg.desc}
																	</p>
																</div>
															</div>
														);
													})}
													{/* Connector Line */}
													<div className="absolute top-[48px] left-[10%] right-[10%] h-[2px] bg-dark-fill-3 -z-0 hidden md:block" />
												</div>
											);
										})()}

										{/* Verdict Header Panel */}
										{(() => {
											const currentStage = (selectedSub.stage || submittingStage || selectedSub.status || "submitting").toLowerCase();
											const isFinished = !["submitting", "queued", "compiling", "running", "evaluating", "pending"].includes(currentStage);
											if (!isFinished) return null;

											const subMeta = getSubmissionStateMetadata(selectedSub.verdict || selectedSub.status);
											const perf = getPerformanceStats(selectedSub);

											return (
												<div className="space-y-6">
													<div className="p-6 md:p-8 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
														style={{
															backgroundColor: subMeta.bgColor,
															borderColor: subMeta.borderColor,
															boxShadow: subMeta.glowShadow
														}}
													>
														<div className="space-y-3">
															<div className="flex items-center gap-3">
																<div className="p-2.5 rounded-xl" style={{
																	backgroundColor: `color-mix(in srgb, ${subMeta.color} 15%, transparent)`,
																	color: subMeta.color
																}}>
																	{subMeta.Icon && <subMeta.Icon size={26} className="animate-fade-in" />}
																</div>
																<div>
																	<h2 className="text-2xl font-black tracking-tight" style={{ color: subMeta.color }}>
																		{subMeta.label}
																	</h2>
																	<p className="text-xs text-text-muted" style={{ color: "var(--text-muted)" }}>
																		Submitted {formatRelativeTime(selectedSub.timestamp)} • Language: {formatLanguage(selectedSub.language)}
																	</p>
																</div>
															</div>
															<p className="text-xs text-text-secondary max-w-xl font-medium leading-relaxed">
																{subMeta.description}
															</p>
														</div>

														<div className="flex flex-col sm:flex-row gap-4 items-center w-full md:w-auto">
															<div className="bg-dark-fill-3/40 border border-border-subtle p-4 rounded-xl text-center min-w-[110px] w-full sm:w-auto" style={{ borderColor: "var(--border-subtle)" }}>
																<p className="text-[10px] uppercase font-bold text-text-muted" style={{ color: "var(--text-muted)" }}>Score</p>
																<p className="text-2xl font-black mt-1 text-text-primary">
																	{(selectedSub.score !== undefined ? selectedSub.score : (selectedSub.status === "passed" ? 100 : 0)).toFixed(1)}
																</p>
															</div>

															{selectedSub.runtime !== undefined && (
																<div className="bg-dark-fill-3/40 border border-border-subtle p-4 rounded-xl text-center min-w-[110px] w-full sm:w-auto" style={{ borderColor: "var(--border-subtle)" }}>
																	<p className="text-[10px] uppercase font-bold text-text-muted" style={{ color: "var(--text-muted)" }}>Runtime</p>
																	<p className="text-2xl font-black mt-1 text-text-primary">
																		{selectedSub.runtime} <span className="text-xs font-semibold">ms</span>
																	</p>
																</div>
															)}

															{selectedSub.memory !== undefined && (
																<div className="bg-dark-fill-3/40 border border-border-subtle p-4 rounded-xl text-center min-w-[110px] w-full sm:w-auto" style={{ borderColor: "var(--border-subtle)" }}>
																	<p className="text-[10px] uppercase font-bold text-text-muted" style={{ color: "var(--text-muted)" }}>Memory</p>
																	<p className="text-2xl font-black mt-1 text-text-primary">
																		{(selectedSub.memory / 1024).toFixed(2)} <span className="text-xs font-semibold">MB</span>
																	</p>
																</div>
															)}
														</div>
													</div>

													{/* Advice Panel */}
													{subMeta.advice && (
														<div className="bg-dark-fill-3/15 border border-border-subtle p-5 rounded-2xl space-y-2" style={{ borderColor: "var(--border-subtle)" }}>
															<h4 className="text-xs uppercase font-bold text-brand-orange tracking-wider flex items-center gap-1.5" style={{ color: "var(--brand-orange)" }}>
																<FaLightbulb size={14} /> Suggested Fix & Optimization Advice
															</h4>
															<p className="text-xs text-text-secondary leading-relaxed font-medium">
																{subMeta.advice}
															</p>
														</div>
													)}

													{/* Performance distribution stats */}
													{perf && (
														<div className="bg-dark-fill-3/20 border border-border-subtle p-6 rounded-2xl space-y-5" style={{ borderColor: "var(--border-subtle)" }}>
															<h3 className="text-xs uppercase font-bold text-text-muted tracking-wider flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
																<FiZap size={14} /> Performance Profile
															</h3>
															<div className="space-y-4">
																<div>
																	<div className="flex justify-between items-center text-xs mb-1.5">
																		<span className="font-semibold text-text-secondary">Runtime Efficiency</span>
																		<span className="font-black text-bc-success">Beats {perf.runtimeBeats}% of users</span>
																	</div>
																	<div className="w-full h-2 rounded-full bg-dark-fill-3 overflow-hidden">
																		<div className="h-full bg-bc-success rounded-full transition-all duration-1000 shadow-glow-success" style={{ width: `${perf.runtimeBeats}%` }} />
																	</div>
																</div>
																<div>
																	<div className="flex justify-between items-center text-xs mb-1.5">
																		<span className="font-semibold text-text-secondary">Memory footprint</span>
																		<span className="font-black text-bc-success">Beats {perf.memoryBeats}% of users</span>
																	</div>
																	<div className="w-full h-2 rounded-full bg-dark-fill-3 overflow-hidden">
																		<div className="h-full bg-bc-success rounded-full transition-all duration-1000 shadow-glow-success" style={{ width: `${perf.memoryBeats}%` }} />
																	</div>
																</div>
															</div>
														</div>
													)}

													{/* Testcase Scorecard / Error log */}
													{selectedSub.status === "failed" && (selectedSub.verdict === "Compilation Error" || !selectedSub.testResults || selectedSub.testResults.length === 0) ? (
														<div className="space-y-3">
															<p className="text-xs font-bold text-rose-500">Compiler Diagnostic Output:</p>
															<pre className="p-4 rounded-xl text-xs font-mono overflow-auto max-h-[220px] bg-black/60 border border-border-subtle text-rose-400 whitespace-pre-wrap leading-relaxed" style={{ borderColor: "var(--border-subtle)" }}>
																{selectedSub.error || selectedSub.message || "Compilation failed with unknown diagnostics."}
															</pre>
														</div>
													) : (
														selectedSub.testResults && Array.isArray(selectedSub.testResults) && selectedSub.testResults.length > 0 && (
															<div className="space-y-6">
																<TestcaseScorecard
																	testResults={selectedSub.testResults}
																	activeIndex={selectedSubTestCaseIndex}
																	setActiveIndex={setSelectedSubTestCaseIndex}
																	runtime={selectedSub.runtime}
																	memory={selectedSub.memory}
																	score={selectedSub.score}
																/>

																{selectedSub.testResults[selectedSubTestCaseIndex] && (
																	<div className="mt-4 pt-4 border-t border-border-subtle space-y-4" style={{ borderColor: "var(--border-subtle)" }}>
																		{(() => {
																			const currentCase = selectedSub.testResults[selectedSubTestCaseIndex];
																			const isSample = !!problem.examples[selectedSubTestCaseIndex]?.isSample;
																			const isRun = selectedSub.verdict && selectedSub.verdict.includes("Run Finished");
																			const isContestActive = !!(
																				contestId &&
																				contestDetails &&
																				contestDetails.startTime <= Date.now() &&
																				Date.now() < contestDetails.endTime
																			);
																			
																			if (!isSample && !isRun) {
																				const maskMsg = isContestActive
																					? "🔒 Input and expected output details are masked to prevent hardcoding during an active contest."
																					: "🔒 Input and output details are hidden for secret test cases to prevent hardcoding.";
																				return (
																					<div className="bg-dark-fill-3/30 border border-border-subtle rounded-xl p-5 text-center" style={{ borderColor: "var(--border-subtle)" }}>
																						<p className="text-text-muted italic text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
																							{maskMsg}
																						</p>
																						{currentCase.runtime !== undefined && (
																							<p className="text-[10px] text-text-muted mt-1.5" style={{ color: "var(--text-muted)" }}>
																								Execution profile: {currentCase.runtime} ms • {(currentCase.memory ? currentCase.memory / 1024 : 0).toFixed(2)} MB
																							</p>
																						)}
																					</div>
																				);
																			}
																			
																			return (
																				<div className="space-y-4">
																					<div>
																						<p className="text-[11px] font-bold mb-1.5 text-text-muted" style={{ color: "var(--text-muted)" }}>Input:</p>
																						<div className="border px-4 py-3 rounded-lg text-xs font-mono whitespace-pre-wrap" style={{ background: "var(--bg-testcase)", borderColor: "var(--border-testcase)", color: "var(--text-testcase)" }}>
																							{currentCase.input || <span className="italic text-gray-555">Empty Input</span>}
																						</div>
																					</div>
																					
																					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
																						{currentCase.expected && (
																							<div>
																								<p className="text-[11px] font-bold mb-1.5 text-text-muted" style={{ color: "var(--text-muted)" }}>Expected Output:</p>
																								<div className="border px-4 py-3 rounded-lg text-xs font-mono whitespace-pre-wrap bg-green-500/15 border-green-500/30 text-green-400">
																									{currentCase.expected}
																								</div>
																							</div>
																						)}
																						<div>
																							<p className="text-[11px] font-bold mb-1.5 text-text-muted" style={{ color: "var(--text-muted)" }}>Your Output:</p>
																							<div className={`border px-4 py-3 rounded-lg text-xs font-mono whitespace-pre-wrap ${
																								currentCase.passed
																									? "bg-green-500/15 border-green-500/30 text-green-400"
																									: "bg-red-500/15 border-red-500/30 text-red-400"
																							}`}>
																								{currentCase.actual || <span className="italic text-gray-500">Empty Output</span>}
																							</div>
																						</div>
																					</div>

																					{currentCase.error && (
																						<div>
																							<p className="text-[11px] font-bold mb-1.5 text-text-muted" style={{ color: "var(--text-muted)" }}>Error Details:</p>
																							<pre className="border p-4 rounded-xl text-xs font-mono overflow-auto max-h-[140px] whitespace-pre-wrap bg-black/40 border-border-subtle text-red-400" style={{ borderColor: "var(--border-subtle)" }}>
																								{currentCase.error}
																							</pre>
																						</div>
																					)}
																				</div>
																			);
																		})()}
																	</div>
																)}
															</div>
														)
													)}
												</div>
											);
										})()}

										{/* Submitted Code Section */}
										<div className="space-y-3 pt-6 border-t border-border-subtle" style={{ borderColor: "var(--border-subtle)" }}>
											<h3 className="text-lg font-bold text-text-primary font-sans" style={{ color: "var(--text-primary)" }}>Submitted Code</h3>
											<div className="border border-border-subtle rounded-xl overflow-hidden" style={{ borderColor: "var(--border-subtle)" }}>
												{/* Editor Header */}
												<div className="flex justify-between items-center bg-dark-fill-3 px-4 py-2 border-b border-border-subtle text-xs text-text-muted" style={{ borderColor: "var(--border-subtle)" }}>
													<span className="font-semibold">Language: {formatLanguage(selectedSub.language)}</span>
													<button
														onClick={handleOpenInEditor}
														className="flex items-center gap-1.5 text-brand-orange hover:text-brand-orange/90 transition font-bold"
														style={{ color: "var(--brand-orange)" }}
													>
														<FaCode size={12} /> Open in editor
													</button>
												</div>
												<CodeMirror
													value={selectedSub.code || ""}
													theme={vscodeDark}
													editable={false}
													readOnly={true}
												/>
											</div>
										</div>
									</div>
								) : (
									<div className="space-y-6">
										<div className="pb-4 border-b border-border-subtle flex flex-col md:flex-row justify-between items-start md:items-center gap-4" style={{ borderColor: "var(--border-subtle)" }}>
											<div>
												<h3 className="text-lg font-bold text-text-primary font-sans" style={{ color: "var(--text-primary)" }}>My Submissions History</h3>
												<p className="text-xs text-text-muted mt-1" style={{ color: "var(--text-muted)" }}>Filter, search, and review your previous attempts and metrics.</p>
											</div>
											
											{/* Filters / Search Row */}
											<div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
												<input
													type="text"
													placeholder="Search code or status..."
													value={searchQuery}
													onChange={(e) => {
														setSearchQuery(e.target.value);
														setCurrentPage(1);
													}}
													className="px-3 py-1.5 text-xs rounded-lg border outline-none bg-dark-fill-3 text-text-primary focus:border-border-accent w-full sm:w-[180px]"
													style={{ borderColor: "var(--border-subtle)" }}
												/>

												<select
													value={langFilter}
													onChange={(e) => {
														setLangFilter(e.target.value);
														setCurrentPage(1);
													}}
													className="px-3 py-1.5 text-xs rounded-lg border outline-none bg-dark-fill-3 text-text-secondary focus:border-border-accent cursor-pointer"
													style={{ borderColor: "var(--border-subtle)" }}
												>
													<option value="all">All Languages</option>
													<option value="javascript">JavaScript</option>
													<option value="python">Python 3</option>
													<option value="cpp">C++20</option>
													<option value="java">Java</option>
												</select>

												<select
													value={outcomeFilter}
													onChange={(e) => {
														setOutcomeFilter(e.target.value);
														setCurrentPage(1);
													}}
													className="px-3 py-1.5 text-xs rounded-lg border outline-none bg-dark-fill-3 text-text-secondary focus:border-border-accent cursor-pointer"
													style={{ borderColor: "var(--border-subtle)" }}
												>
													<option value="all">All Outcomes</option>
													<option value="passed">Passed / Accepted</option>
													<option value="failed">Failed</option>
													<option value="wrong answer">Wrong Answer</option>
													<option value="compilation error">Compilation Error</option>
													<option value="runtime error">Runtime Error</option>
													<option value="time limit exceeded">Time Limit Exceeded</option>
													<option value="memory limit exceeded">Memory Limit Exceeded</option>
												</select>
											</div>
										</div>

										{loadingSubs ? (
											<div className="flex justify-center items-center py-16">
												<div className="animate-spin rounded-full h-8 w-8 border-3 border-brand-orange border-t-transparent" style={{ borderColor: "var(--brand-orange)" }} />
											</div>
										) : paginatedSubmissions.length === 0 ? (
											<div className="text-center py-20 text-text-muted italic" style={{ color: "var(--text-muted)" }}>
												No submissions match your query. Make a new submission to log your progress!
											</div>
										) : (
											<div className="space-y-4">
												<div className="overflow-x-auto rounded-xl border border-border-subtle bg-dark-fill-3/10" style={{ borderColor: "var(--border-subtle)" }}>
													<table className="w-full text-sm text-left text-text-secondary" style={{ color: "var(--text-secondary)" }}>
														<thead className="text-xs uppercase bg-dark-fill-3/60 text-text-muted border-b border-border-subtle" style={{ color: "var(--text-muted)", borderColor: "var(--border-subtle)" }}>
															<tr>
																<th className="px-6 py-4">Language</th>
																<th className="px-6 py-4">Submitted Time</th>
																<th className="px-6 py-4">Result</th>
																<th className="px-6 py-4">Runtime</th>
																<th className="px-6 py-4">Memory</th>
																<th className="px-6 py-4">Score</th>
																<th className="px-6 py-4 text-right pr-10">Actions</th>
															</tr>
														</thead>
														<tbody className="divide-y divide-border-subtle" style={{ borderColor: "var(--border-subtle)" }}>
															{paginatedSubmissions.map((sub) => {
																const subMeta = getSubmissionStateMetadata(sub.verdict || sub.status);
																return (
																	<tr key={sub.id} className="hover:bg-dark-fill-3/20 transition duration-150">
																		<td className="px-6 py-4 font-mono text-xs text-text-muted" style={{ color: "var(--text-muted)" }}>
																			{formatLanguage(sub.language)}
																		</td>
																		<td className="px-6 py-4 text-xs text-text-muted" style={{ color: "var(--text-muted)" }}>
																			{formatRelativeTime(sub.timestamp)}
																		</td>
																		<td className="px-6 py-4 font-bold">
																			<span className="flex items-center gap-1.5" style={{ color: subMeta.color }}>
																				{subMeta.Icon && <subMeta.Icon size={13} className={["submitting", "queued", "compiling", "running", "evaluating"].includes(subMeta.name) ? "animate-pulse" : ""} />}
																				{subMeta.label}
																			</span>
																		</td>
																		<td className="px-6 py-4 text-xs font-mono text-text-muted" style={{ color: "var(--text-muted)" }}>
																			{sub.runtime !== undefined ? `${sub.runtime} ms` : "N/A"}
																		</td>
																		<td className="px-6 py-4 text-xs font-mono text-text-muted" style={{ color: "var(--text-muted)" }}>
																			{sub.memory !== undefined ? `${(sub.memory / 1024).toFixed(1)} MB` : "N/A"}
																		</td>
																		<td className="px-6 py-4 font-bold text-text-primary" style={{ color: "var(--text-primary)" }}>
																			{(sub.score !== undefined ? sub.score : (sub.status === "passed" ? 100 : 0)).toFixed(1)}
																		</td>
																		<td className="px-6 py-4 text-right pr-8">
																			<button
																				onClick={() => {
																					setSelectedSub(sub);
																					const firstFailIdx = sub.testResults ? sub.testResults.findIndex((r: any) => !r.passed) : 0;
																					setSelectedSubTestCaseIndex(firstFailIdx >= 0 ? firstFailIdx : 0);
																				}}
																				className="bg-dark-fill-3 hover:bg-dark-fill-2 border border-border-subtle text-text-secondary text-xs font-bold px-4.5 py-1.5 rounded-lg transition duration-150 shadow-sm"
																				style={{ borderColor: "var(--border-subtle)" }}
																			>
																				View Details
																			</button>
																		</td>
																	</tr>
																);
															})}
														</tbody>
													</table>
												</div>

												{/* Pagination Controls */}
												{totalPages > 1 && (
													<div className="flex items-center justify-between pt-4 select-none">
														<span className="text-xs text-text-muted" style={{ color: "var(--text-muted)" }}>
															Showing page {currentPage} of {totalPages}
														</span>
														<div className="flex gap-2">
															<button
																onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
																disabled={currentPage === 1}
																className="px-3.5 py-1.5 text-xs font-bold rounded-lg border border-border-subtle bg-dark-fill-3 disabled:opacity-50 disabled:cursor-not-allowed transition hover:border-border-accent"
																style={{ borderColor: "var(--border-subtle)" }}
															>
																Previous
															</button>
															<button
																onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
																disabled={currentPage === totalPages}
																className="px-3.5 py-1.5 text-xs font-bold rounded-lg border border-border-subtle bg-dark-fill-3 disabled:opacity-50 disabled:cursor-not-allowed transition hover:border-border-accent"
																style={{ borderColor: "var(--border-subtle)" }}
															>
																Next
															</button>
														</div>
													</div>
												)}
											</div>
										)}
									</div>
								)}
							</div>
						)}

						{activeTab === "leaderboard" && (
							<div className="space-y-6 animate-fade-in">
								<div className="pb-4 border-b border-border-subtle" style={{ borderColor: "var(--border-subtle)" }}>
									<h3 className="text-lg font-bold text-text-primary" style={{ color: "var(--text-primary)" }}>Problem Leaderboard ({displayProblem.title})</h3>
									<p className="text-xs text-text-muted mt-1" style={{ color: "var(--text-muted)" }}>Standings are ranked based on the highest score achieved, then by the fastest submission.</p>
								</div>

								{loadingLeaderboard ? (
									<div className="flex justify-center items-center py-16">
										<div className="animate-spin rounded-full h-8 w-8 border-3 border-brand-orange border-t-transparent" style={{ borderColor: "var(--brand-orange)" }} />
									</div>
								) : leaderboard.length === 0 ? (
									<div className="text-center py-20 text-text-muted italic" style={{ color: "var(--text-muted)" }}>
										No students solved this challenge yet. Be the first to secure a spot!
									</div>
								) : (
									<div className="overflow-x-auto rounded-xl border border-border-subtle bg-dark-fill-3/10" style={{ borderColor: "var(--border-subtle)" }}>
										<table className="w-full text-sm text-left text-text-secondary" style={{ color: "var(--text-secondary)" }}>
											<thead className="text-xs uppercase bg-dark-fill-3 text-text-muted border-b border-border-subtle" style={{ color: "var(--text-muted)", borderColor: "var(--border-subtle)" }}>
												<tr>
													<th className="px-6 py-4 w-20 text-center">Rank</th>
													<th className="px-6 py-4">User</th>
													<th className="px-6 py-4">Score</th>
													<th className="px-6 py-4">Best Language</th>
													<th className="px-6 py-4">Solved Time</th>
													<th className="px-6 py-4 text-right pr-12">Country</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-border-subtle" style={{ borderColor: "var(--border-subtle)" }}>
												{leaderboard.map((player, idx) => {
													const rank = idx + 1;
													return (
														<tr key={player.uid} className="hover:bg-dark-fill-2/45 transition">
															<td className="px-6 py-4 text-center font-bold text-text-muted" style={{ color: "var(--text-muted)" }}>{rank}</td>
															<td className="px-6 py-4">
																<div className="flex items-center gap-3">
																	{player.avatarUrl ? (
																		<img
																			src={player.avatarUrl}
																			alt="Avatar"
																			className="w-7 h-7 rounded-full object-cover border border-border-subtle"
																			style={{ borderColor: "var(--border-subtle)" }}
																		/>
																	) : (
																		<div className="w-7 h-7 rounded-full bg-dark-fill-3 border border-border-subtle flex items-center justify-center text-text-muted" style={{ borderColor: "var(--border-subtle)" }}>
																			<FaGlobe size={11} />
																		</div>
																	)}
																	<span className="font-bold text-text-primary" style={{ color: "var(--text-primary)" }}>{player.displayName}</span>
																</div>
															</td>
															<td className="px-6 py-4 font-bold text-bc-success">{player.score.toFixed(2)}</td>
															<td className="px-6 py-4 font-mono text-xs text-text-muted" style={{ color: "var(--text-muted)" }}>{formatLanguage(player.language)}</td>
															<td className="px-6 py-4 text-xs text-text-muted" style={{ color: "var(--text-muted)" }}>{formatRelativeTime(player.timestamp)}</td>
															<td className="px-6 py-4 text-right pr-10">
																<div className="inline-flex items-center gap-1.5 text-xs text-text-muted select-none" style={{ color: "var(--text-muted)" }}>
																	<span className="text-lg">🇻🇳</span>
																	<span className="font-semibold text-text-secondary" style={{ color: "var(--text-secondary)" }}>Vietnam</span>
																</div>
															</td>
														</tr>
													);
												})}
											</tbody>
										</table>
									</div>
								)}
							</div>
						)}

						{activeTab === "discussions" && (
							<div className="animate-fade-in">
								<ProblemDiscussions problemId={problem.id} problemTitle={displayProblem.title} lightTheme={activeTheme === "light"} />
							</div>
						)}

						{activeTab === "editorial" && (
							<div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
								<h3 className="text-2xl font-light text-text-primary pb-3 border-b border-border-subtle" style={{ color: "var(--text-primary)", borderColor: "var(--border-subtle)" }}>
									Official Editorial
								</h3>
								
								{displayProblem.editorial?.videoUrl && (
									<div className="space-y-3">
										<h4 className="text-sm font-bold text-text-secondary" style={{ color: "var(--text-secondary)" }}>Video Walkthrough</h4>
										<div className="aspect-video w-full max-w-2xl mx-auto overflow-hidden rounded-xl border border-border-subtle bg-bg-base" style={{ borderColor: "var(--border-subtle)" }}>
											<iframe
												src={getEmbedUrl(displayProblem.editorial.videoUrl)}
												title="Video solution"
												frameBorder="0"
												allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
												allowFullScreen
												className="w-full h-full"
											/>
										</div>
									</div>
								)}

								<div className="text-sm leading-relaxed text-text-secondary mt-4 prose prose-invert max-w-none" style={{ color: "var(--text-secondary)" }}>
									{displayProblem.editorial?.markdown ? (
										<div dangerouslySetInnerHTML={{ __html: renderMarkdown(displayProblem.editorial.markdown, false) }} />
									) : (
										<p className="text-text-muted italic text-center py-12" style={{ color: "var(--text-muted)" }}>
											No official editorial has been published for this problem yet.
										</p>
									)}
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Block B & Block C: The Full-Width Code Canvas & Execution Console */}
				<div className="w-full">
					<Playground
						key={user ? `${user.uid}-${problem.id}` : `guest-${problem.id}`}
						problem={problem}
						setSuccess={setSuccess}
						setSolved={setSolved}
						lightTheme={activeTheme === "light"}
						contestId={contestId}
					/>
				</div>
			</div>

			{/* Confetti celebration for success */}
			{success && <Confetti gravity={0.3} tweenDuration={4000} width={width - 1} height={height - 1} />}
		</div>
	);
};

// Simple Markdown to HTML parser
function renderMarkdown(text: string, lightTheme: boolean): string {
	if (!text) return "";
	let html = text;

	// Bold
	html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
	// Italic
	html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
	// Inline Code
	const inlineClass = "bg-bg-dark-layer-1 text-brand-orange px-1.5 py-0.5 rounded text-sm font-mono";
	html = html.replace(/`(.*?)`/g, `<code class='${inlineClass}'>$1</code>`);
	// Code Blocks
	const preClass = "bg-black/45 p-3 rounded-lg font-mono text-xs border border-gray-850 overflow-auto my-2.5 whitespace-pre text-gray-300";
	html = html.replace(/```([\s\S]*?)```/g, `<pre class='${preClass}'>$1</pre>`);
	// Links
	html = html.replace(/\[(.*?)\]\((.*?)\)/g, "<a href='$2' target='_blank' class='text-blue-600 hover:text-blue-500 underline transition'>$1</a>");
	// Convert list markers if there are no HTML list tags
	if (!html.includes("<li")) {
		html = html.replace(/^\s*\*\s+(.*)$/gm, "<li class='list-disc ml-5'>$1</li>");
		html = html.replace(/^\s*\d+\.\s+(.*)$/gm, "<li class='list-decimal ml-5'>$1</li>");
	}

	return html;
}

function getEmbedUrl(url: string): string {
	if (!url) return "";
	// Youtube
	let regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
	let match = url.match(regExp);
	if (match && match[2].length === 11) {
		return `https://www.youtube.com/embed/${match[2]}`;
	}
	// Vimeo
	regExp = /vimeo\.com\/([0-9]+)/;
	match = url.match(regExp);
	if (match) {
		return `https://player.vimeo.com/video/${match[1]}`;
	}
	return url;
}

export default Workspace;
