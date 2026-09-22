import { useState, useEffect, useCallback } from "react";
import PreferenceNav from "./PreferenceNav/PreferenceNav";
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
import { arrayUnion, doc, updateDoc, addDoc, collection, increment, getDoc, setDoc } from "firebase/firestore";
import useLocalStorage from "@/hooks/useLocalStorage";
import { SupportedLanguage, starterCodes, runPistonCode } from "@/utils/pistonRunner";
import { FiCheck, FiX } from "react-icons/fi";
import { useSubmission } from "@/context/SubmissionContext";
import TestcaseScorecard from "../TestcaseScorecard/TestcaseScorecard";

import { getFriendlyErrorMessage } from "@/utils/errorFilter";
import { EditorView } from "@codemirror/view";

type PlaygroundProps = {
	problem: Problem;
	setSuccess: React.Dispatch<React.SetStateAction<boolean>>;
	setSolved: React.Dispatch<React.SetStateAction<boolean>>;
	lightTheme?: boolean;
	contestId?: string;
	onSubmissionCreated?: (submission: any) => void;
	language: SupportedLanguage;
	setLanguage: React.Dispatch<React.SetStateAction<SupportedLanguage>>;
	userCode: string;
	setUserCode: React.Dispatch<React.SetStateAction<string>>;

	// Lifted states
	customInputChecked: boolean;
	setCustomInputChecked: React.Dispatch<React.SetStateAction<boolean>>;
	customInputText: string;
	setCustomInputText: React.Dispatch<React.SetStateAction<string>>;
	activeTestCaseId: number;
	setActiveTestCaseId: React.Dispatch<React.SetStateAction<number>>;
	consoleTab: "testcases" | "custominput" | "results";
	setConsoleTab: React.Dispatch<React.SetStateAction<"testcases" | "custominput" | "results">>;
	activeExampleId: number;
	setActiveExampleId: React.Dispatch<React.SetStateAction<number>>;
	settings: ISettings;
	setSettings: React.Dispatch<React.SetStateAction<ISettings>>;
	selectionRange: { anchor: number; head: number } | null;
	setSelectionRange: React.Dispatch<React.SetStateAction<{ anchor: number; head: number } | null>>;
	scrollTop: number;
	setScrollTop: React.Dispatch<React.SetStateAction<number>>;
};

export interface ISettings {
	fontSize: string;
	settingsModalIsOpen: boolean;
	dropdownIsOpen: boolean;
}

