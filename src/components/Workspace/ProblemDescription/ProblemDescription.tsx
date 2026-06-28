import CircleSkeleton from "@/components/Skeletons/CircleSkeleton";
import RectangleSkeleton from "@/components/Skeletons/RectangleSkeleton";
import { auth, firestore } from "@/firebase/firebase";
import { DBProblem, Problem } from "@/utils/types/problem";
import { arrayRemove, arrayUnion, doc, getDoc, runTransaction, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { AiFillLike, AiFillDislike, AiOutlineLoading3Quarters, AiFillStar } from "react-icons/ai";
import { BsCheck2Circle } from "react-icons/bs";
import { TiStarOutline } from "react-icons/ti";
import { FaCheck, FaGlobe } from "react-icons/fa";

type ProblemDescriptionProps = {
	problem: Problem;
	_solved: boolean;
	lightTheme?: boolean;
	activeLanguage: string;
	translating: boolean;
	handleTranslate: (langCode: string) => Promise<void>;
};

const ProblemDescription: React.FC<ProblemDescriptionProps> = ({
	problem,
	_solved,
	lightTheme = false,
	activeLanguage,
	translating,
	handleTranslate,
}) => {
	const [user] = useAuthState(auth);
	const { currentProblem, loading, problemDifficultyClass, setCurrentProblem } = useGetCurrentProblem(problem.id);
	const { liked, disliked, solved, setData, starred } = useGetUsersDataOnProblem(problem.id);
	const [dropdownOpen, setDropdownOpen] = useState(false);

	const LANGUAGES = [
		{ code: "en", name: "English (Original)" },
		{ code: "vi", name: "Tiếng Việt (Vietnamese)" },
		{ code: "es", name: "Español (Spanish)" },
		{ code: "ja", name: "日本語 (Japanese)" },
		{ code: "zh-CN", name: "简体中文 (Chinese)" },
		{ code: "fr", name: "Français (French)" },
		{ code: "ko", name: "한국어 (Korean)" },
	];
	const [updating, setUpdating] = useState(false);
	const [loginTooltipTarget, setLoginTooltipTarget] = useState<"like" | "dislike" | "star" | null>(null);

	const returnUserDataAndProblemData = async (transaction: any) => {
		const userRef = doc(firestore, "users", user!.uid);
		const problemRef = doc(firestore, "problems", problem.id);
		const userDoc = await transaction.get(userRef);
		const problemDoc = await transaction.get(problemRef);
		return { userDoc, problemDoc, userRef, problemRef };
	};

	const handleLike = async () => {
		if (!user) {
			setLoginTooltipTarget("like");
			setTimeout(() => setLoginTooltipTarget(null), 2000);
			return;
		}
		if (updating) return;
		setUpdating(true);
		await runTransaction(firestore, async (transaction) => {
			const { problemDoc, userDoc, problemRef, userRef } = await returnUserDataAndProblemData(transaction);

			if (userDoc.exists() && problemDoc.exists()) {
				const userLikedProblems = userDoc.data().likedProblems || [];
				const userDislikedProblems = userDoc.data().dislikedProblems || [];
				const problemLikes = problemDoc.data().likes || 0;
				const problemDislikes = problemDoc.data().dislikes || 0;

				if (liked) {
					transaction.update(userRef, {
						likedProblems: userLikedProblems.filter((id: string) => id !== problem.id),
					});
					transaction.update(problemRef, {
						likes: problemLikes - 1,
					});

					setCurrentProblem((prev) => (prev ? { ...prev, likes: (prev.likes || 0) - 1 } : null));
					setData((prev) => ({ ...prev, liked: false }));
				} else if (disliked) {
					transaction.update(userRef, {
						likedProblems: [...userLikedProblems, problem.id],
						dislikedProblems: userDislikedProblems.filter((id: string) => id !== problem.id),
					});
					transaction.update(problemRef, {
						likes: problemLikes + 1,
						dislikes: problemDislikes - 1,
					});

					setCurrentProblem((prev) =>
						prev ? { ...prev, likes: (prev.likes || 0) + 1, dislikes: (prev.dislikes || 0) - 1 } : null
					);
					setData((prev) => ({ ...prev, liked: true, disliked: false }));
				} else {
					transaction.update(userRef, {
						likedProblems: [...userLikedProblems, problem.id],
					});
					transaction.update(problemRef, {
						likes: problemLikes + 1,
					});
					setCurrentProblem((prev) => (prev ? { ...prev, likes: (prev.likes || 0) + 1 } : null));
					setData((prev) => ({ ...prev, liked: true }));
				}
			}
		});
		setUpdating(false);
	};

	const handleDislike = async () => {
		if (!user) {
			setLoginTooltipTarget("dislike");
			setTimeout(() => setLoginTooltipTarget(null), 2000);
			return;
		}
		if (updating) return;
		setUpdating(true);
		await runTransaction(firestore, async (transaction) => {
			const { problemDoc, userDoc, problemRef, userRef } = await returnUserDataAndProblemData(transaction);
			if (userDoc.exists() && problemDoc.exists()) {
				const userLikedProblems = userDoc.data().likedProblems || [];
				const userDislikedProblems = userDoc.data().dislikedProblems || [];
				const problemLikes = problemDoc.data().likes || 0;
				const problemDislikes = problemDoc.data().dislikes || 0;

				if (disliked) {
					transaction.update(userRef, {
						dislikedProblems: userDislikedProblems.filter((id: string) => id !== problem.id),
					});
					transaction.update(problemRef, {
						dislikes: problemDislikes - 1,
					});

					setCurrentProblem((prev) => (prev ? { ...prev, dislikes: (prev.dislikes || 0) - 1 } : null));
					setData((prev) => ({ ...prev, disliked: false }));
				} else if (liked) {
					transaction.update(userRef, {
						dislikedProblems: [...userDislikedProblems, problem.id],
						likedProblems: userLikedProblems.filter((id: string) => id !== problem.id),
					});
					transaction.update(problemRef, {
						dislikes: problemDislikes + 1,
						likes: problemLikes - 1,
					});

					setCurrentProblem((prev) =>
						prev ? { ...prev, dislikes: (prev.dislikes || 0) + 1, likes: (prev.likes || 0) - 1 } : null
					);
					setData((prev) => ({ ...prev, disliked: true, liked: false }));
				} else {
					transaction.update(userRef, {
						dislikedProblems: [...userDislikedProblems, problem.id],
					});
					transaction.update(problemRef, {
						dislikes: problemDislikes + 1,
					});
					setCurrentProblem((prev) => (prev ? { ...prev, dislikes: (prev.dislikes || 0) + 1 } : null));
					setData((prev) => ({ ...prev, disliked: true }));
				}
			}
		});
		setUpdating(false);
	};

	const handleStar = async () => {
		if (!user) {
			setLoginTooltipTarget("star");
			setTimeout(() => setLoginTooltipTarget(null), 2000);
			return;
		}
		if (updating) return;
		setUpdating(true);
		
		// Optimistic update
		const newStarred = !starred;
		setData((prev) => ({ ...prev, starred: newStarred }));

		try {
			const userRef = doc(firestore, "users", user.uid);
			if (!newStarred) {
				await updateDoc(userRef, {
					starredProblems: arrayRemove(problem.id),
				});
			} else {
				await updateDoc(userRef, {
					starredProblems: arrayUnion(problem.id),
				});
			}
		} catch (error) {
			console.error("Error starring problem:", error);
			// Revert if error
			setData((prev) => ({ ...prev, starred: !newStarred }));
		}
		setUpdating(false);
	};

	return (
		<div className="w-full text-text-primary" style={{ backgroundColor: "transparent" }}>
			<div className="w-full space-y-8">
				{/* Actions and Status Bar */}
				<div className="flex items-center justify-between flex-wrap gap-4 pb-6 border-b border-border-subtle select-none" style={{ borderColor: "var(--border-subtle)" }}>
					<div className="flex items-center gap-3">
						{/* Solved Indicator */}
						{(solved || _solved) && (
							<div
								className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold select-none shadow-[0_0_10px_rgba(16,185,129,0.15)] transition-all duration-300"
								style={{
									color: "var(--color-success)",
									backgroundColor: "color-mix(in srgb, var(--color-success) 10%, transparent)",
									border: "1px solid color-mix(in srgb, var(--color-success) 20%, transparent)",
								}}
							>
								<BsCheck2Circle size={14} />
								<span>SOLVED</span>
							</div>
						)}

						{/* Translation Selector Dropdown */}
						<div className="relative">
							<button
								onClick={() => setDropdownOpen(!dropdownOpen)}
								className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-250 cursor-pointer active:scale-95 select-none"
								style={{
									backgroundColor: "var(--bg-surface)",
									borderColor: "var(--border-subtle)",
									color: "var(--text-secondary)",
								}}
							>
								{translating ? (
									<AiOutlineLoading3Quarters size={12} className="animate-spin text-brand-orange" />
								) : (
									<FaGlobe size={12} className={activeLanguage !== "en" ? "text-brand-orange" : ""} />
								)}
								<span>
									{LANGUAGES.find((l) => l.code === activeLanguage)?.name.split(" ")[0]}
								</span>
								<svg
									className={`w-3.5 h-3.5 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
								</svg>
							</button>

							{dropdownOpen && (
								<>
									{/* Click backdrop to close */}
									<div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
									<div
										className="absolute left-0 mt-2 w-56 rounded-xl border shadow-xl z-50 overflow-hidden animate-fade-in py-1"
										style={{
											backgroundColor: "var(--bg-surface)",
											borderColor: "var(--border-default)",
										}}
									>
										<div className="px-3 py-2 text-[10px] uppercase font-bold tracking-wider border-b mb-1 select-none" style={{ color: "var(--text-muted)", borderColor: "var(--border-subtle)" }}>
											Translate Problem
										</div>
										{LANGUAGES.map((lang) => {
											const isSelected = activeLanguage === lang.code;
											return (
												<button
													key={lang.code}
													onClick={async () => {
														setDropdownOpen(false);
														await handleTranslate(lang.code);
													}}
													className={`w-full text-left px-4 py-2 text-xs font-semibold flex items-center justify-between transition-colors duration-150 cursor-pointer ${
														isSelected
															? "text-brand-orange bg-brand-orange/10"
															: "text-text-primary bg-transparent hover:bg-dark-hover"
													}`}
												>
													<span>{lang.name}</span>
													{isSelected && <FaCheck size={10} className="text-brand-orange" />}
												</button>
											);
										})}
									</div>
								</>
							)}
						</div>
					</div>

					{/* Feedback Actions */}
					{!loading && currentProblem && (
						<div className="flex items-center gap-2">
							{/* Like Button */}
							<button
								onClick={handleLike}
								disabled={updating}
								className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 hover:scale-105 active:scale-95"
								style={{
									color: liked ? "var(--brand-orange)" : "var(--text-muted)",
									backgroundColor: liked ? "color-mix(in srgb, var(--brand-orange) 10%, transparent)" : "transparent",
									border: liked ? "1px solid color-mix(in srgb, var(--brand-orange) 20%, transparent)" : "1px solid transparent",
								}}
							>
								{liked && !updating && <AiFillLike size={14} className="text-shadow-glow" />}
								{!liked && !updating && <AiFillLike size={14} />}
								{updating && <AiOutlineLoading3Quarters size={12} className="animate-spin" />}
								<span>{currentProblem.likes}</span>
							</button>

							{/* Dislike Button */}
							<button
								onClick={handleDislike}
								disabled={updating}
								className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 hover:scale-105 active:scale-95"
								style={{
									color: disliked ? "var(--color-error)" : "var(--text-muted)",
									backgroundColor: disliked ? "color-mix(in srgb, var(--color-error) 10%, transparent)" : "transparent",
									border: disliked ? "1px solid color-mix(in srgb, var(--color-error) 20%, transparent)" : "1px solid transparent",
								}}
							>
								{disliked && !updating && <AiFillDislike size={14} />}
								{!disliked && !updating && <AiFillDislike size={14} />}
								{updating && <AiOutlineLoading3Quarters size={12} className="animate-spin" />}
								<span>{currentProblem.dislikes}</span>
							</button>

							{/* Star Button */}
							<button
								onClick={handleStar}
								disabled={updating}
								className="flex items-center p-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
								style={{
									color: starred ? "var(--brand-orange)" : "var(--text-muted)",
									backgroundColor: starred ? "color-mix(in srgb, var(--brand-orange) 10%, transparent)" : "transparent",
									border: starred ? "1px solid color-mix(in srgb, var(--brand-orange) 20%, transparent)" : "1px solid transparent",
								}}
							>
								{starred && !updating && <AiFillStar size={16} />}
								{!starred && !updating && <TiStarOutline size={18} />}
								{updating && <AiOutlineLoading3Quarters size={12} className="animate-spin" />}
							</button>
						</div>
					)}
				</div>

				{/* Problem Statement Markdown */}
				<div className="prose prose-invert max-w-none prose-headings:text-text-primary prose-headings:font-semibold prose-headings:mt-10 prose-headings:mb-4 prose-p:text-text-secondary prose-p:leading-relaxed prose-p:text-base prose-strong:text-text-primary prose-strong:font-semibold select-text">
					<div dangerouslySetInnerHTML={{ __html: renderMarkdown(problem.problemStatement, false) }} />
				</div>

				{/* Input Format */}
				{problem.inputFormat && (
					<div className="space-y-3 pt-6 border-t border-border-subtle" style={{ borderColor: "var(--border-subtle)" }}>
						<h3 className="text-lg font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Input Format</h3>
						<div className="prose prose-invert max-w-none prose-p:text-text-secondary prose-p:leading-relaxed select-text">
							<div dangerouslySetInnerHTML={{ __html: renderMarkdown(problem.inputFormat, false) }} />
						</div>
					</div>
				)}

				{/* Constraints */}
				{problem.constraints && (
					<div className="space-y-3 pt-6 border-t border-border-subtle" style={{ borderColor: "var(--border-subtle)" }}>
						<h3 className="text-lg font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Constraints</h3>
						<div className="prose prose-invert max-w-none prose-p:text-text-secondary prose-p:leading-relaxed select-text">
							<div dangerouslySetInnerHTML={{ __html: renderMarkdown(problem.constraints, false) }} />
						</div>
					</div>
				)}

				{/* Output Format */}
				{problem.outputFormat && (
					<div className="space-y-3 pt-6 border-t border-border-subtle" style={{ borderColor: "var(--border-subtle)" }}>
						<h3 className="text-lg font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Output Format</h3>
						<div className="prose prose-invert max-w-none prose-p:text-text-secondary prose-p:leading-relaxed select-text">
							<div dangerouslySetInnerHTML={{ __html: renderMarkdown(problem.outputFormat, false) }} />
						</div>
					</div>
				)}

				{/* Examples / Samples Section */}
				<div className="space-y-8 pt-8 border-t border-border-subtle" style={{ borderColor: "var(--border-subtle)" }}>
					{problem.examples.filter(ex => !!ex.isSample).map((example, index) => (
						<ExampleBlock key={example.id || index} example={example} index={index} />
					))}
				</div>

				{/* Tags Badges */}
				{problem.tags && problem.tags.length > 0 && (
					<div className="flex flex-wrap gap-2 mt-8 pt-6 border-t select-none" style={{ borderColor: "var(--border-subtle)" }}>
						{problem.tags.map((tag, idx) => (
							<span
								key={idx}
								className="px-3 py-1 rounded-lg text-xs font-semibold font-mono"
								style={{
									color: "var(--brand-orange)",
									backgroundColor: "color-mix(in srgb, var(--brand-orange) 8%, transparent)",
									border: "1px solid color-mix(in srgb, var(--brand-orange) 15%, transparent)",
								}}
							>
								{tag}
							</span>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

// Sleek Copyable Example Block component
const ExampleBlock: React.FC<{ example: any; index: number }> = ({ example, index }) => {
	const [copiedInput, setCopiedInput] = useState(false);
	const [copiedOutput, setCopiedOutput] = useState(false);

	const handleCopy = async (text: string, type: "input" | "output") => {
		try {
			await navigator.clipboard.writeText(text);
			if (type === "input") {
				setCopiedInput(true);
				setTimeout(() => setCopiedInput(false), 2000);
			} else {
				setCopiedOutput(true);
				setTimeout(() => setCopiedOutput(false), 2000);
			}
		} catch (err) {
			console.error("Failed to copy text:", err);
		}
	};

	return (
		<div className="space-y-6">
			{/* Sample Input */}
			<div className="space-y-2">
				<p className="text-sm font-semibold tracking-tight" style={{ color: "var(--text-secondary)" }}>
					Sample Input {index}
				</p>
				<div className="relative group rounded-xl overflow-hidden border transition-all duration-200 hover:border-border-strong" style={{ backgroundColor: "var(--bg-base)", borderColor: "var(--border-default)" }}>
					<button
						onClick={() => handleCopy(example.inputText, "input")}
						className="absolute top-3.5 right-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow"
						style={{
							backgroundColor: "var(--bg-surface)",
							border: "1px solid var(--border-subtle)",
							color: "var(--text-secondary)",
						}}
					>
						{copiedInput ? (
							<>
								<FaCheck size={10} style={{ color: "var(--color-success)" }} />
								<span style={{ color: "var(--color-success)" }}>Copied!</span>
							</>
						) : (
							<span className="opacity-80">Copy</span>
						)}
					</button>
					<pre className="p-5 font-mono text-sm leading-6 whitespace-pre-wrap select-text" style={{ color: "var(--text-primary)" }}>
						{example.inputText}
					</pre>
				</div>
			</div>

			{/* Sample Output */}
			<div className="space-y-2">
				<p className="text-sm font-semibold tracking-tight" style={{ color: "var(--text-secondary)" }}>
					Sample Output {index}
				</p>
				<div className="relative group rounded-xl overflow-hidden border transition-all duration-200 hover:border-border-strong" style={{ backgroundColor: "var(--bg-base)", borderColor: "var(--border-default)" }}>
					<button
						onClick={() => handleCopy(example.outputText, "output")}
						className="absolute top-3.5 right-3.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow"
						style={{
							backgroundColor: "var(--bg-surface)",
							border: "1px solid var(--border-subtle)",
							color: "var(--text-secondary)",
						}}
					>
						{copiedOutput ? (
							<>
								<FaCheck size={10} style={{ color: "var(--color-success)" }} />
								<span style={{ color: "var(--color-success)" }}>Copied!</span>
							</>
						) : (
							<span className="opacity-80">Copy</span>
						)}
					</button>
					<pre className="p-5 font-mono text-sm leading-6 whitespace-pre-wrap select-text" style={{ color: "var(--text-primary)" }}>
						{example.outputText}
					</pre>
				</div>
			</div>

			{/* Explanation */}
			{example.explanation && (
				<div className="space-y-2">
					<p className="text-sm font-semibold tracking-tight" style={{ color: "var(--text-secondary)" }}>
						Explanation {index}
					</p>
					<div
						className="text-sm leading-relaxed"
						style={{ color: "var(--text-secondary)" }}
						dangerouslySetInnerHTML={{ __html: renderMarkdown(example.explanation, false) }}
					/>
				</div>
			)}
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

export default ProblemDescription;

function useGetCurrentProblem(problemId: string) {
	const [currentProblem, setCurrentProblem] = useState<DBProblem | null>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const [problemDifficultyClass, setProblemDifficultyClass] = useState<string>("");

	useEffect(() => {
		const getCurrentProblem = async () => {
			setLoading(true);
			const docRef = doc(firestore, "problems", problemId);
			const docSnap = await getDoc(docRef);
			if (docSnap.exists()) {
				const problem = docSnap.data();
				setCurrentProblem({ id: docSnap.id, ...problem } as DBProblem);
				setProblemDifficultyClass(
					problem.difficulty === "Easy"
						? "bg-bc-success/15 text-bc-success"
						: problem.difficulty === "Medium"
						? "bg-bc-warning/15 text-bc-warning"
						: "bg-bc-error/15 text-bc-error"
				);
			}
			setLoading(false);
		};
		getCurrentProblem();
	}, [problemId]);

	return { currentProblem, loading, problemDifficultyClass, setCurrentProblem };
}

function useGetUsersDataOnProblem(problemId: string) {
	const [data, setData] = useState({ liked: false, disliked: false, starred: false, solved: false });
	const [user] = useAuthState(auth);

	useEffect(() => {
		const getUsersDataOnProblem = async () => {
			const userRef = doc(firestore, "users", user!.uid);
			const userSnap = await getDoc(userRef);
			if (userSnap.exists()) {
				const data = userSnap.data();
				const solvedProblems = data.solvedProblems || [];
				const likedProblems = data.likedProblems || [];
				const dislikedProblems = data.dislikedProblems || [];
				const starredProblems = data.starredProblems || [];
				setData({
					liked: likedProblems.includes(problemId),
					disliked: dislikedProblems.includes(problemId),
					starred: starredProblems.includes(problemId),
					solved: solvedProblems.includes(problemId),
				});
			}
		};

		if (user) getUsersDataOnProblem();
		return () => setData({ liked: false, disliked: false, starred: false, solved: false });
	}, [problemId, user]);

	return { ...data, setData };
}
