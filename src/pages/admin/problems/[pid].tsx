import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { useAdmin } from "@/hooks/useAdmin";
import Topbar from "@/components/Topbar/Topbar";
import JSZip from "jszip";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { firestore, auth } from "@/firebase/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import Link from "next/link";
import { FaChevronLeft, FaPlus, FaTrash, FaEdit, FaCheck, FaTimes, FaCloudUploadAlt, FaExclamationTriangle, FaSpinner } from "react-icons/fa";
import MarkdownEditor from "@/components/Admin/MarkdownEditor";
import TagInput from "@/components/Admin/TagInput";

interface Example {
	id: number;
	inputText: string;
	outputText: string;
	explanation?: string;
	img?: string;
	isSample?: boolean;
	isAdditional?: boolean;
	strength?: number;
}

const EditProblem: React.FC = () => {
	const router = useRouter();
	const { pid } = router.query;
	const [isAdmin, loadingAdmin] = useAdmin();
	const [user] = useAuthState(auth);

	const [activeTab, setActiveTab] = useState("details");
	const [loadingProblem, setLoadingProblem] = useState(true);

	const [submitting, setSubmitting] = useState(false);
	const [statusRibbon, setStatusRibbon] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

	const triggerStatusRibbon = (type: "success" | "error" | "info", message: string, duration = 4000) => {
		setStatusRibbon({ type, message });
		if (duration > 0) {
			setTimeout(() => {
				setStatusRibbon((prev) => prev?.message === message ? null : prev);
			}, duration);
		}
	};

	// Details fields
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [language, setLanguage] = useState("English");
	const [difficulty, setDifficulty] = useState("Medium");
	const [problemStatement, setProblemStatement] = useState("");
	const [inputFormat, setInputFormat] = useState("");
	const [constraints, setConstraints] = useState("");
	const [outputFormat, setOutputFormat] = useState("");
	const [tags, setTags] = useState<string[]>([]);

	// Moderators fields
	const [moderators, setModerators] = useState<string[]>([]);
	const [newModEmail, setNewModEmail] = useState("");

	// Test Cases fields
	const [examples, setExamples] = useState<Example[]>([]);
	const [autofillSample, setAutofillSample] = useState(true);
	
	// Test Case Editing state
	const [isEditingTestCase, setIsEditingTestCase] = useState(false);
	const [editingTestCaseIndex, setEditingTestCaseIndex] = useState<number | null>(null);
	const [tcInput, setTcInput] = useState("");
	const [tcOutput, setTcOutput] = useState("");
	const [tcExplanation, setTcExplanation] = useState("");
	const [tcImg, setTcImg] = useState("");
	const [tcIsSample, setTcIsSample] = useState(false);
	const [tcIsAdditional, setTcIsAdditional] = useState(false);
	const [tcStrength, setTcStrength] = useState(1);

	// Code Stubs fields
	const [starterCode, setStarterCode] = useState("");
	const [starterFunctionName, setStarterFunctionName] = useState("");

	// Settings fields
	const [category, setCategory] = useState("Array");
	const [order, setOrder] = useState(1);
	const [videoId, setVideoId] = useState("");
	const [link, setLink] = useState("");
		const [handlerFunction, setHandlerFunction] = useState("");

	// Custom Checker fields
	const [customCheckerType, setCustomCheckerType] = useState("exact");
	const [customCheckerEpsilon, setCustomCheckerEpsilon] = useState(1e-6);
	const [customCheckerLang, setCustomCheckerLang] = useState("python");
	const [customCheckerCode, setCustomCheckerCode] = useState("");

	// Editorial fields
	const [editorialMarkdown, setEditorialMarkdown] = useState("");
	const [editorialVideoUrl, setEditorialVideoUrl] = useState("");

	// File Input ref for zip/json import
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!loadingAdmin && !isAdmin) {
			router.push("/");
		}
	}, [isAdmin, loadingAdmin, router]);

	useEffect(() => {
		const loadProblemData = async () => {
			if (!pid) return;
			setLoadingProblem(true);
			try {
				const docRef = doc(firestore, "problems", pid as string);
				const docSnap = await getDoc(docRef);

				if (docSnap.exists()) {
					const data = docSnap.data();
					setTitle(data.title || "");
					setDescription(data.description || "");
					setLanguage(data.language || "English");
					setDifficulty(data.difficulty || "Medium");
					setProblemStatement(data.problemStatement || "");
					setInputFormat(data.inputFormat || "");
					setConstraints(data.constraints || "");
					setOutputFormat(data.outputFormat || "");
					setTags(data.tags || []);
					
					// moderators
					if (data.moderators && Array.isArray(data.moderators)) {
						setModerators(data.moderators);
					} else {
						// Fallback to current user if empty
						setModerators(user?.email ? [user.email] : []);
					}

					setStarterCode(data.starterCode || "");
					setStarterFunctionName(data.starterFunctionName || "");
					setCategory(data.category || "Array");
					setOrder(Number(data.order) || 1);
					setVideoId(data.videoId || "");
					setLink(data.link || "");
					setHandlerFunction(data.handlerFunction || "");
					setExamples(data.examples || []);
					setCustomCheckerType(data.customChecker?.type || "exact");
					setCustomCheckerEpsilon(data.customChecker?.epsilon || 1e-6);
					setCustomCheckerLang(data.customChecker?.scriptLanguage || "python");
					setCustomCheckerCode(data.customChecker?.scriptCode || "");
					setEditorialMarkdown(data.editorial?.markdown || "");
					setEditorialVideoUrl(data.editorial?.videoUrl || "");
				} else {
					triggerStatusRibbon("error", "Problem not found in Firestore.");
					router.push("/admin");
				}
			} catch (error: any) {
				console.error("Error loading problem data:", error);
				triggerStatusRibbon("error", "Failed to load problem data.");
			} finally {
				setLoadingProblem(false);
			}
		};

		if (isAdmin && pid) {
			loadProblemData();
		}
	}, [isAdmin, pid, router, user]);

	// Moderators logic
	const handleAddModerator = (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = newModEmail.trim().toLowerCase();
		if (!trimmed) return;
		if (moderators.includes(trimmed)) {
			triggerStatusRibbon("error", "Moderator already added.");
			return;
		}
		setModerators((prev) => [...prev, trimmed]);
		setNewModEmail("");
		triggerStatusRibbon("success", `Added ${trimmed} to moderators list (save to apply changes).`);
	};

	const handleRemoveModerator = (emailToRemove: string) => {
		if (moderators.indexOf(emailToRemove) === 0) {
			triggerStatusRibbon("error", "Cannot remove the owner.");
			return;
		}
		setModerators((prev) => prev.filter((email) => email !== emailToRemove));
		triggerStatusRibbon("info", `Removed ${emailToRemove} (save to apply changes).`);
	};

	// Test Cases logic
	const handleAddTestCaseClick = () => {
		setIsEditingTestCase(true);
		setEditingTestCaseIndex(null);
		setTcInput("");
		setTcOutput("");
		setTcExplanation("");
		setTcImg("");
		setTcIsSample(false);
		setTcIsAdditional(false);
		setTcStrength(1);
	};

	const handleEditTestCaseClick = (index: number) => {
		const tc = examples[index];
		setIsEditingTestCase(true);
		setEditingTestCaseIndex(index);
		setTcInput(tc.inputText);
		setTcOutput(tc.outputText);
		setTcExplanation(tc.explanation || "");
		setTcImg(tc.img || "");
		setTcIsSample(!!tc.isSample);
		setTcIsAdditional(!!tc.isAdditional);
		setTcStrength(tc.strength || 1);
	};

	const handleSaveTestCase = () => {
		if (!tcInput.trim() || !tcOutput.trim()) {
			triggerStatusRibbon("error", "Input and Output fields are required for a test case.");
			return;
		}

		const newTc: Example = {
			id: editingTestCaseIndex !== null ? examples[editingTestCaseIndex].id : examples.length + 1,
			inputText: tcInput,
			outputText: tcOutput,
			explanation: tcExplanation.trim() || undefined,
			img: tcImg.trim() || undefined,
			isSample: tcIsSample,
			isAdditional: tcIsAdditional,
			strength: Number(tcStrength) || 1,
		};

		if (editingTestCaseIndex !== null) {
			// Update existing
			setExamples((prev) => {
				const updated = [...prev];
				updated[editingTestCaseIndex] = newTc;
				return updated;
			});
			triggerStatusRibbon("success", "Test case updated locally.");
		} else {
			// Create new
			setExamples((prev) => [...prev, newTc]);
			triggerStatusRibbon("success", "Test case added locally.");
		}

		setIsEditingTestCase(false);
	};

	const handleRemoveTestCase = (index: number) => {
		const newExamples = examples.filter((_, idx) => idx !== index);
		// re-index
		const reindexed = newExamples.map((ex, idx) => ({ ...ex, id: idx + 1 }));
		setExamples(reindexed);
		triggerStatusRibbon("info", "Test case removed locally.");
	};

	// File Upload / Import logic
	const handleFileUploadClick = () => {
		fileInputRef.current?.click();
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		if (file.name.endsWith(".zip")) {
			const reader = new FileReader();
			reader.onload = async (event) => {
				try {
					const arrayBuffer = event.target?.result as ArrayBuffer;
					const zip = await JSZip.loadAsync(arrayBuffer);
					
					const fileMap: Record<string, string> = {};
					const fileNames: string[] = [];

					const promises: Promise<void>[] = [];
					zip.forEach((relativePath, fileInfo) => {
						if (!fileInfo.dir && !relativePath.includes("__MACOSX")) {
							promises.push(
								fileInfo.async("string").then((content) => {
									fileMap[relativePath] = content;
									fileNames.push(relativePath);
								})
							);
						}
					});

					await Promise.all(promises);

					const inputFiles: { name: string; key: string; num: string }[] = [];
					const outputFiles: { name: string; key: string; num: string }[] = [];

					fileNames.forEach((name) => {
						const lowerName = name.toLowerCase();
						const filenameOnly = name.split("/").pop() || "";
						
						const numbers = filenameOnly.match(/\d+/);
						const num = numbers ? numbers[0] : filenameOnly;

						const isInput = lowerName.includes("input") || lowerName.endsWith(".in") || lowerName.includes("/in/") || filenameOnly.startsWith("in");
						const isOutput = lowerName.includes("output") || lowerName.includes("expected") || lowerName.endsWith(".out") || lowerName.endsWith(".ans") || lowerName.includes("/out/") || filenameOnly.startsWith("out") || filenameOnly.startsWith("ans");

						if (isInput) {
							inputFiles.push({ name: filenameOnly, key: name, num });
						} else if (isOutput) {
							outputFiles.push({ name: filenameOnly, key: name, num });
						}
					});

					const importedCases: Example[] = [];
					
					inputFiles.forEach((inF) => {
						const outF = outputFiles.find((o) => o.num === inF.num) || 
									 outputFiles.find((o) => o.name.replace(/output|expected|ans/i, "input") === inF.name);

						if (outF) {
							importedCases.push({
								id: 0,
								inputText: fileMap[inF.key],
								outputText: fileMap[outF.key],
								explanation: "",
								img: "",
								isSample: inF.key.toLowerCase().includes("sample") || false,
								isAdditional: false,
								strength: 1,
							});
						}
					});

					if (importedCases.length === 0) {
						triggerStatusRibbon("error", "Could not automatically pair any input/output files in the ZIP. Ensure files have matching numbers (e.g. input_1.txt & output_1.txt).");
						return;
					}

					importedCases.sort((a, b) => {
						const numA = Number(a.inputText.match(/\d+/) || 0);
						const numB = Number(b.inputText.match(/\d+/) || 0);
						return numA - numB;
					});

					const finalCases = importedCases.map((tc, idx) => ({
						...tc,
						id: examples.length + idx + 1,
						isSample: tc.isSample || (examples.length + idx < 3)
					}));

					setExamples((prev) => [...prev, ...finalCases]);
					triggerStatusRibbon("success", `Successfully imported and paired ${finalCases.length} test cases from ZIP!`);
				} catch (err: any) {
					triggerStatusRibbon("error", `Error reading ZIP archive: ${err.message}`);
				}
			};
			reader.readAsArrayBuffer(file);
			e.target.value = "";
			return;
		}

		const reader = new FileReader();
		reader.onload = (event) => {
			try {
				const content = event.target?.result as string;
				const parsed = JSON.parse(content);
				
				if (!Array.isArray(parsed)) {
					throw new Error("JSON file must contain an array of test cases.");
				}

				const importedCases = parsed.map((item: any, idx: number) => {
					return {
						id: examples.length + idx + 1,
						inputText: item.inputText || item.input || "",
						outputText: item.outputText || item.output || "",
						explanation: item.explanation || "",
						img: item.img || "",
						isSample: !!item.isSample || !!item.sample,
						isAdditional: !!item.isAdditional || !!item.additional,
						strength: Number(item.strength) || 1,
					};
				});

				const invalid = importedCases.some((tc: any) => !tc.inputText || !tc.outputText);
				if (invalid) {
					triggerStatusRibbon("error", "Imported cases must contain non-empty Input and Output fields.");
					return;
				}

				setExamples((prev) => [...prev, ...importedCases]);
				triggerStatusRibbon("success", `Successfully imported ${importedCases.length} test cases!`);
			} catch (err: any) {
				triggerStatusRibbon("error", `Error parsing JSON: ${err.message}`);
			}
		};
		reader.readAsText(file);
		e.target.value = "";
	};

	// Main submit handler
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!title.trim() || !problemStatement.trim()) {
			triggerStatusRibbon("error", "Please fill in all required fields (Challenge Name, Problem Statement).");
			return;
		}

		setSubmitting(true);
		triggerStatusRibbon("info", "Saving changes...", 0);

		try {
			const problemData = {
				id: pid as string,
				title,
				category,
				difficulty,
				order: Number(order),
				videoId: videoId.trim() || null,
				link: link.trim() || null,
				problemStatement,
				description: description.trim() || "",
				language,
				inputFormat: inputFormat.trim() || "",
				outputFormat: outputFormat.trim() || "",
				constraints: constraints.trim() || "",
				tags,
				moderators,
				starterCode: starterCode.trim() || "",
				starterFunctionName: starterFunctionName.trim() || "",
				handlerFunction: handlerFunction.trim() || "",
				examples: examples,
				customChecker: {
					type: customCheckerType,
					epsilon: Number(customCheckerEpsilon) || 1e-6,
					scriptLanguage: customCheckerLang,
					scriptCode: customCheckerCode.trim(),
				},
				editorial: {
					markdown: editorialMarkdown.trim(),
					videoUrl: editorialVideoUrl.trim() || null,
				}
			};

			await setDoc(doc(firestore, "problems", pid as string), problemData, { merge: true });
			triggerStatusRibbon("success", "Problem updated successfully!");
			setTimeout(() => {
				router.push("/admin");
			}, 1500);
		} catch (error: any) {
			console.error("Error updating problem:", error);
			triggerStatusRibbon("error", "Failed to save changes. Please try again.");
			setSubmitting(false);
		}
	};

	if (loadingAdmin || !isAdmin) {
		return (
			<div className='bg-dark-layer-2 min-h-screen text-white flex items-center justify-center'>
				<div className='text-xl font-semibold animate-pulse'>Checking credentials...</div>
			</div>
		);
	}

	const tabs = [
		{ id: "details", label: "Details" },
		{ id: "moderators", label: "Moderators" },
		{ id: "testcases", label: "Test Cases" },
		{ id: "codestubs", label: "Code Stubs" },
		{ id: "languages", label: "Languages", disabled: true },
		{ id: "settings", label: "Settings" },
		{ id: "editorial", label: "Editorial" },
		{ id: "customchecker", label: "Custom Checker" },
	];

	return (
		<main className='bg-[#f4f6f8] min-h-screen text-gray-800 pb-16 font-sans'>
			<Topbar />
			
			<div className='max-w-[1200px] mx-auto px-6 mt-6'>
				
				{/* Breadcrumb */}
				<div className='text-xs text-gray-500 mb-2 flex items-center gap-1 font-semibold'>
					<Link href='/admin' className='hover:underline text-blue-600 transition flex items-center gap-1'>
						<FaChevronLeft size={10} className="mt-0.5" />
						Manage Challenges
					</Link>
					<span>&gt;</span>
					<span className='text-gray-600'>{pid}</span>
				</div>

				{/* Title Area */}
				<div className='flex justify-between items-center mb-6'>
					<h1 className='text-3xl font-light text-gray-800'>
						{title || pid}
					</h1>
					<button
						type='button'
						onClick={handleSubmit}
						disabled={submitting}
						className='bg-[#2ec866] hover:bg-[#27a855] text-white px-5 py-2 rounded font-semibold text-sm transition shadow-sm flex items-center gap-2 disabled:opacity-50'
					>
						{submitting ? <FaSpinner className='animate-spin' size={12} /> : <FaCheck size={12} />}
						Save Changes
					</button>
				</div>

				{/* Status Ribbon */}
				{statusRibbon && (
					<div
						className={`mb-6 p-3 rounded-lg border text-sm font-semibold transition-all duration-300 ${
							statusRibbon.type === "success"
								? "bg-emerald-950/40 text-emerald-400 border-emerald-800/50"
								: statusRibbon.type === "error"
								? "bg-rose-950/40 text-rose-400 border-rose-800/50"
								: "bg-blue-950/40 text-blue-400 border-blue-800/50"
						}`}
					>
						{statusRibbon.message}
					</div>
				)}

				{/* Tabs Navigation */}
				<div className='flex border-b border-gray-300 mb-6 bg-[#edeef0] rounded-t overflow-hidden'>
					{tabs.map((tab) => {
						const isActive = activeTab === tab.id;
						if (tab.disabled) {
							return (
								<div
									key={tab.id}
									className='px-5 py-3 text-xs font-semibold text-gray-405 cursor-not-allowed border-r border-gray-300 bg-gray-50/50'
									title='Feature coming soon'
								>
									{tab.label}
								</div>
							);
						}
						return (
							<button
								key={tab.id}
								type='button'
								onClick={() => {
									setActiveTab(tab.id);
									setIsEditingTestCase(false);
								}}
								className={`px-5 py-3 text-xs font-semibold transition border-r border-gray-300 ${
									isActive
										? "bg-white text-gray-800 border-t-2 border-t-blue-500 font-bold"
										: "text-[#576871] hover:bg-gray-200"
								}`}
							>
								{tab.label}
							</button>
						);
					})}
				</div>

				{/* Tab content area */}
				<div className='bg-white border border-gray-300 rounded shadow-sm p-8'>
					
					{loadingProblem ? (
						<div className='flex flex-col justify-center items-center py-20 gap-4'>
							<div className='w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin'></div>
							<div className='text-gray-500 font-semibold'>Loading challenge details...</div>
						</div>
					) : (
						<>
							{/* DETAILS TAB */}
							{activeTab === "details" && (
								<div className='space-y-6'>
									<p className='text-sm text-gray-500 italic border-b border-gray-100 pb-4'>
										This is the basic information that describes your challenge.
									</p>

									{/* Language */}
									<div className='grid grid-cols-12 gap-4 items-center'>
										<label htmlFor='language' className='col-span-3 text-right pr-6 font-semibold text-gray-700 text-sm'>
											Language
										</label>
										<div className='col-span-6'>
											<select
												id='language'
												value={language}
												onChange={(e) => setLanguage(e.target.value)}
												className='border border-gray-300 outline-none rounded p-2 bg-white text-sm w-full focus:border-blue-500 transition shadow-sm'
											>
												<option value='English'>English</option>
												<option value='Vietnamese'>Vietnamese</option>
												<option value='Spanish'>Spanish</option>
												<option value='Japanese'>Japanese</option>
											</select>
										</div>
									</div>

									{/* Difficulty */}
									<div className='grid grid-cols-12 gap-4 items-center'>
										<label htmlFor='difficulty' className='col-span-3 text-right pr-6 font-semibold text-gray-700 text-sm'>
											Challenge Difficulty
										</label>
										<div className='col-span-6'>
											<select
												id='difficulty'
												value={difficulty}
												onChange={(e) => setDifficulty(e.target.value)}
												className='border border-gray-300 outline-none rounded p-2 bg-white text-sm w-full focus:border-blue-500 transition shadow-sm'
											>
												<option value='Easy'>Easy</option>
												<option value='Medium'>Medium</option>
												<option value='Hard'>Hard</option>
											</select>
										</div>
									</div>

									{/* Challenge Name */}
									<div className='grid grid-cols-12 gap-4 items-center'>
										<label htmlFor='title' className='col-span-3 text-right pr-6 font-semibold text-gray-700 text-sm'>
											Challenge Name
										</label>
										<div className='col-span-7'>
											<input
												type='text'
												id='title'
												value={title}
												onChange={(e) => setTitle(e.target.value)}
												className='border border-gray-300 outline-none rounded p-2 text-sm w-full focus:border-blue-500 transition shadow-sm bg-white'
												required
											/>
										</div>
									</div>

									{/* Challenge Slug */}
									<div className='grid grid-cols-12 gap-4 items-start'>
										<div className='col-span-3 text-right pr-6 font-semibold text-gray-700 text-sm pt-2'>
											Challenge Slug
										</div>
										<div className='col-span-7'>
											<input
												type='text'
												value={`https://leetcode-yt.com/problems/${pid}`}
												disabled
												className='border border-gray-200 outline-none rounded p-2 text-sm w-full bg-gray-50 text-gray-500 font-mono select-all cursor-not-allowed'
											/>
											<span className='text-[11px] text-gray-400 mt-1 block italic font-semibold'>
												Slug can only be updated within 48 hours after creation of a challenge.
											</span>
										</div>
									</div>

									{/* Description */}
									<div className='grid grid-cols-12 gap-4 items-start'>
										<label htmlFor='description' className='col-span-3 text-right pr-6 font-semibold text-gray-700 text-sm pt-2'>
											Description
										</label>
										<div className='col-span-9'>
											<textarea
												id='description'
												value={description}
												onChange={(e) => setDescription(e.target.value.slice(0, 140))}
												rows={3}
												className='border border-gray-300 outline-none rounded p-3 text-sm w-full focus:border-blue-500 transition shadow-sm font-sans bg-white resize-y'
											/>
											<div className='text-right text-xs text-gray-400 mt-1 font-semibold'>
												Characters left: {140 - description.length}
											</div>
										</div>
									</div>

									{/* Problem Statement */}
									<div className='grid grid-cols-12 gap-4 items-start'>
										<label className='col-span-3 text-right pr-6 font-semibold text-gray-700 text-sm pt-2'>
											Problem Statement
										</label>
										<div className='col-span-9'>
											<MarkdownEditor
												value={problemStatement}
												onChange={setProblemStatement}
												placeholder='Write the full problem definition here...'
												height='220px'
											/>
										</div>
									</div>

									{/* Input Format */}
									<div className='grid grid-cols-12 gap-4 items-start'>
										<label className='col-span-3 text-right pr-6 font-semibold text-gray-700 text-sm pt-2'>
											Input Format
										</label>
										<div className='col-span-9'>
											<MarkdownEditor
												value={inputFormat}
												onChange={setInputFormat}
												placeholder='Detail the formatting of inputs...'
												height='150px'
											/>
										</div>
									</div>

									{/* Constraints */}
									<div className='grid grid-cols-12 gap-4 items-start'>
										<label className='col-span-3 text-right pr-6 font-semibold text-gray-700 text-sm pt-2'>
											Constraints
										</label>
										<div className='col-span-9'>
											<MarkdownEditor
												value={constraints}
												onChange={setConstraints}
												placeholder='e.g. 1 <= nums.length <= 10^4'
												height='150px'
											/>
										</div>
									</div>

									{/* Output Format */}
									<div className='grid grid-cols-12 gap-4 items-start'>
										<label className='col-span-3 text-right pr-6 font-semibold text-gray-700 text-sm pt-2'>
											Output Format
										</label>
										<div className='col-span-9'>
											<MarkdownEditor
												value={outputFormat}
												onChange={setOutputFormat}
												placeholder='Detail the formatting of expected outputs...'
												height='150px'
											/>
										</div>
									</div>

									{/* Tags */}
									<div className='grid grid-cols-12 gap-4 items-start'>
										<label className='col-span-3 text-right pr-6 font-semibold text-gray-700 text-sm pt-2'>
											Tags
										</label>
										<div className='col-span-9'>
											<TagInput tags={tags} onChange={setTags} />
										</div>
									</div>
								</div>
							)}

							{/* MODERATORS TAB */}
							{activeTab === "moderators" && (
								<div className='space-y-6'>
									<div>
										<h3 className='text-lg font-semibold text-gray-800 mb-1'>Moderators</h3>
										<p className='text-xs text-gray-500 mb-4'>
											Moderators can edit this challenge and manage its settings.
										</p>
									</div>

									{/* Add moderator form */}
									<form onSubmit={handleAddModerator} className='flex gap-3 max-w-xl items-start'>
										<div className='flex-1'>
											<input
												type='email'
												value={newModEmail}
												onChange={(e) => setNewModEmail(e.target.value)}
												placeholder="Enter moderator's email address"
												className='border border-gray-300 outline-none rounded p-2 text-sm w-full focus:border-blue-500 bg-white'
											/>
											<span className='text-[10px] text-gray-400 mt-1 block font-semibold'>
												Enter moderator email. Moderators can edit this challenge.
											</span>
										</div>
										<button
											type='submit'
											className='bg-[#edeef0] border border-gray-300 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded font-semibold text-sm transition shadow-sm'
										>
											Add
										</button>
									</form>

									{/* Moderators List */}
									<div className='mt-8 max-w-2xl'>
										<h4 className='text-sm font-semibold text-gray-700 mb-3 border-b border-gray-150 pb-2'>
											Current Access
										</h4>

										<div className='space-y-3'>
											{moderators.map((email, idx) => (
												<div key={idx} className='flex justify-between items-center bg-gray-50 p-3 rounded border border-gray-200 hover:bg-gray-100/70 transition'>
													<div className='flex items-center gap-3'>
														<div className='w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600 text-sm'>
															{email.charAt(0).toUpperCase()}
														</div>
														<div>
															<p className='text-sm font-semibold text-gray-800'>{email}</p>
															<p className='text-xs text-gray-400'>{idx === 0 ? "owner" : "moderator"}</p>
														</div>
													</div>

													{idx !== 0 && (
														<button
															type='button'
															onClick={() => handleRemoveModerator(email)}
															className='text-red-500 hover:text-red-700 text-xs font-semibold hover:underline bg-transparent'
														>
															Revoke Access
														</button>
													)}
													
													{idx === 0 && (
														<span className='bg-gray-200 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase select-none border border-gray-300'>
															Owner
														</span>
													)}
												</div>
											))}
										</div>
									</div>
								</div>
							)}

							{/* TEST CASES TAB */}
							{activeTab === "testcases" && (
								<div className='space-y-6'>
									<div>
										<h3 className='text-lg font-semibold text-gray-800 mb-1'>Test Cases</h3>
										<p className='text-xs text-[#576871] leading-relaxed'>
											Add test cases to judge the correctness of a user&apos;s code. Refer to these{" "}
											<a href='#' className='text-blue-600 hover:underline'>instructions</a> to write a good test case.
											<br />
											<button type="button" onClick={handleFileUploadClick} className='text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold text-[11px] mt-1 bg-transparent'>
												Import test cases (.json or paired .zip)
											</button>
											<input
												ref={fileInputRef}
												type='file'
												accept='.json,.zip'
												onChange={handleFileChange}
												className='hidden'
											/>
										</p>
									</div>

									{/* Alert when empty */}
									{examples.length === 0 && (
										<div className='border-l-4 border-[#ff9c00] bg-[#fdf8e2]/60 p-4 rounded-r flex gap-3 items-start max-w-4xl shadow-sm'>
											<FaExclamationTriangle size={16} className='text-[#ff9c00] mt-0.5' />
											<div>
												<p className='text-sm font-semibold text-[#805000]'>
													You do not have any test cases for this challenge.
												</p>
												<p className='text-xs text-[#b37409] font-medium mt-1'>
													Add at least one test case to allow users to submit solutions.
												</p>
											</div>
										</div>
									)}

									{/* Action buttons */}
									{!isEditingTestCase && (
										<div className='flex justify-between items-center max-w-5xl pt-2'>
											<div className='flex items-center gap-2'>
												<input
													type='checkbox'
													id='autofill'
													checked={autofillSample}
													onChange={(e) => setAutofillSample(e.target.checked)}
													className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 shadow-sm'
												/>
												<label htmlFor='autofill' className='text-xs font-semibold text-[#576871] select-none cursor-pointer'>
													Autofill Sample Input, Sample Output, and Explanation fields for all test cases marked as Sample.
												</label>
											</div>

											<div className='flex gap-2.5'>
												<button
													type='button'
													onClick={handleFileUploadClick}
													className='bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded font-semibold text-xs transition shadow-sm flex items-center gap-1.5'
												>
													<FaCloudUploadAlt size={14} className="text-gray-500" />
													Upload JSON
												</button>
												<button
													type='button'
													onClick={handleAddTestCaseClick}
													className='bg-[#2ec866] hover:bg-[#27a855] text-white px-4 py-2 rounded font-semibold text-xs transition shadow-sm flex items-center gap-1'
												>
													<FaPlus size={10} />
													Add Test Case
												</button>
											</div>
										</div>
									)}

									{/* Test Case Editor (Form) */}
									{isEditingTestCase && (
										<div className='border border-blue-200 bg-blue-50/20 p-6 rounded-lg max-w-4xl space-y-4 shadow-sm relative'>
											<h4 className='text-sm font-bold text-blue-700 border-b border-blue-100 pb-2 mb-2'>
												{editingTestCaseIndex !== null ? `Edit Test Case ${editingTestCaseIndex + 1}` : "Add New Test Case"}
											</h4>

											<button
												type='button'
												onClick={() => setIsEditingTestCase(false)}
												className='absolute top-4 right-4 text-gray-400 hover:text-gray-600'
												title='Cancel'
											>
												<FaTimes size={16} />
											</button>

											<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
												<div>
													<label className='text-xs font-bold block mb-1 text-gray-600'>Input (stdin) <span className='text-red-500'>*</span></label>
													<textarea
														value={tcInput}
														onChange={(e) => setTcInput(e.target.value)}
														rows={5}
														className='border border-gray-300 outline-none text-xs rounded block w-full p-2.5 bg-white text-gray-800 font-mono focus:border-blue-500 shadow-sm'
														placeholder={'e.g. 4\n2 7 11 15\n9'}
														required
													/>
												</div>
												<div>
													<label className='text-xs font-bold block mb-1 text-gray-600'>Output (stdout) <span className='text-red-500'>*</span></label>
													<textarea
														value={tcOutput}
														onChange={(e) => setTcOutput(e.target.value)}
														rows={5}
														className='border border-gray-300 outline-none text-xs rounded block w-full p-2.5 bg-white text-gray-800 font-mono focus:border-blue-500 shadow-sm'
														placeholder='e.g. 0 1'
														required
													/>
												</div>
												<div className='col-span-1 md:col-span-2'>
													<label className='text-xs font-bold block mb-1 text-gray-600'>Explanation (Optional)</label>
													<textarea
														value={tcExplanation}
														onChange={(e) => setTcExplanation(e.target.value)}
														rows={2}
														className='border border-gray-300 outline-none text-xs rounded block w-full p-2.5 bg-white text-gray-800 focus:border-blue-500 shadow-sm'
														placeholder='Explain why this input maps to the output'
													/>
												</div>
												<div className='col-span-1 md:col-span-2'>
													<label className='text-xs font-bold block mb-1 text-gray-600'>Image URL (Optional)</label>
													<input
														type='text'
														value={tcImg}
														onChange={(e) => setTcImg(e.target.value)}
														className='border border-gray-300 outline-none text-xs rounded block w-full p-2 bg-white text-gray-800 focus:border-blue-500 shadow-sm'
														placeholder='e.g. https://assets.leetcode.com/uploads/...'
													/>
												</div>
											</div>

											<div className='flex flex-wrap gap-6 pt-2 items-center'>
												<div className='flex items-center gap-2'>
													<input
														type='checkbox'
														id='tcSample'
														checked={tcIsSample}
														onChange={(e) => setTcIsSample(e.target.checked)}
														className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 shadow-sm'
													/>
													<label htmlFor='tcSample' className='text-xs font-bold text-gray-600 select-none cursor-pointer'>
														Is Sample Case
													</label>
												</div>

												<div className='flex items-center gap-2'>
													<input
														type='checkbox'
														id='tcAdditional'
														checked={tcIsAdditional}
														onChange={(e) => setTcIsAdditional(e.target.checked)}
														className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 shadow-sm'
													/>
													<label htmlFor='tcAdditional' className='text-xs font-bold text-gray-600 select-none cursor-pointer'>
														Is Additional Case
													</label>
												</div>

												<div className='flex items-center gap-2'>
													<label htmlFor='tcStrength' className='text-xs font-bold text-gray-600 select-none'>
														Strength:
													</label>
													<input
														type='number'
														id='tcStrength'
														value={tcStrength}
														onChange={(e) => setTcStrength(Number(e.target.value) || 1)}
														min={1}
														className='border border-gray-300 rounded px-2 py-1 text-xs w-16 bg-white outline-none focus:border-blue-500 shadow-sm'
													/>
												</div>
											</div>

											<div className='flex justify-end gap-2 pt-2'>
												<button
													type='button'
													onClick={() => setIsEditingTestCase(false)}
													className='bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 px-4 py-2 rounded font-semibold text-xs transition'
												>
													Cancel
												</button>
												<button
													type='button'
													onClick={handleSaveTestCase}
													className='bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded font-bold text-xs transition shadow-sm'
												>
													Save Case
												</button>
											</div>
										</div>
									)}

									{/* Test Cases Table */}
									{examples.length > 0 && (
										<div className='border border-gray-300 rounded overflow-hidden max-w-5xl shadow-sm'>
											<table className='w-full text-left border-collapse bg-white text-xs text-gray-600'>
												<thead>
													<tr className='bg-gray-100 text-gray-700 font-bold border-b border-gray-300 uppercase text-[10px] select-none'>
														<th className='px-4 py-3 w-16 text-center'>Order</th>
														<th className='px-4 py-3'>Input</th>
														<th className='px-4 py-3'>Output</th>
														<th className='px-4 py-3 w-28'>Tag</th>
														<th className='px-4 py-3 w-20 text-center'>Sample</th>
														<th className='px-4 py-3 w-20 text-center'>Additional</th>
														<th className='px-4 py-3 w-20 text-center'>Strength</th>
														<th className='px-4 py-3 w-24 text-center'>Actions</th>
													</tr>
												</thead>
												<tbody className='divide-y divide-gray-200'>
													{examples.map((tc, idx) => (
														<tr key={idx} className='hover:bg-gray-50/80 transition'>
															<td className='px-4 py-3 font-mono font-semibold text-center text-gray-500'>{idx + 1}</td>
															<td className='px-4 py-3 font-mono max-w-[150px] truncate text-gray-800' title={tc.inputText}>
																{tc.inputText.substring(0, 40)}{tc.inputText.length > 40 ? "..." : ""}
															</td>
															<td className='px-4 py-3 font-mono max-w-[150px] truncate text-gray-800' title={tc.outputText}>
																{tc.outputText.substring(0, 40)}{tc.outputText.length > 40 ? "..." : ""}
															</td>
															<td className='px-4 py-3 font-semibold text-gray-500'>
																{tc.explanation ? "With explanation" : "Standard"}
															</td>
															<td className='px-4 py-3 text-center'>
																<input
																	type='checkbox'
																	checked={!!tc.isSample}
																	onChange={(e) => {
																		setExamples((prev) => {
																			const updated = [...prev];
																			updated[idx] = { ...updated[idx], isSample: e.target.checked };
																			return updated;
																		});
																	}}
																	className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 shadow-sm'
																/>
															</td>
															<td className='px-4 py-3 text-center'>
																<input
																	type='checkbox'
																	checked={!!tc.isAdditional}
																	onChange={(e) => {
																		setExamples((prev) => {
																			const updated = [...prev];
																			updated[idx] = { ...updated[idx], isAdditional: e.target.checked };
																			return updated;
																		});
																	}}
																	className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 shadow-sm'
																/>
															</td>
															<td className='px-4 py-3 text-center font-mono font-semibold text-gray-700'>{tc.strength || 1}</td>
															<td className='px-4 py-3 text-center'>
																<div className='flex gap-1 justify-center'>
																	<button
																		type='button'
																		onClick={() => handleEditTestCaseClick(idx)}
																		className='p-1.5 hover:bg-gray-100 text-blue-600 hover:text-blue-800 rounded transition'
																		title='Edit case'
																	>
																		<FaEdit size={13} />
																	</button>
																	<button
																		type='button'
																		onClick={() => handleRemoveTestCase(idx)}
																		className='p-1.5 hover:bg-gray-100 text-red-500 hover:text-red-700 rounded transition'
																		title='Delete case'
																	>
																		<FaTrash size={12} />
																	</button>
																</div>
															</td>
														</tr>
													))}
												</tbody>
											</table>

											<div className='bg-gray-50 p-4 border-t border-gray-200 select-none'>
												<span className='text-xs font-semibold text-gray-500'>
													You will get <span className='text-green-600 bg-green-50 border border-green-200 rounded px-1.5 py-0.5 font-bold font-mono'>100.00%</span> of the maximum score if you pass the selected test cases.
												</span>
											</div>
										</div>
									)}
								</div>
							)}

							{/* CODE STUBS TAB */}
							{activeTab === "codestubs" && (
								<div className='space-y-6'>
									<h3 className='text-lg font-semibold text-gray-800 border-b border-gray-100 pb-3'>
										Starter Code Templates
									</h3>
									
									<div>
										<label htmlFor='starterFunctionName' className='text-sm font-semibold block mb-2 text-gray-700'>
											Starter Function Signature Prefix (Optional)
										</label>
										<input
											type='text'
											id='starterFunctionName'
											value={starterFunctionName}
											onChange={(e) => setStarterFunctionName(e.target.value)}
											placeholder='e.g. function solve('
											className='border border-gray-300 outline-none rounded p-2 text-sm w-full focus:border-blue-500 transition font-mono bg-white'
										/>
										<span className='text-xs text-gray-500 mt-1 block'>
											Leave empty for standard CP-style (stdin/stdout) problems.
										</span>
									</div>

									<div>
										<label htmlFor='starterCode' className='text-sm font-semibold block mb-2 text-gray-700'>
											Starter Code Template (Optional)
										</label>
										<textarea
											id='starterCode'
											value={starterCode}
											onChange={(e) => setStarterCode(e.target.value)}
											rows={10}
											placeholder='// Write starter template here...'
											className='border border-gray-300 outline-none rounded p-3 text-sm w-full focus:border-blue-500 transition font-mono bg-white'
										/>
									</div>
								</div>
							)}

							{/* SETTINGS TAB */}
							{activeTab === "settings" && (
								<div className='space-y-6'>
									<h3 className='text-lg font-semibold text-gray-800 border-b border-gray-100 pb-3'>
										Integration & Extra Settings
									</h3>

									<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
										<div>
											<label htmlFor='category' className='text-sm font-semibold block mb-2 text-gray-700'>
												Category / Topic
											</label>
											<input
												type='text'
												id='category'
												value={category}
												onChange={(e) => setCategory(e.target.value)}
												className='border border-gray-300 outline-none rounded p-2 text-sm w-full focus:border-blue-500 bg-white'
											/>
										</div>

										<div>
											<label htmlFor='order' className='text-sm font-semibold block mb-2 text-gray-700'>
												Sorting Order
											</label>
											<input
												type='number'
												id='order'
												value={order}
												onChange={(e) => setOrder(Number(e.target.value))}
												className='border border-gray-300 outline-none rounded p-2 text-sm w-full focus:border-blue-500 bg-white'
											/>
										</div>

										<div>
											<label htmlFor='videoId' className='text-sm font-semibold block mb-2 text-gray-700'>
												YouTube Video ID (Optional)
											</label>
											<input
												type='text'
												id='videoId'
												value={videoId}
												onChange={(e) => setVideoId(e.target.value)}
												placeholder='e.g. qm_T3YV8yks'
												className='border border-gray-300 outline-none rounded p-2 text-sm w-full focus:border-blue-500 bg-white'
											/>
										</div>

										<div>
											<label htmlFor='link' className='text-sm font-semibold block mb-2 text-gray-700'>
												External Original Link (Optional)
											</label>
											<input
												type='url'
												id='link'
												value={link}
												onChange={(e) => setLink(e.target.value)}
												placeholder='e.g. https://leetcode.com/problems/...'
												className='border border-gray-[#ccc] outline-none rounded p-2 text-sm w-full focus:border-blue-500 bg-white'
											/>
										</div>
									</div>

									<div>
										<label htmlFor='handlerFunction' className='text-sm font-semibold block mb-2 text-gray-700'>
											JavaScript Handler Function (Legacy execution scripts)
										</label>
										<textarea
											id='handlerFunction'
											value={handlerFunction}
											onChange={(e) => setHandlerFunction(e.target.value)}
											rows={8}
											className='border border-gray-300 outline-none rounded p-3 text-sm w-full focus:border-blue-500 font-mono bg-white'
										/>
									</div>
								</div>
							)}

							{/* EDITORIAL TAB */}
							{activeTab === "editorial" && (
								<div className='space-y-6'>
									<div>
										<h3 className='text-lg font-semibold text-gray-800 mb-1'>Editorial / Official Solution</h3>
										<p className='text-xs text-gray-500 mb-4'>
											Provide detailed explanations, hints, analysis, or walk-through videos to help users.
										</p>
									</div>

									<div className='space-y-4'>
										<div>
											<label htmlFor='editorialVideoUrl' className='text-xs font-bold block mb-1 text-gray-650'>
												Video Solution URL (Optional YouTube or Vimeo link)
											</label>
											<input
												type='url'
												id='editorialVideoUrl'
												value={editorialVideoUrl}
												onChange={(e) => setEditorialVideoUrl(e.target.value)}
												placeholder='e.g. https://www.youtube.com/watch?v=...'
												className='border border-gray-300 outline-none rounded p-2 text-xs w-full focus:border-blue-500 bg-white'
											/>
										</div>

										<div>
											<label className='text-xs font-bold block mb-1 text-gray-650'>
												Editorial Content (Markdown Format)
											</label>
											<MarkdownEditor
												value={editorialMarkdown}
												onChange={setEditorialMarkdown}
												placeholder='Describe the optimal algorithms, time/space complexities, and approaches...'
												height='350px'
											/>
										</div>
									</div>
								</div>
							)}

							{/* CUSTOM CHECKER TAB */}
							{activeTab === "customchecker" && (
								<div className='space-y-6'>
									<div>
										<h3 className='text-lg font-semibold text-gray-800 mb-1'>Custom Output Verification</h3>
										<p className='text-xs text-gray-500 mb-4'>
											Configure how submission results are verified against testcase expected outputs.
										</p>
									</div>

									<div className='grid grid-cols-12 gap-6 items-start'>
										<div className='col-span-12 md:col-span-6 space-y-4'>
											<div>
												<label htmlFor='checkerType' className='text-xs font-bold block mb-1 text-gray-650'>
													Checker Logic Type
												</label>
												<select
													id='checkerType'
													value={customCheckerType}
													onChange={(e) => setCustomCheckerType(e.target.value)}
													className='border border-gray-300 outline-none rounded p-2 bg-white text-xs w-full focus:border-blue-500 transition shadow-sm'
												>
													<option value='exact'>Exact Token Matching</option>
													<option value='whitespace'>Ignore Extra Whitespaces & Case Insensitive</option>
													<option value='float_tolerance'>Floating Point Tolerance</option>
													<option value='special_judge'>Special Judge (Code execution validator)</option>
												</select>
											</div>

											{customCheckerType === "float_tolerance" && (
												<div>
													<label htmlFor='checkerEpsilon' className='text-xs font-bold block mb-1 text-gray-650'>
														Epsilon Tolerance (Float delta threshold)
													</label>
													<input
														type='number'
														id='checkerEpsilon'
														step='any'
														value={customCheckerEpsilon}
														onChange={(e) => setCustomCheckerEpsilon(Number(e.target.value) || 1e-6)}
														placeholder='e.g. 1e-6'
														className='border border-gray-300 outline-none rounded p-2 text-xs w-full focus:border-blue-500 bg-white font-mono'
													/>
													<span className='text-[10px] text-gray-400 mt-1 block italic font-semibold'>
														Accepts solutions if absolute or relative error is smaller than epsilon.
													</span>
												</div>
											)}

											{customCheckerType === "special_judge" && (
												<div>
													<label htmlFor='checkerLang' className='text-xs font-bold block mb-1 text-gray-650'>
														Judge script language
													</label>
													<select
														id='checkerLang'
														value={customCheckerLang}
														onChange={(e) => setCustomCheckerLang(e.target.value)}
														className='border border-gray-300 outline-none rounded p-2 bg-white text-xs w-full focus:border-blue-500 transition shadow-sm'
													>
														<option value='python'>Python 3</option>
														<option value='cpp'>C++20</option>
													</select>
												</div>
											)}
										</div>

										{customCheckerType === "special_judge" && (
											<div className='col-span-12 md:col-span-6 space-y-2'>
												<label htmlFor='checkerCode' className='text-xs font-bold block text-gray-650'>
													Judge Script Code
												</label>
												<textarea
													id='checkerCode'
													value={customCheckerCode}
													onChange={(e) => setCustomCheckerCode(e.target.value)}
													rows={12}
													placeholder={`# Python Checker Example:
# Receives 3 arguments via CLI or files: input, expected, actual
# exit(0) for accepted, exit(1) for incorrect

import sys

with open(sys.argv[1], 'r') as f:
    input_data = f.read()
with open(sys.argv[2], 'r') as f:
    expected_data = f.read()
with open(sys.argv[3], 'r') as f:
    actual_data = f.read()

# custom comparison code here...
if actual_data.strip() == expected_data.strip():
    sys.exit(0)
else:
    sys.exit(1)
`}
													className='border border-gray-300 outline-none rounded p-3 text-xs w-full focus:border-blue-500 font-mono bg-white'
												/>
											</div>
										)}
									</div>
								</div>
							)}
						</>
					)}
				</div>

				{/* Footer buttons */}
				{!loadingProblem && (
					<div className='flex justify-end gap-3 mt-6'>
						<Link
							href='/admin'
							className='bg-[#edeef0] hover:bg-gray-200 text-gray-700 px-5 py-2 rounded font-semibold text-sm transition border border-gray-300'
						>
							Cancel
						</Link>
						<button
							type='button'
							onClick={handleSubmit}
							className='bg-[#2ec866] hover:bg-[#27a855] text-white px-7 py-2 rounded font-bold text-sm transition shadow-sm'
						>
							Save Changes
						</button>
					</div>
				)}
			</div>
		</main>
	);
};

export default EditProblem;
