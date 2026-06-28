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
import dynamic from "next/dynamic";
import { useSubmission } from "@/context/SubmissionContext";
const Split = dynamic(() => import("react-split"), { ssr: false });

import { getFriendlyErrorMessage } from "@/utils/errorFilter";

type PlaygroundProps = {
	problem: Problem;
	setSuccess: React.Dispatch<React.SetStateAction<boolean>>;
	setSolved: React.Dispatch<React.SetStateAction<boolean>>;
	lightTheme?: boolean;
	contestId?: string;
	onSubmissionCreated?: (submission: any) => void;
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
}) => {
	const [language, setLanguage] = useState<SupportedLanguage>("javascript");
	const [userCode, setUserCode] = useState<string>(problem.starterCode);
	const [fontSize, setFontSize] = useLocalStorage("lcc-fontSize", "16px");

	const [settings, setSettings] = useState<ISettings>({
		fontSize: fontSize,
		settingsModalIsOpen: false,
		dropdownIsOpen: false,
	});

	const [customInputChecked, setCustomInputChecked] = useState(false);
	const [customInputText, setCustomInputText] = useState("");
	const [activeTestCaseId, setActiveTestCaseId] = useState(0);

	const [user, loading] = useAuthState(auth);
	const {
		query: { pid },
	} = useRouter();

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

	const handleExecute = async (isSubmit: boolean) => {
		if (!user) {
			alert(`Please login to ${isSubmit ? "submit" : "run"} your code`);
			return;
		}

		if (isSubmit) {
			try {
				await submitCode(userCode, language, problem, contestId);
			} catch (error: any) {
				console.error("Submission error:", error);
				alert(getFriendlyErrorMessage(error, "Unable to submit your solution. Please try again."));
			}
			return;
		}

		// Run code flow
		try {
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
		if (loading || !pid) return;

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
		<div className="flex flex-col relative w-full border rounded-lg overflow-hidden shadow-sm animate-fade-in" style={{ background: "var(--bg-dark-layer-1)", borderColor: "var(--border-subtle)" }}>
			{/* preference nav */}
			<PreferenceNav
				settings={settings}
				setSettings={setSettings}
				language={language}
				setLanguage={setLanguage}
				lightTheme={lightTheme}
				syncStatus={syncStatus}
			/>

			{/* Custom Input Block */}
			{customInputChecked && (
				<div className={`p-4 border-b ${lightTheme ? "bg-gray-50 border-gray-300 text-gray-800" : "bg-dark-fill-3 text-white border-gray-800"}`} style={{ backgroundColor: "var(--bg-dark-layer-1)", borderColor: "var(--border-subtle)" }}>
					<p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>Custom Input Text:</p>
					<textarea
						value={customInputText}
						onChange={(e) => setCustomInputText(e.target.value)}
						rows={3}
						className="w-full text-xs font-mono p-3 rounded-lg outline-none border focus:ring-0"
						style={{ backgroundColor: "var(--bg-testcase)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }}
						placeholder="Write custom input parameters here..."
					/>
				</div>
			)}

			<Split className="h-[520px]" direction="vertical" sizes={[60, 40]} minSize={100}>
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

				{/* Console Results Panel (Runs only) */}
				<div className="w-full px-5 overflow-auto pb-14 border-t pt-4" style={{ background: "var(--bg-dark-layer-1)", color: "var(--text-primary)", borderColor: "var(--border-subtle)" }}>
					<div className="text-xs font-bold text-text-secondary mb-3 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
						<span>Console Output / Run Result:</span>
					</div>

					<div className="my-2">
						{runStatus === "idle" ? (
							<div className="text-gray-500 text-xs py-6 italic text-center">
								No run results yet. Click &quot;Run Code&quot; to test your solution.
							</div>
						) : runStatus === "running" ? (
							<div className={`rounded-2xl p-6 border shadow-sm max-w-md mx-auto mt-2 ${
								lightTheme ? "bg-gray-50 border-gray-300" : "bg-dark-fill-3/15 border-gray-800"
							}`}>
								<h3 className={`text-xs font-semibold mb-4 flex items-center gap-2.5 ${lightTheme ? "text-gray-700" : "text-gray-300"}`}>
									<div className={`animate-spin rounded-full h-4 w-4 border-2 border-t-transparent ${
										lightTheme ? "border-blue-600" : "border-brand-orange"
									}`} />
									Evaluating Run...
								</h3>
								<div className="flex flex-col space-y-4 py-2 px-1">
									<div className="flex items-center space-x-3">
										<div className={`animate-spin rounded-full h-3.5 w-3.5 border-2 border-t-transparent ${
											lightTheme ? "border-blue-600" : "border-brand-orange"
										}`} />
										<span className={`text-xs font-medium ${lightTheme ? "text-gray-850" : "text-white"}`}>
											Running test cases against Piston environment...
										</span>
									</div>
								</div>
							</div>
						) : runStatus === "accepted" ? (
							<div className="space-y-4">
								<div className="text-bc-success text-lg font-black mb-1">Passed</div>
								<div className="text-xs text-text-muted font-bold" style={{ color: "var(--text-muted)" }}>
									Passed Cases: {passedCount} / {totalCount}
								</div>

								{testResults.length > 0 && (
									<>
										<div className="flex select-none">
											{testResults.map((_, index) => (
												<button
													key={index}
													onClick={() => setActiveTestCaseId(index)}
													className="mr-2 font-semibold items-center transition-all focus:outline-none inline-flex relative rounded-lg px-4 py-1.5 cursor-pointer whitespace-nowrap text-xs font-bold"
													style={activeTestCaseId === index
														? { color: "var(--brand-orange)", background: "var(--bg-dark-fill-3)", border: "1px solid var(--border-accent)" }
														: { color: "var(--text-muted)", background: "var(--bg-dark-fill-3)", border: "1px solid transparent" }
													}
												>
													Case {index + 1}
												</button>
											))}
										</div>

										{testResults[activeTestCaseId] && (
											<div className="font-semibold my-4">
												<p className="text-xs font-bold mt-4" style={{ color: "var(--text-secondary)" }}>Input:</p>
												<div className="w-full rounded-lg border px-4 py-3 mt-2 font-mono text-xs whitespace-pre-wrap" style={{ background: "var(--bg-testcase)", borderColor: "var(--border-testcase)", color: "var(--text-testcase)" }}>
													{testResults[activeTestCaseId].input}
												</div>
												{testResults[activeTestCaseId].expected && (
													<>
														<p className="text-xs font-bold mt-4" style={{ color: "var(--text-secondary)" }}>Expected Output:</p>
														<div className="w-full rounded-lg border px-4 py-3 mt-2 font-mono text-xs whitespace-pre-wrap" style={{ background: "var(--bg-testcase)", borderColor: "var(--border-testcase)", color: "var(--text-testcase)" }}>
															{testResults[activeTestCaseId].expected}
														</div>
													</>
												)}
												<p className="text-xs font-bold mt-4" style={{ color: "var(--text-secondary)" }}>Your Output:</p>
												<div className="w-full rounded-lg border px-4 py-3 mt-2 font-mono text-xs whitespace-pre-wrap" style={{ background: "var(--bg-testcase)", borderColor: "var(--border-testcase)", color: "var(--text-testcase)" }}>
													{testResults[activeTestCaseId].actual}
												</div>
											</div>
										)}
									</>
								)}
							</div>
						) : runStatus === "wrong_answer" ? (
							<div className="space-y-4">
								<div className="text-bc-error text-lg font-black mb-1">Wrong Answer</div>
								<div className="text-xs text-text-muted font-bold" style={{ color: "var(--text-muted)" }}>
									Passed Cases: {passedCount} / {totalCount}
								</div>

								{testResults.length > 0 && (
									<>
										<div className="flex select-none">
											{testResults.map((result, index) => (
												<button
													key={index}
													onClick={() => setActiveTestCaseId(index)}
													className="mr-2 font-semibold items-center transition-all focus:outline-none inline-flex relative rounded-lg px-4 py-1.5 cursor-pointer whitespace-nowrap text-xs font-bold"
													style={activeTestCaseId === index
														? { color: result.passed ? "var(--bc-success)" : "var(--bc-error)", background: "var(--bg-dark-fill-3)", border: "1px solid var(--border-accent)" }
														: { color: "var(--text-muted)", background: "var(--bg-dark-fill-3)", border: "1px solid transparent" }
													}
												>
													Case {index + 1} {result.passed ? "✓" : "✗"}
												</button>
											))}
										</div>

										{testResults[activeTestCaseId] && (
											<div className="font-semibold my-4">
												<p className="text-xs font-bold mt-4" style={{ color: "var(--text-secondary)" }}>Input:</p>
												<div className="w-full rounded-lg border px-4 py-3 mt-2 font-mono text-xs whitespace-pre-wrap" style={{ background: "var(--bg-testcase)", borderColor: "var(--border-testcase)", color: "var(--text-testcase)" }}>
													{testResults[activeTestCaseId].input}
												</div>
												{testResults[activeTestCaseId].expected && (
													<>
														<p className="text-xs font-bold mt-4" style={{ color: "var(--text-secondary)" }}>Expected Output:</p>
														<div className="w-full rounded-lg border px-4 py-3 mt-2 font-mono text-xs whitespace-pre-wrap" style={{ background: "var(--bg-testcase)", borderColor: "var(--border-testcase)", color: "var(--text-testcase)" }}>
															{testResults[activeTestCaseId].expected}
														</div>
													</>
												)}
												<p className="text-xs font-bold mt-4" style={{ color: "var(--text-secondary)" }}>Your Output:</p>
												<div className="w-full rounded-lg border px-4 py-3 mt-2 font-mono text-xs whitespace-pre-wrap text-rose-500" style={{ background: "var(--bg-testcase)", borderColor: "var(--border-testcase)" }}>
													{testResults[activeTestCaseId].actual || <span className="italic text-gray-500">Empty Output</span>}
												</div>
												{testResults[activeTestCaseId].error && (
													<>
														<p className="text-xs font-bold mt-4 text-rose-500">Error Details:</p>
														<pre className="w-full rounded-lg border p-4 font-mono text-xs whitespace-pre-wrap text-rose-400 bg-black/40 border-border-subtle" style={{ borderColor: "var(--border-subtle)" }}>
															{testResults[activeTestCaseId].error}
														</pre>
													</>
												)}
											</div>
										)}
									</>
								)}
							</div>
						) : runStatus === "compile_error" ? (
							<div className="space-y-4">
								<div className="text-rose-550 text-lg font-black flex items-center gap-2">
									<span>Compilation Error</span>
								</div>
								<div className="text-xs font-semibold text-text-muted" style={{ color: "var(--text-muted)" }}>Details:</div>
								<pre className="text-xs font-mono p-4 rounded-xl border overflow-auto max-h-[180px] whitespace-pre-wrap text-red-400 bg-black/60 border-border-subtle" style={{ borderColor: "var(--border-subtle)" }}>
									{runMessage}
								</pre>
							</div>
						) : (
							<div className="text-center py-6">
								<div className="text-rose-500 font-bold mb-2">Execution Error</div>
								<div className="text-xs font-semibold text-text-muted" style={{ color: "var(--text-muted)" }}>{runMessage}</div>
							</div>
						)}
					</div>
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
