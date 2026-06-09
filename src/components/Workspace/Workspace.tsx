import { useState, useEffect } from "react";
import ProblemDescription from "./ProblemDescription/ProblemDescription";
import Playground from "./Playground/Playground";
import ProblemDiscussions from "./ProblemDiscussions";
import { Problem } from "@/utils/types/problem";
import Confetti from "react-confetti";
import useWindowSize from "@/hooks/useWindowSize";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, firestore } from "@/firebase/firebase";
import { collection, query, where, getDocs, doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { FaFacebook, FaTwitter, FaLinkedin, FaStar, FaGlobe, FaChevronRight, FaTimes, FaCheck, FaCode } from "react-icons/fa";
import CodeMirror from "@uiw/react-codemirror";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";

type WorkspaceProps = {
	problem: Problem;
};

const Workspace: React.FC<WorkspaceProps> = ({ problem }) => {
	const { width, height } = useWindowSize();
	const [user, loading] = useAuthState(auth);
	const [success, setSuccess] = useState(false);
	const [solved, setSolved] = useState(false);
	const [activeTab, setActiveTab] = useState<"problem" | "submissions" | "leaderboard" | "discussions" | "editorial">("problem");

	// Sidebar statistics & ratings states
	const [submissionsCount, setSubmissionsCount] = useState(5);
	const [userRating, setUserRating] = useState(0);
	const [hoverRating, setHoverRating] = useState(0);
	const [isAdmin, setIsAdmin] = useState(false);

	const [ratingError, setRatingError] = useState<string | null>(null);
	const [shakeRating, setShakeRating] = useState(false);

	const triggerRatingError = (msg: string) => {
		setRatingError(msg);
		setShakeRating(true);
		setTimeout(() => setShakeRating(false), 500);
	};

	// Submissions tab states
	const [submissions, setSubmissions] = useState<any[]>([]);
	const [loadingSubs, setLoadingSubs] = useState(false);
	const [selectedSub, setSelectedSub] = useState<any | null>(null);
	const [selectedSubTestCaseIndex, setSelectedSubTestCaseIndex] = useState<number>(0);

	// Leaderboard tab states
	const [leaderboard, setLeaderboard] = useState<any[]>([]);
	const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

	// Fetch submissions count, check admin status, and load user's rating on mount
	useEffect(() => {
		const fetchInitialData = async () => {
			try {
				// 1. Fetch total submissions count for this problem
				const q = query(collection(firestore, "submissions"), where("problemId", "==", problem.id));
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
			} catch (e) {
				console.error("Error fetching workspace initial metadata:", e);
			}
		};

		fetchInitialData();
	}, [problem.id, user]);

	// Fetch user's submissions history when activeTab switches to submissions
	useEffect(() => {
		if (activeTab === "submissions" && user) {
			const fetchSubmissions = async () => {
				setLoadingSubs(true);
				try {
					const q = query(
						collection(firestore, "submissions"),
						where("uid", "==", user.uid),
						where("problemId", "==", problem.id)
					);
					const snap = await getDocs(q);
					const list: any[] = [];
					snap.forEach((docSnap) => {
						list.push({ id: docSnap.id, ...docSnap.data() });
					});
					// Sort chronologically desc
					list.sort((a, b) => b.timestamp - a.timestamp);
					setSubmissions(list);
				} catch (err) {
					console.error("Error fetching user submissions:", err);
				} finally {
					setLoadingSubs(false);
				}
			};

			fetchSubmissions();
		}
	}, [activeTab, problem.id, user]);

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
					const q = query(collection(firestore, "submissions"), where("problemId", "==", problem.id));
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

	return (
		<div className="bg-dark-fill-2 min-h-screen pb-16 font-sans text-white">
			{/* Header Details */}
			<div className="bg-dark-layer-2 border-b border-gray-800/80 py-6 px-8 select-none shadow-lg">
				<div className="max-w-7xl mx-auto">
					{/* Breadcrumbs */}
					<div className="flex items-center gap-1.5 text-xs text-gray-400 font-semibold mb-2">
						<Link href="/" className="hover:text-brand-orange transition">Problem List</Link>
						{problem.category && (
							<>
								<FaChevronRight size={8} className="text-gray-500" />
								<span className="hover:text-brand-orange transition cursor-pointer">{problem.category}</span>
							</>
						)}
						<FaChevronRight size={8} className="text-gray-500" />
						<span className="text-white">{problem.title}</span>
					</div>

					{/* Title Section */}
					<div className="flex flex-wrap items-center gap-3">
						<h1 className="text-3xl font-light text-white">{problem.title}</h1>
					</div>
				</div>
			</div>

			{/* Navigation Tabs Bar */}
			<div className="bg-dark-layer-2 border-b border-gray-800/80 px-8 select-none">
				<div className="max-w-7xl mx-auto flex items-end">
					{([
						{ id: "problem", label: "Problem" },
						{ id: "submissions", label: "Submissions" },
						{ id: "leaderboard", label: "Leaderboard" },
						{ id: "discussions", label: "Discussions" },
						{ id: "editorial", label: "Editorial" },
					] as const).map((tab) => {
						const isActive = activeTab === tab.id;
						return (
							<button
								key={tab.id}
								onClick={() => setActiveTab(tab.id)}
								className={`py-3.5 px-6 text-sm font-semibold border-t-2 border-l border-r -mb-[1px] transition focus:outline-none ${
									isActive
										? "bg-dark-fill-2 text-white border-t-brand-orange border-l-gray-800 border-r-gray-800 font-bold border-b-dark-fill-2"
										: "bg-dark-layer-2 text-gray-400 border-t-transparent border-l-transparent border-r-transparent border-b-gray-800 hover:bg-dark-fill-3 hover:text-white"
								}`}
							>
								{tab.label}
							</button>
						);
					})}
				</div>
			</div>

			{/* Main Workspace Body Content */}
			<div className="max-w-7xl mx-auto px-8 mt-8">
				{activeTab === "problem" && (
					<div className="space-y-8">
						{/* Grid row: description + sidebar */}
						<div className="grid grid-cols-12 gap-8 items-start">
							{/* Description Block */}
							<div className="col-span-12 lg:col-span-9 bg-dark-layer-2 p-8 rounded-lg border border-gray-850 shadow-lg min-h-[400px]">
								<ProblemDescription problem={problem} _solved={solved} lightTheme={false} />
							</div>

							{/* Sidebar Block */}
							<div className="col-span-12 lg:col-span-3 space-y-6">
								{/* Social Share Card */}
								<div className="bg-dark-layer-2 border border-gray-850 rounded-lg p-5 shadow-lg text-center">
									<div className="flex justify-center gap-4 text-gray-400 select-none">
										<button className="hover:text-blue-500 transition" title="Share on Facebook">
											<FaFacebook size={16} />
										</button>
										<button className="hover:text-blue-400 transition" title="Share on Twitter">
											<FaTwitter size={16} />
										</button>
										<button className="hover:text-blue-600 transition" title="Share on LinkedIn">
											<FaLinkedin size={16} />
										</button>
									</div>
								</div>

								{/* Stats Card */}
								<div className="bg-dark-layer-2 border border-gray-850 rounded-lg p-5 shadow-lg space-y-4">
									<div className="text-xs text-gray-400 font-semibold space-y-3">
										<div className="flex justify-between items-center">
											<span>Submissions:</span>
											<span className="text-brand-orange font-bold cursor-pointer hover:underline" onClick={() => setActiveTab("submissions")}>
												{submissionsCount}
											</span>
										</div>
										<div className="flex justify-between items-center border-t border-gray-800 pt-3">
											<span>Max Score:</span>
											<span className="text-white font-bold">{problem.points || 100}</span>
										</div>
										<div className="flex justify-between items-center border-t border-gray-800 pt-3">
											<span>Difficulty:</span>
											<span className={`font-bold uppercase ${
												problem.difficulty === "Easy"
													? "text-[#2ec866]"
													: problem.difficulty === "Medium"
													? "text-yellow-500"
													: "text-red-500"
											}`}>
												{problem.difficulty}
											</span>
										</div>
									</div>
								</div>

								{/* Rating Card */}
								<div className="bg-dark-layer-2 border border-gray-850 rounded-lg p-5 shadow-lg text-center space-y-2">
									<h4 className="text-xs text-gray-400 font-bold">Rate This Challenge:</h4>
									<div className={`flex justify-center gap-1.5 select-none ${shakeRating ? "shake-animation" : ""}`}>
										<style>{`
											@keyframes ratingShake {
												0%, 100% { transform: translateX(0); }
												20%, 60% { transform: translateX(-6px); }
												40%, 80% { transform: translateX(6px); }
											}
											.shake-animation {
												animation: ratingShake 0.4s ease-in-out;
											}
										`}</style>
										{[1, 2, 3, 4, 5].map((star) => {
											const isFilled = star <= (hoverRating || userRating);
											return (
												<button
													key={star}
													type="button"
													onClick={() => handleRateChallenge(star)}
													onMouseEnter={() => setHoverRating(star)}
													onMouseLeave={() => setHoverRating(0)}
													className="text-yellow-450 focus:outline-none transition-transform active:scale-125"
												>
													<FaStar size={18} className={isFilled ? "fill-yellow-450" : "fill-transparent stroke-yellow-450 stroke-2 text-transparent"} style={{ stroke: "#eab308" }} />
												</button>
											);
										})}
									</div>
									{ratingError && (
										<p className="text-[10px] text-rose-500 font-medium mt-1 animate-pulse">
											{ratingError}
										</p>
									)}
								</div>

								{/* Admin Options Card */}
								{isAdmin && (
									<div className="bg-dark-layer-2 border border-gray-850 rounded-lg p-5 shadow-lg space-y-3">
										<h4 className="text-xs text-gray-300 font-bold border-b border-gray-800 pb-2">Admin Options</h4>
										<div className="flex flex-col gap-2 text-xs font-semibold text-brand-orange">
											<Link href={`/admin/problems/${problem.id}`} className="hover:underline flex items-center gap-1">
												✎ Edit Challenge
											</Link>
											<button onClick={() => setActiveTab("submissions")} className="hover:underline text-left flex items-center gap-1">
												☷ View Submissions
											</button>
										</div>
									</div>
								)}
							</div>
						</div>

						{/* Full-width Playground Editor */}
						<div className="w-full">
							<Playground
								key={user ? `${user.uid}-${problem.id}` : `guest-${problem.id}`}
								problem={problem}
								setSuccess={setSuccess}
								setSolved={setSolved}
								lightTheme={false}
							/>
						</div>
					</div>
				)}
				{/* Submissions History Tab Content */}
				{activeTab === "submissions" && (
					<div className="bg-dark-layer-2 border border-gray-850 rounded-lg shadow-lg overflow-hidden min-h-[400px]">
						{selectedSub ? (
							<div className="p-6 space-y-6">
								{/* Header row */}
								<div className="flex justify-between items-center pb-4 border-b border-gray-800">
									<div className="flex items-center gap-3">
										<button
											onClick={() => setSelectedSub(null)}
											className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition bg-dark-fill-3 hover:bg-dark-fill-2 border border-gray-800 px-3 py-1.5 rounded-lg shadow-sm"
										>
											← Back to Submissions
										</button>
										<span className="text-sm text-gray-400">
											Submitted {formatRelativeTime(selectedSub.timestamp)} • Score: {(selectedSub.score !== undefined ? selectedSub.score : (selectedSub.status === "passed" ? 100 : 0)).toFixed(2)}
										</span>
									</div>
									<div className="flex items-center gap-2">
										<span className="text-sm text-gray-450 font-semibold">Status:</span>
										<span className={`text-sm font-extrabold ${
											selectedSub.status === "passed" ? "text-[#2ec866]" : "text-red-500"
										}`}>
											{selectedSub.status === "passed" ? "Accepted" : "Wrong Answer"}
										</span>
									</div>
								</div>

								{/* Test Cases Scorecard Box */}
								{selectedSub.testResults && Array.isArray(selectedSub.testResults) && selectedSub.testResults.length > 0 && (
									<div className="border border-gray-800 rounded-xl p-6 bg-dark-fill-3/10 space-y-5">
										<div className="grid grid-cols-1 md:grid-cols-3 gap-y-3.5 gap-x-4">
											{selectedSub.testResults.map((result: any, index: number) => {
												return (
													<div
														key={index}
														className={`flex items-center gap-3 text-sm font-semibold select-none w-full ${
															result.passed ? "text-green-400" : "text-red-400"
														}`}
													>
														<span className={`text-base font-black ${result.passed ? "text-[#2ec866]" : "text-red-500"}`}>
															{result.passed ? "✓" : "✗"}
														</span>
														<span>Test Case #{index}</span>
													</div>
												);
											})}
										</div>
									</div>
								)}

								{/* Submitted Code Section */}
								<div className="space-y-3">
									<h3 className="text-lg font-bold text-white">Submitted Code</h3>
									<div className="border border-gray-800 rounded-xl overflow-hidden bg-dark-layer-1">
										{/* Editor Header */}
										<div className="flex justify-between items-center bg-dark-fill-3 px-4 py-2 border-b border-gray-800 text-xs text-gray-400">
											<span className="font-semibold">Language: {formatLanguage(selectedSub.language)}</span>
											<button
												onClick={handleOpenInEditor}
												className="flex items-center gap-1.5 text-brand-orange hover:text-brand-orange/90 transition font-bold"
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
							<>
								<div className="p-6 border-b border-gray-800">
									<h3 className="text-lg font-bold text-white">My Submissions History</h3>
									<p className="text-xs text-gray-400 mt-1">Review your past code attempts and scores for this problem.</p>
								</div>

								{loadingSubs ? (
									<div className="flex justify-center items-center py-16">
										<div className="animate-spin rounded-full h-8 w-8 border-3 border-brand-orange border-t-transparent" />
									</div>
								) : submissions.length === 0 ? (
									<div className="text-center py-20 text-gray-500 italic">
										No submissions recorded yet. Make a submission to log your progress!
									</div>
								) : (
									<table className="w-full text-sm text-left text-gray-300">
										<thead className="text-xs uppercase bg-dark-fill-3 text-gray-400 border-b border-gray-800">
											<tr>
												<th className="px-6 py-4">Problem</th>
												<th className="px-6 py-4">Language</th>
												<th className="px-6 py-4">Submitted Time</th>
												<th className="px-6 py-4">Result</th>
												<th className="px-6 py-4">Score</th>
												<th className="px-6 py-4 text-right pr-10">Actions</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-gray-800">
											{submissions.map((sub) => {
												const isPassed = sub.status === "passed";
												return (
													<tr key={sub.id} className="hover:bg-dark-fill-2/45 transition">
														<td className="px-6 py-4 font-bold text-brand-orange truncate max-w-xs cursor-pointer hover:underline" onClick={() => setActiveTab("problem")}>
															{problem.title}
														</td>
														<td className="px-6 py-4 font-mono text-xs text-gray-400">{formatLanguage(sub.language)}</td>
														<td className="px-6 py-4 text-xs text-gray-500">{formatRelativeTime(sub.timestamp)}</td>
														<td className={`px-6 py-4 font-semibold ${isPassed ? "text-[#2ec866]" : "text-red-500"}`}>
															{isPassed ? "Accepted ✓" : "Wrong Answer ✗"}
														</td>
														<td className="px-6 py-4 font-bold text-white">{sub.score !== undefined ? sub.score : (isPassed ? 100 : 0)}</td>
														<td className="px-6 py-4 text-right pr-8">
															<button
																onClick={() => {
																	setSelectedSub(sub);
																	const firstFailIdx = sub.testResults ? sub.testResults.findIndex((r: any) => !r.passed) : 0;
																	setSelectedSubTestCaseIndex(firstFailIdx >= 0 ? firstFailIdx : 0);
																}}
																className="bg-dark-fill-3 hover:bg-dark-fill-2 border border-gray-800 text-gray-300 text-xs font-semibold px-4 py-1.5 rounded transition shadow-sm"
															>
																View Results
															</button>
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								)}
							</>
						)}
					</div>
				)}

				{/* Leaderboard/Standings Tab Content */}
				{activeTab === "leaderboard" && (
					<div className="bg-dark-layer-2 border border-gray-850 rounded-lg shadow-lg overflow-hidden min-h-[400px]">
						<div className="p-6 border-b border-gray-800">
							<h3 className="text-lg font-bold text-white">Problem Leaderboard</h3>
							<p className="text-xs text-gray-400 mt-1">Standings are ranked based on the highest score achieved, then by the fastest submission.</p>
						</div>

						{loadingLeaderboard ? (
							<div className="flex justify-center items-center py-16">
								<div className="animate-spin rounded-full h-8 w-8 border-3 border-brand-orange border-t-transparent" />
							</div>
						) : leaderboard.length === 0 ? (
							<div className="text-center py-20 text-gray-500 italic">
								No students solved this challenge yet. Be the first to secure a spot!
							</div>
						) : (
							<table className="w-full text-sm text-left text-gray-300">
								<thead className="text-xs uppercase bg-dark-fill-3 text-gray-400 border-b border-gray-800">
									<tr>
										<th className="px-6 py-4 w-20 text-center">Rank</th>
										<th className="px-6 py-4">User</th>
										<th className="px-6 py-4">Score</th>
										<th className="px-6 py-4">Best Language</th>
										<th className="px-6 py-4">Solved Time</th>
										<th className="px-6 py-4 text-right pr-12">Country</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-800">
									{leaderboard.map((player, idx) => {
										const rank = idx + 1;
										return (
											<tr key={player.uid} className="hover:bg-dark-fill-2/45 transition">
												<td className="px-6 py-4 text-center font-bold text-gray-400">{rank}</td>
												<td className="px-6 py-4">
													<div className="flex items-center gap-3">
														{player.avatarUrl ? (
															<img
																src={player.avatarUrl}
																alt="Avatar"
																className="w-7 h-7 rounded-full object-cover border border-gray-700"
															/>
														) : (
															<div className="w-7 h-7 rounded-full bg-dark-fill-3 border border-gray-800 flex items-center justify-center text-gray-500">
																<FaGlobe size={11} />
															</div>
														)}
														<span className="font-bold text-white">{player.displayName}</span>
													</div>
												</td>
												<td className="px-6 py-4 font-bold text-green-500">{player.score.toFixed(2)}</td>
												<td className="px-6 py-4 font-mono text-xs text-gray-400">{formatLanguage(player.language)}</td>
												<td className="px-6 py-4 text-xs text-gray-500">{formatRelativeTime(player.timestamp)}</td>
												<td className="px-6 py-4 text-right pr-10">
													<div className="inline-flex items-center gap-1.5 text-xs text-gray-450 select-none">
														<span className="text-lg">🇻🇳</span>
														<span className="font-semibold text-gray-300">Vietnam</span>
													</div>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						)}
					</div>
				)}

				{/* Discussions Tab Content */}
				{activeTab === "discussions" && (
					<ProblemDiscussions problemId={problem.id} problemTitle={problem.title} lightTheme={false} />
				)}

				{/* Editorial Tab Content */}
				{activeTab === "editorial" && (
					<div className="bg-dark-layer-2 border border-gray-850 rounded-lg p-8 shadow-lg min-h-[400px]">
						<div className="max-w-4xl mx-auto space-y-6">
							<h3 className="text-2xl font-light text-white pb-3 border-b border-gray-800">
								Official Editorial
							</h3>
							
							{problem.editorial?.videoUrl && (
								<div className="space-y-3">
									<h4 className="text-sm font-bold text-gray-305">Video Walkthrough</h4>
									<div className="aspect-video w-full max-w-2xl mx-auto overflow-hidden rounded-lg border border-gray-800 bg-black">
										<iframe
											src={getEmbedUrl(problem.editorial.videoUrl)}
											title="Video solution"
											frameBorder="0"
											allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
											allowFullScreen
											className="w-full h-full"
										/>
									</div>
								</div>
							)}

							<div className="text-sm leading-relaxed text-gray-200 mt-4 prose prose-invert">
								{problem.editorial?.markdown ? (
									<div dangerouslySetInnerHTML={{ __html: renderMarkdown(problem.editorial.markdown, false) }} />
								) : (
									<p className="text-gray-500 italic text-center py-12">
										No official editorial has been published for this problem yet.
									</p>
								)}
							</div>
						</div>
					</div>
				)}
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
	const inlineClass = lightTheme
		? "bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs text-red-650"
		: "bg-dark-fill-3 px-1.5 py-0.5 rounded font-mono text-xs text-red-400";
	html = html.replace(/`(.*?)`/g, `<code class='${inlineClass}'>$1</code>`);
	// Code Blocks
	const preClass = lightTheme
		? "bg-gray-50 p-3 rounded-lg font-mono text-xs border border-gray-200 overflow-auto my-2.5 whitespace-pre text-gray-750"
		: "bg-black/45 p-3 rounded-lg font-mono text-xs border border-gray-850 overflow-auto my-2.5 whitespace-pre text-gray-300";
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
