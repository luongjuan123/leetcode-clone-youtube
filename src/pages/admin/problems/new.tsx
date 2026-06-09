import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAdmin } from "@/hooks/useAdmin";
import Topbar from "@/components/Topbar/Topbar";
import { doc, getDoc, setDoc, getDocs, collection } from "firebase/firestore";
import { firestore, auth } from "@/firebase/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import Link from "next/link";
import { FaChevronLeft, FaPlus, FaCheck, FaSpinner } from "react-icons/fa";
import MarkdownEditor from "@/components/Admin/MarkdownEditor";
import TagInput from "@/components/Admin/TagInput";

const NewProblem: React.FC = () => {
	const router = useRouter();
	const [isAdmin, loadingAdmin] = useAdmin();
	const [user] = useAuthState(auth);

	const [activeTab, setActiveTab] = useState("details");

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
	const [id, setId] = useState("");
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [language, setLanguage] = useState("English");
	const [difficulty, setDifficulty] = useState("Medium");
	const [problemStatement, setProblemStatement] = useState("");
	const [inputFormat, setInputFormat] = useState("");
	const [constraints, setConstraints] = useState("");
	const [outputFormat, setOutputFormat] = useState("");
	const [tags, setTags] = useState<string[]>([]);

	// Code Stubs fields
	const [starterCode, setStarterCode] = useState("");
	const [starterFunctionName, setStarterFunctionName] = useState("");

	// Settings fields
	const [category, setCategory] = useState("Array");
	const [order, setOrder] = useState(1);
	const [videoId, setVideoId] = useState("");
	const [link, setLink] = useState("");
	const [handlerFunction, setHandlerFunction] = useState(
`(fn, assert) => {
  try {
    // Define test cases here
    // Example:
    // assert.deepStrictEqual(fn(2, 3), 5);
    return true;
  } catch (error: any) {
    throw new Error(error);
  }
}`
	);

	// Custom Checker fields
	const [customCheckerType, setCustomCheckerType] = useState("exact");
	const [customCheckerEpsilon, setCustomCheckerEpsilon] = useState(1e-6);
	const [customCheckerLang, setCustomCheckerLang] = useState("python");
	const [customCheckerCode, setCustomCheckerCode] = useState("");

	// Editorial fields
	const [editorialMarkdown, setEditorialMarkdown] = useState("");
	const [editorialVideoUrl, setEditorialVideoUrl] = useState("");

	// Generate slug from title
	useEffect(() => {
		if (title) {
			const slug = title
				.toLowerCase()
				.replace(/[^a-z0-9\s-]/g, "") // remove non-alphanumeric except space and hyphen
				.replace(/\s+/g, "-") // replace spaces with hyphens
				.replace(/-+/g, "-"); // collapse multiple hyphens
			setId(slug);
		} else {
			setId("");
		}
	}, [title]);

	// Auto-fill order
	useEffect(() => {
		const fetchNextOrder = async () => {
			try {
				const problemsSnap = await getDocs(collection(firestore, "problems"));
				let maxOrder = 0;
				problemsSnap.forEach((doc) => {
					const data = doc.data();
					if (data.order && Number(data.order) > maxOrder) {
						maxOrder = Number(data.order);
					}
				});
				setOrder(maxOrder + 1);
			} catch (err) {
				console.error("Error fetching order:", err);
			}
		};
		if (isAdmin) {
			fetchNextOrder();
		}
	}, [isAdmin]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!title.trim() || !problemStatement.trim()) {
			triggerStatusRibbon("error", "Please fill in all required fields (Challenge Name, Problem Statement).");
			return;
		}

		if (!id.trim()) {
			triggerStatusRibbon("error", "Challenge slug could not be generated. Please enter a valid name.");
			return;
		}

		setSubmitting(true);
		triggerStatusRibbon("info", "Creating challenge...", 0);

		try {
			const docRef = doc(firestore, "problems", id);
			const docSnap = await getDoc(docRef);
			if (docSnap.exists()) {
				triggerStatusRibbon("error", `A problem with slug "${id}" already exists. Please choose a different title.`);
				setSubmitting(false);
				return;
			}

			const problemData = {
				id,
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
				moderators: user?.email ? [user.email] : [],
				starterCode: starterCode.trim() || "",
				starterFunctionName: starterFunctionName.trim() || "",
				handlerFunction: handlerFunction.trim() || "",
				examples: [], // Empty initially, added in Edit page Test Cases tab
				likes: 0,
				dislikes: 0,
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

			await setDoc(docRef, problemData);
			triggerStatusRibbon("success", "Challenge created successfully!");
			setTimeout(() => {
				router.push(`/admin/problems/${id}`);
			}, 1500);
		} catch (error: any) {
			console.error("Error creating challenge:", error);
			triggerStatusRibbon("error", "Failed to create challenge. Please try again.");
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
		{ id: "details", label: "Details", enabled: true },
		{ id: "moderators", label: "Moderators", enabled: false, tooltip: "Save challenge details first to add moderators" },
		{ id: "testcases", label: "Test Cases", enabled: false, tooltip: "Save challenge details first to add test cases" },
		{ id: "codestubs", label: "Code Stubs", enabled: true },
		{ id: "languages", label: "Languages", enabled: false },
		{ id: "settings", label: "Settings", enabled: true },
		{ id: "editorial", label: "Editorial", enabled: true },
		{ id: "customchecker", label: "Custom Checker", enabled: true },
	];

	return (
		<main className='bg-[#f4f6f8] min-h-screen text-gray-800 pb-16 font-sans'>
			<Topbar />
			
			<div className='max-w-[1200px] mx-auto px-6 mt-6'>
				{/* Breadcrumb navigation */}
				<div className='text-xs text-gray-500 mb-2 flex items-center gap-1 font-semibold'>
					<Link href='/admin' className='hover:underline text-blue-600 transition'>
						Manage Challenges
					</Link>
					<span>&gt;</span>
					<span className='text-gray-600'>{title || "Untitled Challenge"}</span>
				</div>

				{/* Title area */}
				<div className='flex justify-between items-center mb-6'>
					<h1 className='text-3xl font-light text-gray-800'>
						{title || "New Challenge"}
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
						if (!tab.enabled) {
							return (
								<div
									key={tab.id}
									title={tab.tooltip || "Feature unavailable during creation"}
									className='px-5 py-3 text-xs font-semibold text-gray-400 cursor-not-allowed border-r border-gray-300'
								>
									{tab.label}
								</div>
							);
						}
						return (
							<button
								key={tab.id}
								type='button'
								onClick={() => setActiveTab(tab.id)}
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

							{/* Challenge Difficulty */}
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
										placeholder='e.g. Two Sum'
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
										value={`https://leetcode-yt.com/problems/${id || "..."}`}
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
										placeholder='Write a short summary about the challenge'
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
										className='border border-[#ccc] outline-none rounded p-2 text-sm w-full focus:border-blue-500 bg-white'
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
				</div>

				{/* Save button footer */}
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
						disabled={submitting}
						className='bg-[#2ec866] hover:bg-[#27a855] text-white px-7 py-2 rounded font-bold text-sm transition shadow-sm flex items-center gap-2 disabled:opacity-50'
					>
						{submitting && <FaSpinner className='animate-spin' size={12} />}
						Create Challenge
					</button>
				</div>
			</div>
		</main>
	);
};

export default NewProblem;
