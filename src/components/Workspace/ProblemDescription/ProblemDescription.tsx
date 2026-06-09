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

type ProblemDescriptionProps = {
	problem: Problem;
	_solved: boolean;
	lightTheme?: boolean;
};

const ProblemDescription: React.FC<ProblemDescriptionProps> = ({ problem, _solved, lightTheme = false }) => {
	const [user] = useAuthState(auth);
	const { currentProblem, loading, problemDifficultyClass, setCurrentProblem } = useGetCurrentProblem(problem.id);
	const { liked, disliked, solved, setData, starred } = useGetUsersDataOnProblem(problem.id);
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
		<div className={`flex flex-col w-full ${lightTheme ? "bg-white text-gray-800" : "bg-dark-layer-1 text-white"}`}>
			{/* Render simple header only if NOT in lightTheme workspace (since Workspace has its own header) */}
			{!lightTheme && (
				<div className='flex h-11 w-full items-center pt-2 bg-dark-layer-2 text-white overflow-x-auto'>
					<div className={"bg-dark-layer-1 rounded-t-[5px] px-5 py-[10px] text-xs cursor-pointer"}>
						Description
					</div>
				</div>
			)}

			<div className={`flex px-0 py-4 ${lightTheme ? "" : "h-[calc(100vh-94px)] overflow-y-auto"}`}>
				<div className={lightTheme ? "w-full" : "px-5 w-full"}>
					{/* Problem heading */}
					{!lightTheme && (
						<div className='w-full'>
							<div className='flex space-x-4'>
								<div className='flex-1 mr-2 text-lg text-white font-medium'>{problem?.title}</div>
							</div>
							{!loading && currentProblem && (
								<div className='flex items-center mt-3'>
									<div
										className={`${problemDifficultyClass} inline-block rounded-[21px] bg-opacity-[.15] px-2.5 py-1 text-xs font-medium capitalize `}
									>
										{currentProblem.difficulty}
									</div>
									{(solved || _solved) && (
										<div className='rounded p-[3px] ml-4 text-lg transition-colors duration-200 text-green-s text-dark-green-s'>
											<BsCheck2Circle />
										</div>
									)}
									<div
										className='flex items-center cursor-pointer hover:bg-dark-fill-3 space-x-1 rounded p-[3px]  ml-4 text-lg transition-colors duration-200 text-dark-gray-6 relative'
										onClick={handleLike}
									>
										{liked && !updating && <AiFillLike className='text-blue-500' />}
										{!liked && !updating && <AiFillLike />}
										{updating && <AiOutlineLoading3Quarters className='animate-spin' />}

										<span className='text-xs'>{currentProblem.likes}</span>
										{loginTooltipTarget === "like" && (
											<span className='absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-0.5 rounded shadow border border-gray-750 font-semibold whitespace-nowrap z-10 animate-fade-in'>
												Sign in first
											</span>
										)}
									</div>
									<div
										className='flex items-center cursor-pointer hover:bg-dark-fill-3 space-x-1 rounded p-[3px]  ml-4 text-lg transition-colors duration-200 text-green-s text-dark-gray-6 relative'
										onClick={handleDislike}
									>
										{disliked && !updating && <AiFillDislike className='text-red-500' />}
										{!disliked && !updating && <AiFillDislike />}
										{updating && <AiOutlineLoading3Quarters className='animate-spin' />}

										<span className='text-xs'>{currentProblem.dislikes}</span>
										{loginTooltipTarget === "dislike" && (
											<span className='absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-0.5 rounded shadow border border-gray-750 font-semibold whitespace-nowrap z-10 animate-fade-in'>
												Sign in first
											</span>
										)}
									</div>
									<div
										className='cursor-pointer hover:bg-dark-fill-3 rounded p-[3px] ml-4 text-xl transition-all duration-200 ease-out active:scale-95 transform shrink-0 relative'
										onClick={handleStar}
									>
										{starred && !updating && <AiFillStar className='text-amber-500' />}
										{!starred && !updating && <TiStarOutline />}
										{updating && <AiOutlineLoading3Quarters className='animate-spin text-amber-500' />}

										{loginTooltipTarget === "star" && (
											<span className='absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-0.5 rounded shadow border border-gray-750 font-semibold whitespace-nowrap z-10 animate-fade-in'>
												Sign in first
											</span>
										)}
									</div>
								</div>
							)}

							{loading && (
								<div className='mt-3 flex space-x-2'>
									<RectangleSkeleton />
									<CircleSkeleton />
									<RectangleSkeleton />
									<RectangleSkeleton />
									<CircleSkeleton />
								</div>
							)}
						</div>
					)}

					{/* Problem Statement */}
					<div className={`text-sm leading-relaxed ${lightTheme ? "text-gray-700 font-sans" : "text-white mt-4"}`}>
						<div dangerouslySetInnerHTML={{ __html: renderMarkdown(problem.problemStatement, lightTheme) }} />
					</div>

					{/* Input Format */}
					{problem.inputFormat && (
						<div className='mt-6 text-sm'>
							<div className={`font-bold pb-1.5 mb-2 border-b ${
								lightTheme ? "text-gray-800 border-gray-200" : "text-gray-200 border-gray-800"
							}`}>Input Format</div>
							<div className={lightTheme ? "text-gray-700" : "text-white"} dangerouslySetInnerHTML={{ __html: renderMarkdown(problem.inputFormat, lightTheme) }} />
						</div>
					)}

					{/* Constraints */}
					{problem.constraints && (
						<div className='mt-6 text-sm'>
							<div className={`font-bold pb-1.5 mb-2 border-b ${
								lightTheme ? "text-gray-800 border-gray-200" : "text-gray-200 border-gray-800"
							}`}>Constraints</div>
							<div className={lightTheme ? "text-gray-700" : "text-white"} dangerouslySetInnerHTML={{ __html: renderMarkdown(problem.constraints, lightTheme) }} />
						</div>
					)}

					{/* Output Format */}
					{problem.outputFormat && (
						<div className='mt-6 text-sm'>
							<div className={`font-bold pb-1.5 mb-2 border-b ${
								lightTheme ? "text-gray-800 border-gray-200" : "text-gray-200 border-gray-800"
							}`}>Output Format</div>
							<div className={lightTheme ? "text-gray-700" : "text-white"} dangerouslySetInnerHTML={{ __html: renderMarkdown(problem.outputFormat, lightTheme) }} />
						</div>
					)}

					{/* Examples/Samples Section */}
					<div className='mt-6'>
						{problem.examples.filter(ex => !!ex.isSample).map((example, index) => (
							<div key={example.id} className='mb-6 select-none'>
								<p className={`font-bold text-sm mb-2 ${lightTheme ? "text-gray-750" : "text-gray-200"}`}>
									Sample Input {index}
								</p>
								<pre className={`p-4 rounded border font-mono text-xs whitespace-pre-wrap mb-4 ${
									lightTheme
										? "bg-[#f5f7fa] border-gray-250 text-gray-800"
										: "bg-dark-fill-3 border-gray-800 text-gray-300"
								}`}>
									{example.inputText}
								</pre>
								<p className={`font-bold text-sm mb-2 ${lightTheme ? "text-gray-750" : "text-gray-200"}`}>
									Sample Output {index}
								</p>
								<pre className={`p-4 rounded border font-mono text-xs whitespace-pre-wrap mb-4 ${
									lightTheme
										? "bg-[#f5f7fa] border-gray-250 text-gray-800"
										: "bg-dark-fill-3 border-gray-800 text-gray-300"
								}`}>
									{example.outputText}
								</pre>
								{example.explanation && (
									<>
										<p className={`font-bold text-sm mb-1.5 ${lightTheme ? "text-gray-750" : "text-gray-200"}`}>
											Explanation {index}
										</p>
										<div
											className={`text-sm ${lightTheme ? "text-gray-700" : "text-gray-300"}`}
											dangerouslySetInnerHTML={{ __html: renderMarkdown(example.explanation, lightTheme) }}
										/>
									</>
								)}
							</div>
						))}
					</div>

					{/* Tags badges */}
					{problem.tags && problem.tags.length > 0 && (
						<div className={`flex flex-wrap gap-2 mt-8 pt-4 border-t select-none ${
							lightTheme ? "border-gray-200" : "border-gray-800/60"
						}`}>
							{problem.tags.map((tag, idx) => (
								<span
									key={idx}
									className={
										lightTheme
											? "bg-[#edf4eb] text-[#1ba94c] border border-[#d2e7d7] px-2.5 py-0.5 rounded text-xs font-semibold font-mono"
											: "bg-[#3a442e] text-[#8bcd52] border border-[#4d6138] px-2.5 py-0.5 rounded text-xs font-semibold"
									}
								>
									{lightTheme ? `.${tag.toLowerCase()}` : tag}
								</span>
							))}
						</div>
					)}
				</div>
			</div>
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
						? "bg-olive text-olive"
						: problem.difficulty === "Medium"
						? "bg-dark-yellow text-dark-yellow"
						: " bg-dark-pink text-dark-pink"
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
