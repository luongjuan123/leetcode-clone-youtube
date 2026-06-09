import { useState, useEffect } from "react";
import PreferenceNav from "./PreferenceNav/PreferenceNav";
import Split from "react-split";
import CodeMirror from "@uiw/react-codemirror";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import EditorFooter from "./EditorFooter";
import { Problem } from "@/utils/types/problem";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, firestore } from "@/firebase/firebase";
import { useRouter } from "next/router";
import { arrayUnion, doc, updateDoc, addDoc, collection } from "firebase/firestore";
import useLocalStorage from "@/hooks/useLocalStorage";
import { SupportedLanguage, starterCodes, runPistonCode, TestCaseResult } from "@/utils/pistonRunner";

type PlaygroundProps = {
	problem: Problem;
	setSuccess: React.Dispatch<React.SetStateAction<boolean>>;
	setSolved: React.Dispatch<React.SetStateAction<boolean>>;
	lightTheme?: boolean;
};

export interface ISettings {
	fontSize: string;
	settingsModalIsOpen: boolean;
	dropdownIsOpen: boolean;
}

const Playground: React.FC<PlaygroundProps> = ({ problem, setSuccess, setSolved, lightTheme = false }) => {
	const [activeTestCaseId, setActiveTestCaseId] = useState<number>(0);
	const [language, setLanguage] = useState<SupportedLanguage>("javascript");
	const [userCode, setUserCode] = useState<string>(problem.starterCode);
	const [fontSize, setFontSize] = useLocalStorage("lcc-fontSize", "16px");

	const [settings, setSettings] = useState<ISettings>({
		fontSize: fontSize,
		settingsModalIsOpen: false,
		dropdownIsOpen: false,
	});

	// Custom Input State
	const [customInputChecked, setCustomInputChecked] = useState(false);
	const [customInputText, setCustomInputText] = useState("");

	// Submission state variables
	const [activeTab, setActiveTab] = useState<"testcases" | "submission">("testcases");
	const [submissionStatus, setSubmissionStatus] = useState<
		"idle" | "submitting" | "compiling" | "running" | "accepted" | "compile_error" | "wrong_answer" | "error"
	>("idle");
	const [submissionMessage, setSubmissionMessage] = useState<string>("");
	const [failedCaseIndex, setFailedCaseIndex] = useState<number | null>(null);
	const [failedCaseDetails, setFailedCaseDetails] = useState<{
		input?: string;
		expected?: string;
		actual?: string;
	} | null>(null);
	const [testResults, setTestResults] = useState<TestCaseResult[]>([]);
	const [passedCount, setPassedCount] = useState<number>(0);
	const [totalCount, setTotalCount] = useState<number>(0);
	const [wasCustomInputRun, setWasCustomInputRun] = useState(false);
	const [selectedTestCaseIndex, setSelectedTestCaseIndex] = useState<number>(0);
	const [executingType, setExecutingType] = useState<"run" | "submit" | null>(null);

	const [user, loading] = useAuthState(auth);
	const {
		query: { pid },
	} = useRouter();

	const handleExecute = async (isSubmit: boolean) => {
		if (!user) {
			setActiveTab("submission");
			setSubmissionStatus("error");
			setSubmissionMessage("Please login to run or submit your code");
			return;
		}

		setExecutingType(isSubmit ? "submit" : "run");

		// Switch to submission tab
		setActiveTab("submission");
		setWasCustomInputRun(customInputChecked);
		setSubmissionStatus("submitting");
		setSubmissionMessage("");
		setFailedCaseIndex(null);
		setFailedCaseDetails(null);
		setTestResults([]);
		setPassedCount(0);
		setTotalCount(0);

		try {
			await new Promise((resolve) => setTimeout(resolve, 300));
			setSubmissionStatus("compiling");
			await new Promise((resolve) => setTimeout(resolve, 400));
			setSubmissionStatus("running");

			let testcasesToRun = problem.examples;
			if (customInputChecked) {
				testcasesToRun = [
					{
						id: 9999,
						inputText: customInputText,
						outputText: "",
					},
				];
			} else if (!isSubmit) {
				const samples = problem.examples.filter(ex => !!ex.isSample);
				testcasesToRun = samples.length > 0 ? samples : problem.examples.slice(0, 1);
			}

			const result = await runPistonCode(pid as string, userCode, language, testcasesToRun, customInputChecked);

			if (result.success) {
				setSubmissionStatus("accepted");
				setSubmissionMessage(isSubmit ? "All test cases passed successfully!" : "Code execution completed successfully!");
				const results = result.testResults || [];
				setTestResults(results);
				setPassedCount(result.passedCount ?? results.length ?? 0);
				setTotalCount(result.totalCount ?? results.length ?? 0);
				setSelectedTestCaseIndex(0);

				if (isSubmit) {
					setSuccess(true);
					setTimeout(() => {
						setSuccess(false);
					}, 4000);

					try {
						const userRef = doc(firestore, "users", user.uid);
						await updateDoc(userRef, {
							solvedProblems: arrayUnion(pid),
						});
						await addDoc(collection(firestore, "submissions"), {
							uid: user.uid,
							problemId: pid,
							problemTitle: problem.title,
							code: userCode,
							language: language,
							status: "passed",
							score: 100,
							timestamp: Date.now(),
							testResults: results,
						});
					} catch (dbError) {
						console.error("Error updating solved problems/submissions in firestore:", dbError);
					}
					setSolved(true);
				}
			} else {
				const results = result.testResults || [];
				setTestResults(results);
				const pCount = result.passedCount ?? 0;
				const tCount = result.totalCount ?? testcasesToRun.length;
				setPassedCount(pCount);
				setTotalCount(tCount);

				if (result.isCompileError) {
					setSubmissionStatus("compile_error");
					setSubmissionMessage(result.error || "Compilation failed.");
					setSelectedTestCaseIndex(0);
				} else {
					setSubmissionStatus("wrong_answer");
					setSubmissionMessage(result.error || "Wrong Answer");
					if (result.failedCaseIndex !== undefined) {
						setFailedCaseIndex(result.failedCaseIndex);
						setSelectedTestCaseIndex(result.failedCaseIndex - 1);
						setFailedCaseDetails({
							input: result.input,
							expected: result.expected,
							actual: result.actual,
						});
					} else {
						setSelectedTestCaseIndex(0);
					}
				}

				if (isSubmit) {
					try {
						const score = Math.round((pCount / (tCount || 1)) * 100);
						await addDoc(collection(firestore, "submissions"), {
							uid: user.uid,
							problemId: pid,
							problemTitle: problem.title,
							code: userCode,
							language: language,
							status: "failed",
							score: score,
							timestamp: Date.now(),
							testResults: results,
						});
					} catch (dbError) {
						console.error("Error logging failed submission in firestore:", dbError);
					}
				}
			}
		} catch (error: any) {
			console.error("Execution catch error:", error);
			setSubmissionStatus("error");
			setSubmissionMessage(error.message || "An unexpected error occurred.");
		} finally {
			setExecutingType(null);
		}
	};

	useEffect(() => {
		if (loading) return;
		const key = user ? `code-${user.uid}-${pid}-${language}` : `code-${pid}-${language}`;
		const code = localStorage.getItem(key);
		if (code) {
			setUserCode(JSON.parse(code));
		} else {
			const customStarter = starterCodes[pid as string]?.[language];
			setUserCode(customStarter || problem.starterCode);
		}
	}, [pid, language, problem.starterCode, user, loading]);

	const onChange = (value: string) => {
		setUserCode(value);
		if (loading) return;
		const key = user ? `code-${user.uid}-${pid}-${language}` : `code-${pid}-${language}`;
		localStorage.setItem(key, JSON.stringify(value));
	};

	const getExtensions = () => {
		switch (language) {
			case "javascript":
				return [javascript()];
			case "python":
				return [python()];
			case "cpp":
			case "c":
				return [cpp()];
			case "java":
				return [java()];
			default:
				return [javascript()];
		}
	};

	return (
		<div className={`flex flex-col relative w-full border rounded-lg overflow-hidden shadow-sm ${
			lightTheme ? "bg-white border-gray-300" : "bg-dark-layer-1 border-transparent"
		}`}>
			{/* preference nav */}
			<PreferenceNav
				settings={settings}
				setSettings={setSettings}
				language={language}
				setLanguage={setLanguage}
				lightTheme={lightTheme}
			/>

			{/* Custom Input Block */}
			{customInputChecked && (
				<div className={`p-4 border-b ${lightTheme ? "bg-gray-50 border-gray-300 text-gray-800" : "bg-dark-fill-3 text-white border-gray-800"}`}>
					<p className="text-xs font-semibold mb-2">Custom Input Text:</p>
					<textarea
						value={customInputText}
						onChange={(e) => setCustomInputText(e.target.value)}
						rows={3}
						className={`w-full text-xs font-mono p-3 rounded-lg outline-none border focus:ring-0 ${
							lightTheme
								? "bg-white text-gray-805 border-gray-350 focus:border-blue-500"
								: "bg-black/40 text-gray-250 border-gray-850 focus:border-brand-orange"
						}`}
						placeholder="Write custom input parameters here..."
					/>
				</div>
			)}

			<Split className="h-[460px]" direction="vertical" sizes={[65, 35]} minSize={100}>
				{/* Editor View */}
				<div className="w-full overflow-auto">
					<CodeMirror
						value={userCode}
						theme={lightTheme ? undefined : vscodeDark}
						onChange={onChange}
						extensions={getExtensions()}
						style={{ fontSize: settings.fontSize }}
					/>
				</div>

				{/* Console Results Panel */}
				<div className={`w-full px-5 overflow-auto pb-14 border-t ${
					lightTheme ? "bg-white text-gray-800 border-gray-250" : "bg-dark-layer-1 text-white border-gray-850"
				}`}>
					<div className={`flex h-10 items-center space-x-6 border-b mb-4 select-none ${
						lightTheme ? "border-gray-200" : "border-gray-805/40"
					} ${executingType !== null ? "animate-pulse" : ""}`}>
						<button
							onClick={() => setActiveTab("testcases")}
							className={`relative flex h-full flex-col justify-center cursor-pointer font-bold text-xs transition ${
								activeTab === "testcases"
									? (lightTheme ? "text-blue-600" : "text-white")
									: (lightTheme ? "text-gray-500 hover:text-gray-700" : "text-gray-500 hover:text-gray-300")
							}`}
						>
							Testcases
							{activeTab === "testcases" && (
								<hr className={`absolute bottom-0 h-0.5 w-full rounded-full border-none ${
									lightTheme ? "bg-blue-600" : "bg-brand-orange"
								}`} />
							)}
						</button>
						<button
							onClick={() => setActiveTab("submission")}
							className={`relative flex h-full flex-col justify-center cursor-pointer font-bold text-xs transition ${
								activeTab === "submission"
									? (lightTheme ? "text-blue-600" : "text-white")
									: (lightTheme ? "text-gray-500 hover:text-gray-700" : "text-gray-500 hover:text-gray-300")
							} ${["wrong_answer", "compile_error", "error"].includes(submissionStatus) ? "border-b-2 border-rose-500" : ""}`}
						>
							Submission Result
							{activeTab === "submission" && !["wrong_answer", "compile_error", "error"].includes(submissionStatus) && (
								<hr className={`absolute bottom-0 h-0.5 w-full rounded-full border-none ${
									lightTheme ? "bg-blue-600" : "bg-brand-orange"
								}`} />
							)}
						</button>
					</div>

					{activeTab === "testcases" ? (
						<>
							{(() => {
								const samples = problem.examples.filter(ex => !!ex.isSample);
								const visibleTestcases = samples.length > 0 ? samples : problem.examples.slice(0, 1);
								const safeActiveTestCaseId = Math.min(activeTestCaseId, visibleTestcases.length - 1);
								
								return (
									<>
										<div className="flex select-none">
											{visibleTestcases.map((example, index) => (
												<div
													className="mr-2 items-start mt-2"
													key={example.id}
													onClick={() => setActiveTestCaseId(index)}
												>
													<div className="flex flex-wrap items-center gap-y-4">
														<div
															className={`font-semibold items-center transition-all focus:outline-none inline-flex relative rounded-lg px-4 py-1.5 cursor-pointer whitespace-nowrap text-xs ${
																safeActiveTestCaseId === index
																	? (lightTheme ? "text-blue-700 bg-blue-50 border border-blue-200" : "text-white bg-dark-fill-3 border border-brand-orange")
																	: (lightTheme ? "text-gray-605 bg-gray-100 border border-gray-200 hover:bg-gray-205" : "text-gray-500 bg-dark-fill-3 hover:bg-dark-fill-2")
															}`}
														>
															Case {index + 1}
														</div>
													</div>
												</div>
											))}
										</div>

										<div className="font-semibold my-4">
											<p className={`text-xs font-bold mt-4 ${lightTheme ? "text-gray-650" : "text-white"}`}>Input:</p>
											<div className={`w-full rounded-lg border px-4 py-3 mt-2 font-mono text-xs ${
												lightTheme ? "bg-[#f5f7fa] border-gray-250 text-gray-800" : "bg-dark-fill-3 border-transparent text-white"
											}`}>
												{visibleTestcases[safeActiveTestCaseId]?.inputText}
											</div>
											<p className={`text-xs font-bold mt-4 ${lightTheme ? "text-gray-650" : "text-white"}`}>Output:</p>
											<div className={`w-full rounded-lg border px-4 py-3 mt-2 font-mono text-xs ${
												lightTheme ? "bg-[#f5f7fa] border-gray-250 text-gray-800" : "bg-dark-fill-3 border-transparent text-white"
											}`}>
												{visibleTestcases[safeActiveTestCaseId]?.outputText}
											</div>
										</div>
									</>
								);
							})()}
						</>
					) : (
						<div className="my-2">
							{submissionStatus === "idle" ? (
								<div className="text-gray-500 text-xs py-6 italic text-center">
									No submission yet. Write code and click &quot;Submit Code&quot; to run tests.
								</div>
							) : ["submitting", "compiling", "running"].includes(submissionStatus) ? (
								<div className={`rounded-2xl p-6 border shadow-sm max-w-md mx-auto mt-2 ${
									lightTheme ? "bg-gray-50 border-gray-300" : "bg-dark-fill-3/15 border-gray-800"
								}`}>
									<h3 className={`text-xs font-semibold mb-4 flex items-center gap-2.5 ${lightTheme ? "text-gray-700" : "text-gray-300"}`}>
										<div className={`animate-spin rounded-full h-4 w-4 border-2 border-t-transparent ${
											lightTheme ? "border-blue-600" : "border-brand-orange"
										}`} />
										Evaluating Submission...
									</h3>
									<div className="flex flex-col space-y-4 py-2 px-1">
										<div className="flex items-center space-x-3">
											{submissionStatus === "submitting" ? (
												<div className={`animate-spin rounded-full h-3.5 w-3.5 border-2 border-t-transparent ${
													lightTheme ? "border-blue-600" : "border-brand-orange"
												}`} />
											) : (
												<div className="text-green-500 font-bold text-xs">✓</div>
											)}
											<span className={`text-xs ${submissionStatus === "submitting" ? (lightTheme ? "text-gray-850 font-semibold" : "text-white font-medium") : "text-gray-400"}`}>
												Initializing environment...
											</span>
										</div>
										<div className="flex items-center space-x-3">
											{submissionStatus === "submitting" ? (
												<div className={`h-3 w-3 rounded-full ${lightTheme ? "bg-gray-300" : "bg-gray-800"}`} />
											) : submissionStatus === "compiling" ? (
												<div className={`animate-spin rounded-full h-3.5 w-3.5 border-2 border-t-transparent ${
													lightTheme ? "border-blue-600" : "border-brand-orange"
												}`} />
											) : (
												<div className="text-green-500 font-bold text-xs">✓</div>
											)}
											<span className={`text-xs ${submissionStatus === "compiling" ? (lightTheme ? "text-gray-855 font-semibold" : "text-white font-medium") : "text-gray-400"}`}>
												Compiling code solution...
											</span>
										</div>
										<div className="flex items-center space-x-3">
											{["submitting", "compiling"].includes(submissionStatus) ? (
												<div className={`h-3 w-3 rounded-full ${lightTheme ? "bg-gray-300" : "bg-gray-800"}`} />
											) : submissionStatus === "running" ? (
												<div className={`animate-spin rounded-full h-3.5 w-3.5 border-2 border-t-transparent ${
													lightTheme ? "border-blue-600" : "border-brand-orange"
												}`} />
											) : (
												<div className="text-green-500 font-bold text-xs">✓</div>
											)}
											<span className={`text-xs ${submissionStatus === "running" ? (lightTheme ? "text-gray-855 font-semibold" : "text-white font-medium") : "text-gray-400"}`}>
												Running test cases...
											</span>
										</div>
									</div>
								</div>
							) : wasCustomInputRun ? (
								<div className={`rounded-2xl p-6 border shadow-sm max-w-2xl mx-auto mt-2 ${
									lightTheme ? "bg-blue-50/50 border-blue-200" : "bg-dark-fill-3/15 border-gray-800"
								}`}>
									<div className="text-brand-orange text-lg font-extrabold mb-1">Execution Finished 🚀</div>
									<div className={`text-xs mb-4 ${lightTheme ? "text-gray-600" : "text-gray-400"}`}>
										Your code ran successfully against the custom input.
									</div>
									{testResults.length > 0 && (
										<div className="space-y-4">
											{testResults[0].input && (
												<div>
													<p className={`text-[11px] font-bold mb-1.5 ${lightTheme ? "text-gray-650" : "text-gray-400"}`}>Input:</p>
													<div className={`border px-3 py-2 rounded-lg text-xs font-mono whitespace-pre-wrap ${
														lightTheme ? "bg-gray-100 border-gray-300 text-gray-850" : "bg-black/40 border-gray-850 text-gray-205"
													}`}>
														{testResults[0].input}
													</div>
												</div>
											)}
											<div>
												<p className={`text-[11px] font-bold mb-1.5 ${lightTheme ? "text-gray-655" : "text-gray-400"}`}>Your Output:</p>
												<div className={`border px-3 py-2 rounded-lg text-xs font-mono whitespace-pre-wrap ${
													lightTheme ? "bg-gray-100 border-gray-300 text-gray-855" : "bg-black/40 border-gray-850 text-gray-205"
												}`}>
													{testResults[0].actual || <span className="italic text-gray-500">No stdout produced</span>}
												</div>
											</div>
										</div>
									)}
								</div>
							) : ["accepted", "wrong_answer"].includes(submissionStatus) ? (
								<div className={`rounded-2xl p-6 border shadow-sm mt-2 max-w-2xl mx-auto ${
									lightTheme ? "bg-dark-fill-3/10 border-gray-300" : "bg-dark-fill-3/15 border-gray-800"
								}`}>
									{/* Scorecard Summary */}
									<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-800/60 pb-4 mb-4 gap-2">
										<div>
											<div className={`text-xl font-extrabold ${submissionStatus === "accepted" ? "text-emerald-500" : "text-rose-500"}`}>
												{submissionStatus === "accepted" ? "Accepted 🎉" : "Wrong Answer ❌"}
											</div>
											<div className="text-xs text-gray-400 mt-1">
												Passed {passedCount} / {totalCount} test cases
											</div>
										</div>
										<div className="bg-dark-fill-3 border border-gray-800 px-4 py-2 rounded-xl text-right">
											<div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Score achieved</div>
											<div className="text-lg font-black text-white">
												{((passedCount / (totalCount || 1)) * 100).toFixed(2)}%
											</div>
										</div>
									</div>

									{/* Test Cases Status Grid */}
									<div>
										<p className={`text-[11px] font-bold mb-2 ${lightTheme ? "text-gray-600" : "text-gray-400"}`}>Test Cases Verdicts:</p>
										<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
											{testResults.map((result, index) => {
												const isActive = selectedTestCaseIndex === index;
												return (
													<button
														key={index}
														onClick={() => setSelectedTestCaseIndex(index)}
														className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition duration-200 ${
															result.passed
																? isActive
																	? "bg-green-500/20 border-green-500 text-green-400 font-semibold shadow"
																	: "bg-green-500/5 border-green-500/30 text-green-400 hover:bg-green-500/10"
																: isActive
																	? "bg-red-500/20 border-red-500 text-red-400 font-semibold shadow"
																	: "bg-red-500/5 border-red-500/30 text-red-400 hover:bg-red-500/10"
														}`}
													>
														<span>Test Case #{index + 1}</span>
														<span className="font-extrabold">{result.passed ? "✓" : "✗"}</span>
													</button>
												);
											})}
										</div>
									</div>

									{/* Selected Test Case Details */}
									{testResults[selectedTestCaseIndex] && (
										<div className="mt-4 pt-4 border-t border-gray-800/60 space-y-4">
											{(() => {
												const isSample = !!problem.examples[selectedTestCaseIndex]?.isSample;
												if (!isSample && !wasCustomInputRun) {
													return (
														<div className="text-gray-500 italic text-xs py-2 text-center">
															Input and output details are hidden for secret test cases.
														</div>
													);
												}
												return (
													<>
														<div>
															<p className={`text-[11px] font-bold mb-1.5 ${lightTheme ? "text-gray-600" : "text-gray-400"}`}>Input:</p>
															<div className={`border px-3 py-2 rounded-lg text-xs font-mono whitespace-pre-wrap ${
																lightTheme ? "bg-gray-100 border-gray-300 text-gray-855" : "bg-black/40 border-gray-855 text-gray-250"
															}`}>
																{testResults[selectedTestCaseIndex].input || <span className="italic text-gray-500">Empty Input</span>}
															</div>
														</div>
														
														<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
															<div>
																<p className={`text-[11px] font-bold mb-1.5 ${lightTheme ? "text-gray-600" : "text-gray-400"}`}>Expected Output:</p>
																<div className={`border px-3 py-2 rounded-lg text-xs font-mono whitespace-pre-wrap ${
																	lightTheme ? "bg-green-55 border-green-200 text-green-700 font-semibold" : "bg-green-500/10 border-green-500/20 text-green-400"
																}`}>
																	{testResults[selectedTestCaseIndex].expected || <span className="italic text-gray-500">Empty Output</span>}
																</div>
															</div>
															<div>
																<p className={`text-[11px] font-bold mb-1.5 ${lightTheme ? "text-gray-600" : "text-gray-400"}`}>Your Output:</p>
																<div className={`border px-3 py-2 rounded-lg text-xs font-mono whitespace-pre-wrap ${
																	testResults[selectedTestCaseIndex].passed
																		? lightTheme
																			? "bg-green-55 border-green-200 text-green-700 font-semibold"
																			: "bg-green-500/10 border-green-500/20 text-green-400"
																		: lightTheme
																			? "bg-red-50 border-red-200 text-red-700 font-semibold"
																			: "bg-red-500/10 border-red-500/20 text-red-400"
																}`}>
																	{testResults[selectedTestCaseIndex].actual || <span className="italic text-gray-500">Empty Output</span>}
																</div>
															</div>
														</div>

														{testResults[selectedTestCaseIndex].error && (
															<div>
																<p className={`text-[11px] font-bold mb-1.5 ${lightTheme ? "text-gray-600" : "text-gray-400"}`}>Error Details:</p>
																<pre className={`border p-4 rounded-xl text-xs font-mono overflow-auto max-h-[140px] whitespace-pre-wrap ${
																	lightTheme ? "bg-gray-100 border-gray-350 text-red-700" : "bg-black/40 border-gray-850 text-red-400"
																}`}>
																	{testResults[selectedTestCaseIndex].error}
																</pre>
															</div>
														)}
													</>
												);
											})()}
										</div>
									)}

									{submissionMessage && !["Wrong Answer", "All test cases passed successfully!"].includes(submissionMessage) && (
										<div className="mt-4">
											<p className={`text-[11px] font-bold mb-1.5 ${lightTheme ? "text-gray-600" : "text-gray-400"}`}>Error Log / Trace:</p>
											<pre className={`border p-4 rounded-xl text-xs font-mono overflow-auto max-h-[140px] whitespace-pre-wrap ${
												lightTheme ? "bg-gray-100 border-gray-350 text-red-700" : "bg-black/40 border-gray-850 text-red-400"
											}`}>
												{submissionMessage}
											</pre>
										</div>
									)}
								</div>
							) : submissionStatus === "compile_error" ? (
								<div className={`rounded-2xl p-6 border shadow-sm mt-2 ${
									lightTheme ? "bg-red-50/50 border-red-200" : "bg-red-500/5 border-red-500/20"
								}`}>
									<div className="text-red-655 text-lg font-bold mb-1.5 flex items-center gap-2">
										<span>Compilation Error</span>
										<span className="text-[10px] font-normal text-gray-500">(Syntax error or compilation failed)</span>
									</div>
									<div className={`text-xs mb-3.5 ${lightTheme ? "text-gray-600 font-semibold" : "text-gray-400"}`}>Details of compilation output:</div>
									<pre className={`text-xs font-mono p-4 rounded-xl border overflow-auto max-h-[180px] whitespace-pre-wrap ${
										lightTheme ? "bg-gray-50 text-red-750 border-gray-300" : "bg-black/60 text-red-400/90 border-gray-850"
									}`}>
										{submissionMessage}
									</pre>
								</div>
							) : (
								<div className={`rounded-2xl p-6 border shadow-sm mt-2 text-center ${
									lightTheme ? "bg-red-50 border-red-200" : "bg-red-500/5 border-red-500/20"
								}`}>
									<div className="text-red-655 text-lg font-bold mb-2 font-mono">Execution Error</div>
									<div className={`text-xs max-w-md mx-auto whitespace-pre-wrap ${lightTheme ? "text-red-750 font-semibold" : "text-gray-400"}`}>{submissionMessage}</div>
								</div>
							)}
						</div>
					)}
				</div>
			</Split>

			<EditorFooter
				handleRun={() => handleExecute(false)}
				handleSubmit={() => handleExecute(true)}
				lightTheme={lightTheme}
				onUploadFile={(code) => setUserCode(code)}
				customInputChecked={customInputChecked}
				setCustomInputChecked={setCustomInputChecked}
				executingType={executingType}
			/>
		</div>
	);
};

export default Playground;