const Playground: React.FC<PlaygroundProps> = ({
	problem,
	setSuccess,
	setSolved,
	lightTheme = false,
	contestId,
	onSubmissionCreated,
	language,
	setLanguage,
	userCode,
	setUserCode,
	customInputChecked,
	setCustomInputChecked,
	customInputText,
	setCustomInputText,
	activeTestCaseId,
	setActiveTestCaseId,
	consoleTab,
	setConsoleTab,
	activeExampleId,
	setActiveExampleId,
	settings,
	setSettings,
	selectionRange,
	setSelectionRange,
	scrollTop,
	setScrollTop,
}) => {
	const [user, loading] = useAuthState(auth);
	const router = useRouter();
	const pid = router.query.pid;

	const {
		isSubmitting,
		submitCode,
		runStatus,
		runResults,
		runError,
		runCode
	} = useSubmission();

	const testResults = runResults || [];
	const passedCount = testResults.filter((r: any) => r.passed).length;
	const totalCount = testResults.length;
	const runMessage = runError || (runStatus === "accepted" ? "All test cases passed successfully!" : "");
	const executingType = isSubmitting ? "submit" : (runStatus === "running" ? "run" : null);

	const handleToggleCustomInput = (checked: boolean) => {
		setCustomInputChecked(checked);
		if (checked) {
			setConsoleTab("custominput");
		} else {
			setConsoleTab("testcases");
		}
	};

	const handleExecute = async (isSubmit: boolean) => {
		if (!user) {
			alert(`Please login to ${isSubmit ? "submit" : "run"} your code`);
			return;
		}

		if (isSubmit) {
			try {
				const submissionId = await submitCode(userCode, language, problem, contestId);
				if (submissionId) {
					if (contestId) {
						router.push(`/contests/${contestId}/problems/${problem.id}/submissions/${submissionId}`);
					} else {
						router.push(`/problems/${problem.id}/submissions/${submissionId}`);
					}
				}
			} catch (error: any) {
				console.error("Submission error:", error);
				alert(getFriendlyErrorMessage(error, "Unable to submit your solution. Please try again."));
			}
			return;
		}

		// Run code flow
		try {
			setConsoleTab("results");
			await runCode(userCode, language, problem, customInputChecked, customInputText);
			setActiveTestCaseId(0);
		} catch (error: any) {
			console.error("Run Code error:", error);
		}
	};

	const [syncStatus, setSyncStatus] = useState<"connected" | "syncing" | "offline-saved" | "error">("connected");
	const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

	// 2. Throttled Cloud Save Flow
	const triggerCloudSave = useCallback(async (codeToSave: string) => {
		if (!user || !pid) return;

		setSyncStatus("syncing");

		// Check offline status
		if (typeof window !== "undefined" && !navigator.onLine) {
			setSyncStatus("offline-saved");
			// Add to offline sync queue
			const queueKey = `offline-sync-queue`;
			const queue = JSON.parse(localStorage.getItem(queueKey) || "[]");
			const item = {
				uid: user.uid,
				pid,
				contestId: contestId || null,
				language,
				code: codeToSave,
				updatedAt: Date.now()
			};
			const filtered = queue.filter((x: any) => !(x.pid === pid && x.language === language && x.contestId === contestId));
			filtered.push(item);
			localStorage.setItem(queueKey, JSON.stringify(filtered));
			return;
		}

		try {
			const docName = contestId 
				? `${contestId}_${user.uid}_${pid}_${language}`
				: `${user.uid}_${pid}_${language}`;
			const collectionName = contestId ? "contest_drafts" : "drafts";
			const docRef = doc(firestore, collectionName, docName);
			
			await setDoc(docRef, {
				uid: user.uid,
				problemId: pid,
				contestId: contestId || null,
				language,
				code: codeToSave,
				updatedAt: Date.now()
			}, { merge: true });

			setSyncStatus("connected");
		} catch (err) {
			console.error("Cloud save failed:", err);
			setSyncStatus("error");
		}
	}, [user, pid, contestId, language]);

	// 1. Initial Load & Recovery Flow
	useEffect(() => {
		const openSubId = router.query.openSubmissionId as string;
		if (!openSubId || !user || !pid) return;

		let active = true;
		const fetchAndLoadSubmission = async () => {
			try {
				const collectionName = contestId ? "contest_submissions" : "submissions";
				const subDocRef = doc(firestore, collectionName, openSubId);
				const snap = await getDoc(subDocRef);
				if (snap.exists() && active) {
					const data = snap.data();
					if (data && data.code) {
						setUserCode(data.code);
						if (data.language) {
							setLanguage(data.language as SupportedLanguage);
						}
						// Save to local storage draft metadata so it persists
						const localMetaKey = `code-meta-${user.uid}-${pid}-${data.language}`;
						localStorage.setItem(localMetaKey, JSON.stringify({ code: data.code, updatedAt: Date.now() }));
						
						// Clear the query parameter from URL using router.replace
						const cleanQuery = { ...router.query };
						delete cleanQuery.openSubmissionId;
						router.replace({ pathname: router.pathname, query: cleanQuery }, undefined, { shallow: true });
					}
				}
			} catch (err) {
				console.error("Error recovering submission in editor:", err);
			}
		};

		fetchAndLoadSubmission();
		return () => {
			active = false;
		};
	}, [router.query.openSubmissionId, user, pid, contestId]);

	// 2. Draft Recovery Flow
	useEffect(() => {
		if (loading || !pid || router.query.openSubmissionId) return;

		let active = true;

		const loadCodeDraft = async () => {
			const localMetaKey = user ? `code-meta-${user.uid}-${pid}-${language}` : `code-meta-${pid}-${language}`;
			const localLegacyKey = user ? `code-${user.uid}-${pid}-${language}` : `code-${pid}-${language}`;

			// Get local storage values
			let localCode = "";
			let localTime = 0;

			const localMetaStr = localStorage.getItem(localMetaKey);
			if (localMetaStr) {
				try {
					const parsed = JSON.parse(localMetaStr);
					localCode = parsed.code || "";
					localTime = parsed.updatedAt || 0;
				} catch (e) {}
			} else {
				// Legacy fallback
				const legacyStr = localStorage.getItem(localLegacyKey);
				if (legacyStr) {
					try {
						localCode = JSON.parse(legacyStr) || "";
						localTime = 1; // dummy low timestamp
					} catch (e) {}
				}
			}

			// Get remote Firestore values
			let remoteCode = "";
			let remoteTime = 0;

			if (user) {
				try {
					const docName = contestId 
						? `${contestId}_${user.uid}_${pid}_${language}`
						: `${user.uid}_${pid}_${language}`;
					const collectionName = contestId ? "contest_drafts" : "drafts";
					const docRef = doc(firestore, collectionName, docName);
					const docSnap = await getDoc(docRef);
					if (docSnap.exists()) {
						const data = docSnap.data();
						remoteCode = data.code || "";
						remoteTime = data.updatedAt || 0;
					}
				} catch (err) {
					console.error("Failed to fetch remote draft:", err);
				}
			}

			if (!active) return;

			// Determine which one is newer
			if (remoteTime > localTime && remoteCode) {
				setUserCode(remoteCode);
				// Update local cache
				localStorage.setItem(localMetaKey, JSON.stringify({ code: remoteCode, updatedAt: remoteTime }));
				setSyncStatus("connected");
			} else if (localCode) {
				setUserCode(localCode);
				if (localTime > remoteTime && user) {
					// We have a newer local edit, trigger background sync
					triggerCloudSave(localCode);
				} else {
					setSyncStatus("connected");
				}
			} else {
				// Fallback to starter code
				const customStarter = starterCodes[pid as string]?.[language];
				const starter = customStarter || problem.starterCode;
				setUserCode(starter);
				setSyncStatus("connected");
			}
		};

		loadCodeDraft();

		return () => {
			active = false;
		};
	}, [pid, language, problem.starterCode, user, loading, contestId, triggerCloudSave]);

	// 3. Online/Offline Reconnection Listener
	useEffect(() => {
		if (typeof window === "undefined") return;

		const handleOnline = async () => {
			setSyncStatus("syncing");
			const queueKey = `offline-sync-queue`;
			const queue = JSON.parse(localStorage.getItem(queueKey) || "[]");

			if (queue.length > 0 && user) {
				try {
					for (const item of queue) {
						if (item.uid !== user.uid) continue;
						const docName = item.contestId 
							? `${item.contestId}_${user.uid}_${item.pid}_${item.language}`
							: `${user.uid}_${item.pid}_${item.language}`;
						const collectionName = item.contestId ? "contest_drafts" : "drafts";
						const docRef = doc(firestore, collectionName, docName);
						
						await setDoc(docRef, {
							uid: user.uid,
							problemId: item.pid,
							contestId: item.contestId || null,
							language: item.language,
							code: item.code,
							updatedAt: item.updatedAt
						}, { merge: true });
					}
					// Clear queue
					localStorage.removeItem(queueKey);
				} catch (err) {
					console.error("Failed to sync offline queue:", err);
				}
			}

			// Also sync current editor code to make sure it's up to date
			triggerCloudSave(userCode);
		};

		const handleOffline = () => {
			setSyncStatus("offline-saved");
		};

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, [user, userCode, pid, language, contestId, triggerCloudSave]);

	const onChange = (value: string) => {
		setUserCode(value);
		if (loading) return;

		// 1. Instantly save to local storage metadata
		const localMetaKey = user ? `code-meta-${user.uid}-${pid}-${language}` : `code-meta-${pid}-${language}`;
		localStorage.setItem(localMetaKey, JSON.stringify({ code: value, updatedAt: Date.now() }));

		// 2. Set syncing status
		if (user) {
			setSyncStatus("syncing");
			if (saveTimeout) clearTimeout(saveTimeout);

			// Start new debounce timeout for 3 seconds
			const timeout = setTimeout(() => {
				triggerCloudSave(value);
			}, 3000);
			setSaveTimeout(timeout);
		}
	};

	const getExtensions = () => {
		const baseExtensions = (() => {
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
		})();

		return [
			...baseExtensions,
			EditorView.updateListener.of((update) => {
				if (update.selectionSet) {
					const main = update.state.selection.main;
					setSelectionRange({ anchor: main.anchor, head: main.head });
				}
			}),
			EditorView.domEventHandlers({
				scroll(event, view) {
					setScrollTop(view.scrollDOM.scrollTop);
				}
			})
		];
	};

	return (
		<div className="flex flex-col relative w-full h-full border-t lg:border-t-0 lg:border-l overflow-hidden animate-fade-in" style={{ background: "var(--bg-dark-layer-1)", borderColor: "var(--border-subtle)" }}>
			{/* preference nav */}
			<PreferenceNav
				settings={settings}
				setSettings={setSettings}
				language={language}
				setLanguage={setLanguage}
				lightTheme={lightTheme}
				syncStatus={syncStatus}
			/>

			{/* Main Layout: Vertically Stacked Editor and Console Tray */}
			<div className="flex-1 overflow-y-auto w-full flex flex-col">
				{/* Editor View */}
				<div className="w-full min-h-[600px] overflow-auto border-b" style={{ borderColor: "var(--border-subtle)" }}>
					<CodeMirror
						value={userCode}
						theme={lightTheme ? undefined : vscodeDark}
						onChange={onChange}
						extensions={getExtensions()}
						style={{ fontSize: settings.fontSize }}
						onCreateEditor={(view) => {
							if (selectionRange) {
								try {
									view.dispatch({ selection: selectionRange });
								} catch (e) {}
							}
							if (scrollTop) {
								try {
									view.scrollDOM.scrollTop = scrollTop;
								} catch (e) {}
							}
						}}
					/>
				</div>

				{/* Console Results Panel (Tabbed Output Tray) */}
				<div className="w-full px-5 pb-20 pt-4" style={{ background: "var(--bg-surface)", color: "var(--text-primary)" }}>
					<div className="flex items-center space-x-2 border-b pb-2 mb-4" style={{ borderColor: "var(--border-default)" }}>
						<button
							type="button"
							onClick={() => setConsoleTab("testcases")}
							className="text-xs font-semibold px-3 py-1.5 rounded-md transition duration-200"
							style={{
								fontFamily: "'Inter', sans-serif",
								background: consoleTab === "testcases" ? "var(--bg-dark-layer-1)" : "transparent",
								color: consoleTab === "testcases" ? "var(--text-primary)" : "var(--text-secondary)",
								border: consoleTab === "testcases" ? "1px solid var(--border-default)" : "1px solid transparent"
							}}
						>
							Test Cases
						</button>
						<button
							type="button"
							onClick={() => setConsoleTab("custominput")}
							className="text-xs font-semibold px-3 py-1.5 rounded-md transition duration-200"
							style={{
								fontFamily: "'Inter', sans-serif",
								background: consoleTab === "custominput" ? "var(--bg-dark-layer-1)" : "transparent",
								color: consoleTab === "custominput" ? "var(--text-primary)" : "var(--text-secondary)",
								border: consoleTab === "custominput" ? "1px solid var(--border-default)" : "1px solid transparent"
							}}
						>
							Custom Input {customInputChecked && <span className="inline-block w-1.5 h-1.5 rounded-full ml-1 bg-brand-orange" />}
						</button>
						<button
							type="button"
							onClick={() => setConsoleTab("results")}
							className="text-xs font-semibold px-3 py-1.5 rounded-md transition duration-200"
							style={{
								fontFamily: "'Inter', sans-serif",
								background: consoleTab === "results" ? "var(--bg-dark-layer-1)" : "transparent",
								color: consoleTab === "results" ? "var(--text-primary)" : "var(--text-secondary)",
								border: consoleTab === "results" ? "1px solid var(--border-default)" : "1px solid transparent"
							}}
						>
							Results {runStatus !== "idle" && (
								<span className={`inline-block w-1.5 h-1.5 rounded-full ml-1 ${
									runStatus === "running" ? "bg-brand-orange animate-pulse" : runStatus === "accepted" ? "bg-emerald-400" : "bg-rose-400"
								}`} />
							)}
						</button>
					</div>

					<div className="my-2">
						{consoleTab === "testcases" && (() => {
							const sampleExamples = (problem.examples || []).filter((ex: any) => ex.isSample);
							const displayExamples = sampleExamples.length > 0 ? sampleExamples : (problem.examples || []);
							// Clamp activeExampleId to range of displayExamples
							const activeIdx = Math.min(activeExampleId, Math.max(0, displayExamples.length - 1));
							return (
								<div className="space-y-4">
									<div className="flex flex-wrap gap-2">
										{displayExamples.map((example, idx) => (
											<button
												key={example.id || idx}
												type="button"
												onClick={() => setActiveExampleId(idx)}
												className="text-xs font-semibold px-3 py-1.5 rounded-md transition duration-200"
												style={{
													fontFamily: "'Inter', sans-serif",
													background: activeIdx === idx ? "var(--bg-dark-layer-1)" : "var(--bg-dark-layer-2)",
													color: activeIdx === idx ? "var(--text-primary)" : "var(--text-secondary)",
													border: activeIdx === idx ? "1px solid var(--border-default)" : "1px solid transparent"
												}}
											>
												Case {idx + 1}
											</button>
										))}
									</div>

									{displayExamples[activeIdx] && (
										<div className="space-y-3 animate-fade-in">
											<div>
												<p className="text-[11px] font-bold mb-1 text-gray-400 uppercase tracking-wider">Input:</p>
												<pre 
													className="border px-4 py-3 rounded-lg text-xs whitespace-pre-wrap text-gray-200"
													style={{
														fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
														backgroundColor: "rgba(0,0,0,0.35)",
														borderColor: "var(--border-default)"
													}}
												>
													{displayExamples[activeIdx].inputText}
												</pre>
											</div>
											<div>
												<p className="text-[11px] font-bold mb-1 text-gray-400 uppercase tracking-wider">Expected Output:</p>
												<pre 
													className="border px-4 py-3 rounded-lg text-xs whitespace-pre-wrap text-gray-200"
													style={{
														fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
														backgroundColor: "rgba(0,0,0,0.35)",
														borderColor: "var(--border-default)"
													}}
												>
													{displayExamples[activeIdx].outputText}
												</pre>
											</div>
											{displayExamples[activeIdx].explanation && (
												<div>
													<p className="text-[11px] font-bold mb-1 text-gray-400 uppercase tracking-wider">Explanation:</p>
													<div 
														className="text-xs bg-white/[0.02] border p-3 rounded-lg leading-relaxed text-gray-300"
														style={{ borderColor: "var(--border-default)" }}
													>
														{displayExamples[activeIdx].explanation}
													</div>
												</div>
											)}
										</div>
									)}
								</div>
							);
						})()}

						{consoleTab === "custominput" && (
							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Custom Execution Input:</p>
									<label className="flex items-center space-x-2 cursor-pointer">
										<input
											type="checkbox"
											checked={customInputChecked}
											onChange={(e) => handleToggleCustomInput(e.target.checked)}
											className="rounded border-gray-700 bg-black/40 text-brand-orange focus:ring-0"
										/>
										<span className="text-xs text-gray-300">Enable Custom Input</span>
									</label>
								</div>
								<textarea
									value={customInputText}
									onChange={(e) => {
										setCustomInputText(e.target.value);
										if (!customInputChecked) {
											setCustomInputChecked(true);
										}
									}}
									rows={5}
									className="w-full text-xs font-mono p-4 rounded-xl outline-none border focus:ring-0 transition bg-black/45 border-gray-800 text-gray-200 placeholder-gray-600 focus:border-brand-orange/60"
									placeholder="Provide custom input arguments to run your solution (e.g. [2,7,11,15]\n9)"
								/>
							</div>
						)}

						{consoleTab === "results" && (
							<div>
								{runStatus === "idle" ? (
									<div className="text-gray-500 text-xs py-8 italic text-center">
										No run results yet. Click &quot;Run Code&quot; to test your solution.
									</div>
								) : runStatus === "running" ? (
									<div className={`rounded-2xl p-6 border shadow-sm max-w-md mx-auto mt-2 bg-dark-fill-3/15 border-gray-800`}>
										<h3 className={`text-xs font-semibold mb-4 flex items-center gap-2.5 text-gray-300`}>
											<div className={`animate-spin rounded-full h-4 w-4 border-2 border-t-transparent border-brand-orange`} />
											Evaluating Run...
										</h3>
										<div className="flex flex-col space-y-4 py-2 px-1">
											<div className="flex items-center space-x-3">
												<div className={`animate-spin rounded-full h-3.5 w-3.5 border-2 border-t-transparent border-brand-orange`} />
												<span className={`text-xs font-medium text-white`}>
													Running test cases against execution environment...
												</span>
											</div>
										</div>
									</div>
								) : runStatus === "accepted" || runStatus === "wrong_answer" ? (
									<div className="space-y-4">
										{/* Verdict Banner */}
										{runStatus === "accepted" ? (
											<div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 p-4 rounded-xl font-bold text-sm flex items-center gap-2">
												<span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
												Accepted
											</div>
										) : (
											<div className="bg-rose-500/10 border border-rose-500/20 text-rose-450 p-4 rounded-xl font-bold text-sm flex items-center gap-2">
												<span className="w-2 h-2 rounded-full bg-rose-500" />
												Wrong Answer
											</div>
										)}

										{testResults.length > 0 && (() => {
											const activeRunIdx = Math.min(activeTestCaseId, Math.max(0, testResults.length - 1));
											return (
												<div className="space-y-4">
													{/* Case Switcher Tabs */}
													<div className="flex flex-wrap gap-2">
														{testResults.map((_, idx) => (
															<button
																key={idx}
																type="button"
																onClick={() => setActiveTestCaseId(idx)}
																className="text-xs font-semibold px-3 py-1.5 rounded-md transition duration-200"
																style={{
																	fontFamily: "'Inter', sans-serif",
																	background: activeRunIdx === idx ? "var(--bg-dark-layer-1)" : "var(--bg-dark-layer-2)",
																	color: activeRunIdx === idx ? "var(--text-primary)" : "var(--text-secondary)",
																	border: activeRunIdx === idx ? "1px solid var(--border-default)" : "1px solid transparent"
																}}
															>
																Case {idx + 1}
															</button>
														))}
													</div>

													{testResults[activeRunIdx] && (
														<div className="space-y-4 pt-2 animate-fade-in">
															<div>
																<p className="text-[11px] font-bold mb-1.5 text-gray-400 uppercase tracking-wider">Input:</p>
																<pre 
																	className="border border-gray-850 bg-black/35 px-4 py-3 rounded-lg text-xs whitespace-pre-wrap text-gray-200"
																	style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
																>
																	{testResults[activeRunIdx].input || <span className="italic text-gray-550">Empty Input</span>}
																</pre>
															</div>

															<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
																<div>
																	<p className="text-[11px] font-bold mb-1.5 text-gray-400 uppercase tracking-wider">Your Output:</p>
																	<pre 
																		className={`border px-4 py-3 rounded-lg text-xs whitespace-pre-wrap ${
																			testResults[activeRunIdx].passed
																				? "bg-green-500/10 border-green-500/20 text-green-450"
																				: "bg-red-900/20 border-red-500/20 text-rose-450"
																		}`}
																		style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
																	>
																		{testResults[activeRunIdx].actual || <span className="italic opacity-50">Empty Output</span>}
																	</pre>
																</div>
																<div>
																	<p className="text-[11px] font-bold mb-1.5 text-gray-400 uppercase tracking-wider">Expected Output:</p>
																	<pre 
																		className="border border-green-500/20 bg-green-500/10 px-4 py-3 rounded-lg text-xs whitespace-pre-wrap text-green-450"
																		style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
																	>
																		{testResults[activeRunIdx].expected}
																	</pre>
																</div>
															</div>

															{testResults[activeRunIdx].error && (
																<div>
																	<p className="text-[11px] font-bold mb-1.5 text-gray-400 uppercase tracking-wider">Error Details:</p>
																	<pre 
																		className="border p-4 rounded-xl text-xs overflow-auto max-h-[140px] whitespace-pre-wrap bg-rose-950/20 border-rose-800/35 text-rose-450"
																		style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
																	>
																		{testResults[activeRunIdx].error}
																	</pre>
																</div>
															)}
														</div>
													)}
												</div>
											);
										})()}
									</div>
								) : runStatus === "compile_error" ? (
									<div className="space-y-4 animate-fade-in">
										<div className="text-rose-550 text-lg font-black flex items-center gap-2">
											<span>Compilation Error</span>
										</div>
										<div className="text-xs font-semibold text-text-muted" style={{ color: "var(--text-muted)" }}>Details:</div>
										<pre className="text-xs font-mono p-4 rounded-xl border overflow-auto max-h-[180px] whitespace-pre-wrap text-red-400 bg-black/60 border-border-subtle" style={{ borderColor: "var(--border-subtle)" }}>
											{runMessage}
										</pre>
									</div>
								) : (
									<div className="text-center py-6 animate-fade-in">
										<div className="text-rose-500 font-bold mb-2">Execution Error</div>
										<div className="text-xs font-semibold text-text-muted" style={{ color: "var(--text-muted)" }}>{runMessage}</div>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			</div>

			<EditorFooter
				handleRun={() => handleExecute(false)}
				handleSubmit={() => handleExecute(true)}
				lightTheme={lightTheme}
				onUploadFile={(code) => setUserCode(code)}
				customInputChecked={customInputChecked}
				setCustomInputChecked={handleToggleCustomInput}
				executingType={executingType}
			/>
		</div>
	);
};

export default Playground;
