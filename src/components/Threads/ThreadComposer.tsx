import React, { useState, useEffect, useRef } from "react";
import { useRecoilState } from "recoil";
import { threadComposerState } from "@/atoms/threadComposerAtom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, firestore } from "@/firebase/firebase";
import { collection, addDoc, getDocs, doc, getDoc } from "firebase/firestore";
import {
	FaTimes,
	FaImage,
	FaPaperclip,
	FaCode,
	FaSmile,
	FaPlus,
	FaTrash,
	FaSpinner,
	FaPollH,
} from "react-icons/fa";
import GifPicker from "./GifPicker";
import Avatar from "./Avatar";

interface AttachmentFile {
	name: string;
	size: number;
	type: string;
	data: string; // Base64 data URI
}

interface AttachmentProblem {
	problemId: string;
	problemTitle: string;
	submissionId: string;
	submissionIndex: number;
	code: string;
	language: string;
	status: string;
	timestamp: number;
}

interface PollDraft {
	question: string;
	options: string[];
}

interface ThreadDraft {
	content: string;
	photos: string[]; // Base64 images
	files: AttachmentFile[];
	poll: PollDraft | null;
	gif: string | null;
	submittedProblem: AttachmentProblem | null;
	showPollBuilder?: boolean;
	showGifPicker?: boolean;
}

const ThreadComposer: React.FC = () => {
	const [composer, setComposer] = useRecoilState(threadComposerState);
	const [user] = useAuthState(auth);

	const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
	const [allUsers, setAllUsers] = useState<any[]>([]);

	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	// Clear error and success when the composer opens or closes
	useEffect(() => {
		if (composer.isOpen) {
			setError(null);
			setSuccess(null);
		}
	}, [composer.isOpen]);

	// Thread Chain Drafts
	const [drafts, setDrafts] = useState<ThreadDraft[]>([
		{
			content: "",
			photos: [],
			files: [],
			poll: null,
			gif: null,
			submittedProblem: null,
		},
	]);

	const [submitting, setSubmitting] = useState(false);

	// Mentions Autocomplete State
	const [mentionSearch, setMentionSearch] = useState("");
	const [activeDraftIdx, setActiveDraftIdx] = useState<number>(-1);
	const [mentionTriggerPos, setMentionTriggerPos] = useState<number>(-1);

	// Leetcode Submissions Selector State
	const [showSubmissionSelectorFor, setShowSubmissionSelectorFor] = useState<number | null>(null);
	const [userSubmissions, setUserSubmissions] = useState<any[]>([]);
	const [loadingSubmissions, setLoadingSubmissions] = useState(false);
	const [selectedProblemId, setSelectedProblemId] = useState("");
	const [selectedSubIndex, setSelectedSubIndex] = useState<number>(-1);

	// Refs for inputs
	const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
	const photoInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

	// Fetch current user details and users list for autocomplete
	useEffect(() => {
		if (user && composer.isOpen) {
			const fetchProfileAndUsers = async () => {
				try {
					const userSnap = await getDoc(doc(firestore, "users", user.uid));
					if (userSnap.exists()) {
						setCurrentUserProfile(userSnap.data());
					}

					const usersSnap = await getDocs(collection(firestore, "users"));
					const list: any[] = [];
					usersSnap.forEach((d) => {
						const data = d.data();
						list.push({
							uid: d.id,
							displayName: data.displayName || "Anonymous User",
							avatarUrl: data.avatarUrl || null,
							username: data.displayName?.toLowerCase().replace(/\s+/g, "_") || d.id.substring(0, 6),
						});
					});
					setAllUsers(list);
				} catch (e) {
					console.error("Error fetching composer users:", e);
				}
			};
			fetchProfileAndUsers();
		}
	}, [user, composer.isOpen]);

	// Auto-expand textarea
	const adjustTextareaHeight = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const target = e.target;
		target.style.height = "auto";
		target.style.height = `${target.scrollHeight}px`;
	};

	const addDraftToChain = () => {
		setDrafts((prev) => [
			...prev,
			{
				content: "",
				photos: [],
				files: [],
				poll: null,
				gif: null,
				submittedProblem: null,
			},
		]);
	};

	const removeDraftFromChain = (index: number) => {
		if (drafts.length === 1) return;
		setDrafts((prev) => prev.filter((_, idx) => idx !== index));
	};

	const handleContentChange = (index: number, val: string, e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setError(null);
		setSuccess(null);
		adjustTextareaHeight(e);
		setDrafts((prev) => {
			const copy = [...prev];
			copy[index].content = val;
			return copy;
		});

		// Autocomplete Mentions logic
		const cursorPosition = e.target.selectionStart;
		const textBeforeCursor = val.slice(0, cursorPosition);
		const lastAtSymbol = textBeforeCursor.lastIndexOf("@");

		if (lastAtSymbol !== -1 && lastAtSymbol >= textBeforeCursor.search(/\s|^/)) {
			const queryText = textBeforeCursor.slice(lastAtSymbol + 1);
			if (!queryText.includes(" ")) {
				setMentionSearch(queryText);
				setActiveDraftIdx(index);
				setMentionTriggerPos(lastAtSymbol);
				return;
			}
		}

		setMentionSearch("");
		setActiveDraftIdx(-1);
		setMentionTriggerPos(-1);
	};

	const handleInsertMention = (user: any) => {
		if (activeDraftIdx === -1 || mentionTriggerPos === -1) return;
		const draft = drafts[activeDraftIdx];
		const before = draft.content.slice(0, mentionTriggerPos);
		const after = draft.content.slice(mentionTriggerPos + mentionSearch.length + 1);
		const newContent = `${before}@${user.username} ${after}`;

		setDrafts((prev) => {
			const copy = [...prev];
			copy[activeDraftIdx].content = newContent;
			return copy;
		});

		setMentionSearch("");
		setActiveDraftIdx(-1);
		setMentionTriggerPos(-1);
	};

	// Image compression
	const compressImageFile = (file: File): Promise<string> => {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (readerEvent) => {
				const image = new Image();
				image.onload = () => {
					const canvas = document.createElement("canvas");
					const max_size = 800;
					let width = image.width;
					let height = image.height;
					if (width > height) {
						if (width > max_size) {
							height *= max_size / width;
							width = max_size;
						}
					} else {
						if (height > max_size) {
							width *= max_size / height;
							height = max_size;
						}
					}
					canvas.width = width;
					canvas.height = height;
					const ctx = canvas.getContext("2d");
					ctx?.drawImage(image, 0, 0, width, height);
					const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
					resolve(dataUrl);
				};
				image.src = readerEvent.target?.result as string;
			};
			reader.readAsDataURL(file);
		});
	};

	// Paste Clipboard Event
	const handlePaste = async (index: number, e: React.ClipboardEvent<HTMLTextAreaElement>) => {
		const items = e.clipboardData?.items;
		if (!items) return;
		for (const item of Array.from(items)) {
			if (item.type.indexOf("image") !== -1) {
				const file = item.getAsFile();
				if (!file) continue;
				e.preventDefault();
				try {
					setError(null);
					const compressed = await compressImageFile(file);
					setDrafts((prev) => {
						const copy = [...prev];
						copy[index].photos = [...copy[index].photos, compressed];
						return copy;
					});
					setSuccess("Image pasted from clipboard!");
				} catch (err) {
					console.error("Paste image error:", err);
				}
			}
		}
	};

	// Drag & Drop
	const handleDrop = async (index: number, e: React.DragEvent<HTMLTextAreaElement>) => {
		e.preventDefault();
		const files = e.dataTransfer?.files;
		if (!files) return;
		setError(null);
		setSuccess(null);
		for (const file of Array.from(files)) {
			if (file.type.startsWith("image/")) {
				try {
					const compressed = await compressImageFile(file);
					setDrafts((prev) => {
						const copy = [...prev];
						copy[index].photos = [...copy[index].photos, compressed];
						return copy;
					});
				} catch (err) {
					console.error("Drop image error:", err);
				}
			} else {
				// Attach file
				if (file.size > 150 * 1024) {
					setError("File size must be under 150KB.");
					continue;
				}
				const reader = new FileReader();
				reader.onload = (ev) => {
					if (ev.target?.result) {
						setDrafts((prev) => {
							const copy = [...prev];
							copy[index].files = [
								...copy[index].files,
								{
									name: file.name,
									size: file.size,
									type: file.type,
									data: ev.target!.result as string,
								},
							];
							return copy;
						});
					}
				};
				reader.readAsDataURL(file);
			}
		}
	};

	// File attachments change
	const handleFileSelect = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files) return;
		setError(null);
		setSuccess(null);
		Array.from(files).forEach((file) => {
			if (file.size > 150 * 1024) {
				setError("File size must be under 150KB.");
				return;
			}
			const reader = new FileReader();
			reader.onload = (ev) => {
				if (ev.target?.result) {
					setDrafts((prev) => {
						const copy = [...prev];
						copy[index].files = [
							...copy[index].files,
							{
								name: file.name,
								size: file.size,
								type: file.type,
								data: ev.target!.result as string,
							},
						];
						return copy;
					});
				}
			};
			reader.readAsDataURL(file);
		});
	};

	// Photo select change
	const handlePhotoSelect = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files) return;
		setError(null);
		setSuccess(null);
		for (const file of Array.from(files)) {
			if (!file.type.startsWith("image/")) {
				setError("Please select an image file.");
				continue;
			}
			try {
				const compressed = await compressImageFile(file);
				setDrafts((prev) => {
					const copy = [...prev];
					copy[index].photos = [...copy[index].photos, compressed];
					return copy;
				});
			} catch (err) {
				console.error("Photo compress error:", err);
			}
		}
	};

	// Poll builder state managers
	const handleOpenPollBuilder = (index: number) => {
		setDrafts((prev) => {
			const copy = [...prev];
			copy[index].poll = { question: "", options: ["", ""] };
			copy[index].showPollBuilder = true;
			return copy;
		});
	};

	const handleRemovePoll = (index: number) => {
		setDrafts((prev) => {
			const copy = [...prev];
			copy[index].poll = null;
			copy[index].showPollBuilder = false;
			return copy;
		});
	};

	const handlePollQuestionChange = (index: number, q: string) => {
		setDrafts((prev) => {
			const copy = [...prev];
			if (copy[index].poll) {
				copy[index].poll!.question = q;
			}
			return copy;
		});
	};

	const handlePollOptionChange = (index: number, optionIdx: number, val: string) => {
		setDrafts((prev) => {
			const copy = [...prev];
			if (copy[index].poll) {
				copy[index].poll!.options[optionIdx] = val;
			}
			return copy;
		});
	};

	const handleAddPollOption = (index: number) => {
		setDrafts((prev) => {
			const copy = [...prev];
			if (copy[index].poll && copy[index].poll!.options.length < 4) {
				copy[index].poll!.options.push("");
			}
			return copy;
		});
	};

	const handleRemovePollOption = (index: number, optionIdx: number) => {
		setDrafts((prev) => {
			const copy = [...prev];
			if (copy[index].poll && copy[index].poll!.options.length > 2) {
				copy[index].poll!.options = copy[index].poll!.options.filter((_, idx) => idx !== optionIdx);
			}
			return copy;
		});
	};

	// Leetcode Submissions Loader
	const handleOpenSubmissionSelector = async (index: number) => {
		if (!user) return;
		setShowSubmissionSelectorFor(index);
		if (userSubmissions.length === 0) {
			setLoadingSubmissions(true);
			try {
				const querySnapshot = await getDocs(collection(firestore, "submissions"));
				const list: any[] = [];
				querySnapshot.forEach((docSnap) => {
					const data = docSnap.data();
					if (data.uid === user.uid) {
						list.push({ id: docSnap.id, ...data });
					}
				});
				list.sort((a, b) => a.timestamp - b.timestamp);
				setUserSubmissions(list);
			} catch (e) {
				console.error(e);
			} finally {
				setLoadingSubmissions(false);
			}
		}
	};

	const handleAttachSubmission = () => {
		if (showSubmissionSelectorFor === null || !selectedProblemId || selectedSubIndex === -1) {
			setError("Please select a problem and attempt.");
			return;
		}

		setError(null);
		setSuccess(null);
		const problemSubs = userSubmissions.filter((s) => s.problemId === selectedProblemId);
		const targetSub = problemSubs[selectedSubIndex];

		const formatted: AttachmentProblem = {
			problemId: selectedProblemId,
			problemTitle: targetSub.problemTitle || selectedProblemId,
			submissionId: targetSub.id,
			submissionIndex: selectedSubIndex + 1,
			code: targetSub.code || "",
			language: targetSub.language || "",
			status: targetSub.status || "",
			timestamp: targetSub.timestamp || Date.now(),
		};

		setDrafts((prev) => {
			const copy = [...prev];
			copy[showSubmissionSelectorFor] = {
				...copy[showSubmissionSelectorFor],
				submittedProblem: formatted,
			};
			return copy;
		});

		setShowSubmissionSelectorFor(null);
		setSelectedProblemId("");
		setSelectedSubIndex(-1);
	};

	// Submits notifications trigger helper
	const triggerNotification = async (toUid: string, type: "like" | "repost" | "reply", threadId: string) => {
		if (!user || toUid === user.uid) return;
		try {
			const authorName = currentUserProfile?.displayName || user.displayName || user.email?.split("@")[0] || "Anonymous";
			const authorAvatar = currentUserProfile?.avatarUrl || user.photoURL || "";
			await addDoc(collection(firestore, "notifications"), {
				toUid,
				fromUid: user.uid,
				fromDisplayName: authorName,
				fromAvatarUrl: authorAvatar,
				type,
				threadId,
				createdAt: Date.now(),
				read: false,
			});
		} catch (error) {
			console.error("Notification trigger error:", error);
		}
	};

	// Publish entire chain
	const handlePublish = async () => {
		setError(null);
		setSuccess(null);

		if (!user) {
			setError("Please sign in to publish!");
			return;
		}

		// Validation
		const hasContent = drafts.some(
			(d) =>
				d.content.trim() ||
				d.photos.length > 0 ||
				d.files.length > 0 ||
				d.poll ||
				d.gif ||
				d.submittedProblem
		);

		if (!hasContent) {
			setError("Thread content cannot be empty.");
			return;
		}

		setSubmitting(true);
		try {
			const authorName = currentUserProfile?.displayName || user.displayName || user.email?.split("@")[0] || "Anonymous";
			const authorAvatar = currentUserProfile?.avatarUrl || user.photoURL || "";

			let previousThreadId: string | null = composer.parentThreadId || null;

			for (let i = 0; i < drafts.length; i++) {
				const draft = drafts[i];

				// Skip empty draft slots unless it's the only one
				if (
					i > 0 &&
					!draft.content.trim() &&
					draft.photos.length === 0 &&
					draft.files.length === 0 &&
					!draft.poll &&
					!draft.gif &&
					!draft.submittedProblem
				) {
					continue;
				}

				// Format poll
				let formattedPoll: any = null;
				if (draft.poll && draft.poll.question.trim()) {
					const filledOptions = draft.poll.options.filter((o) => o.trim() !== "");
					if (filledOptions.length >= 2) {
						formattedPoll = {
							question: draft.poll.question.trim(),
							options: filledOptions.map((opt) => ({ text: opt.trim(), votes: [] })),
						};
					}
				}

				// Parse Hashtags and Mentions
				const hashRegex = /#(\w+)/g;
				const hashtags: string[] = [];
				let match;
				while ((match = hashRegex.exec(draft.content)) !== null) {
					hashtags.push(match[1].toLowerCase());
				}

				const mentionRegex = /@(\w+)/g;
				const mentions: string[] = [];
				while ((match = mentionRegex.exec(draft.content)) !== null) {
					mentions.push(match[1]);
				}

				const postData: any = {
					uid: user.uid,
					displayName: authorName,
					avatarUrl: authorAvatar,
					content: draft.content.trim(),
					createdAt: Date.now() + i, // slight offset to maintain sorting order
					likes: [],
					replies: [],
					photos: draft.photos,
					files: draft.files,
					gif: draft.gif || null,
					poll: formattedPoll,
					hashtags,
					mentions,
					parentThreadId: previousThreadId || "", // empty string if top level
					quotedThreadId: "", // if we added quote support later
				};

				if (draft.submittedProblem) {
					postData.submittedProblem = draft.submittedProblem;
				}

				// If it's a reply and it's the first post, check parent info
				if (i === 0 && composer.parentThreadId) {
					postData.parentThreadId = composer.parentThreadId;
				}

				const docRef = await addDoc(collection(firestore, "threads"), postData);
				previousThreadId = docRef.id;

				// If this is a reply, trigger notifications
				if (i === 0 && composer.parentThreadId) {
					// Fetch parent thread to get owner UID
					const parentSnap = await getDoc(doc(firestore, "threads", composer.parentThreadId));
					if (parentSnap.exists()) {
						await triggerNotification(parentSnap.data().uid, "reply", docRef.id);
					}
				}
			}

			setSuccess("Published successfully!");
			setTimeout(() => {
				setComposer({ isOpen: false });
				// Reset drafts
				setDrafts([
					{
						content: "",
						photos: [],
						files: [],
						poll: null,
						gif: null,
						submittedProblem: null,
					},
				]);
				setSuccess(null);
			}, 1200);
		} catch (e) {
			console.error("Composer publish error:", e);
			setError("Failed to post thread chain.");
		} finally {
			setSubmitting(false);
		}
	};

	if (!composer.isOpen) return null;

	const handleOverlayClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) {
			setComposer({ isOpen: false });
		}
	};

	return (
		<div
			onClick={handleOverlayClick}
			className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in'
		>
			<div className='bg-white dark:bg-dark-layer-1 border border-slate-200 dark:border-slate-800/60 rounded-3xl w-full max-w-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-scale-up'>
				{/* Header */}
				<div className='flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-800/60 select-none'>
					<h3 className='text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider'>
						{composer.parentThreadId ? `Reply to @${composer.replyToDisplayName}` : "New Thread"}
					</h3>
					<button
						onClick={() => setComposer({ isOpen: false })}
						className='text-slate-500 hover:text-slate-900 dark:text-gray-500 dark:hover:text-white transition duration-150 p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-dark-fill-3 dark:hover:bg-dark-fill-2 rounded-full'
					>
						<FaTimes size={14} />
					</button>
				</div>

				{error && (
					<div className="mx-6 mt-4 bg-rose-500/10 border border-rose-500/20 text-rose-455 text-xs px-4 py-2.5 rounded-xl animate-fade-in shrink-0">
						{error}
					</div>
				)}
				{success && (
					<div className="mx-6 mt-4 bg-green-500/10 border border-green-500/20 text-green-455 text-xs px-4 py-2.5 rounded-xl animate-fade-in shrink-0">
						{success}
					</div>
				)}

				{/* Chain Area */}
				<div className='flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin'>
					{drafts.map((draft, idx) => {
						const isLast = idx === drafts.length - 1;
						const count = draft.content.length;
						const nearLimit = count > 240;

						return (
							<div key={idx} className='relative flex gap-4 items-start'>
									{/* Left Column (Avatar & line connector) */}
								<div className='flex flex-col items-center shrink-0 h-full relative'>
									<Avatar
										src={currentUserProfile?.avatarUrl}
										displayName={currentUserProfile?.displayName || user?.displayName || "Me"}
										size={40}
									/>

									{/* Connector line connecting chain items */}
									{!isLast && (
										<div className='absolute top-[40px] bottom-[-30px] w-[2px] bg-slate-200 dark:bg-gray-800 z-0' />
									)}
								</div>

								{/* Right Column (Draft details) */}
								<div className='flex-grow min-w-0 space-y-3'>
									<div className='flex items-center justify-between mb-1'>
										<span className='font-bold text-sm text-slate-900 dark:text-white'>
											{currentUserProfile?.displayName || user?.displayName || "Me"}
										</span>
										{drafts.length > 1 && (
											<button
												type='button'
												onClick={() => removeDraftFromChain(idx)}
												className='text-gray-500 hover:text-red-400 transition p-1 hover:bg-dark-fill-3 rounded'
												title='Remove from chain'
											>
												<FaTrash size={11} />
											</button>
										)}
									</div>

									{/* Input box */}
									<div className='relative'>
										<textarea
											value={draft.content}
											onChange={(e) => handleContentChange(idx, e.target.value, e)}
											onPaste={(e) => handlePaste(idx, e)}
											onDragOver={(e) => e.preventDefault()}
											onDrop={(e) => handleDrop(idx, e)}
											placeholder={idx === 0 ? (composer.parentThreadId ? "Post a reply..." : "What's new?") : "Add to thread..."}
											rows={2}
											className='w-full !bg-transparent text-slate-900 dark:text-gray-200 placeholder-slate-400 dark:placeholder-slate-500 !border-0 !p-0 !ring-0 !outline-none !shadow-none text-[14.5px] leading-relaxed resize-none'
										/>

										{/* Mentions Dropdown */}
										{activeDraftIdx === idx && mentionSearch !== "" && (
											<div className='absolute z-50 left-0 bg-white dark:bg-dark-layer-2 border border-slate-200 dark:border-slate-800/60 rounded-xl shadow-2xl w-56 max-h-40 overflow-y-auto mt-1 p-1 scrollbar-thin select-none'>
												{allUsers
													.filter(
														(u) =>
															u.displayName.toLowerCase().includes(mentionSearch.toLowerCase()) ||
															u.username.includes(mentionSearch.toLowerCase())
													)
													.slice(0, 5)
													.map((u) => (
														<div
															key={u.uid}
															onClick={() => handleInsertMention(u)}
															className='flex items-center gap-2.5 px-3 py-2 hover:bg-dark-fill-2 rounded-lg cursor-pointer transition text-xs font-semibold'
														>
															<Avatar
																src={u.avatarUrl}
																displayName={u.displayName}
																size={22}
															/>
															<div className='truncate'>
																<p className='text-slate-950 dark:text-white'>{u.displayName}</p>
																<p className='text-[10px] text-slate-500 dark:text-gray-500'>@{u.username}</p>
															</div>
														</div>
													))}
											</div>
										)}
									</div>

									{/* Character counter (appears near limit) */}
									{nearLimit && (
										<span className={`text-[10px] block text-right font-mono ${count > 280 ? "text-red-500 font-bold" : "text-gray-500"}`}>
											{count} / 280
										</span>
									)}

									{/* Photos Grid */}
									{draft.photos.length > 0 && (
										<div className='grid grid-cols-3 gap-2 border border-slate-200 dark:border-slate-800/40 p-2 rounded-xl bg-slate-50 dark:bg-dark-fill-3'>
											{draft.photos.map((photo, pIdx) => (
												<div key={pIdx} className='relative group aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800/40 bg-slate-100 dark:bg-black/40'>
													<img src={photo} className='w-full h-full object-cover' />
													<button
														type='button'
														onClick={() =>
															setDrafts((prev) => {
																const copy = [...prev];
																copy[idx].photos = copy[idx].photos.filter((_, pI) => pI !== pIdx);
																return copy;
															})
														}
														className='absolute top-1 right-1 bg-red-600/90 text-white rounded-full p-1 shadow-lg hover:bg-red-700 transition duration-150'
													>
														<FaTimes size={8} />
													</button>
												</div>
											))}
										</div>
									)}

									{/* GIF Embedded */}
									{draft.gif && (
										<div className='relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800/40 bg-slate-100 dark:bg-black/30 max-w-sm aspect-video'>
											<img src={draft.gif} className='w-full h-full object-cover' />
											<button
												type='button'
												onClick={() =>
													setDrafts((prev) => {
														const copy = [...prev];
														copy[idx].gif = null;
														return copy;
													})
												}
												className='absolute top-2 right-2 bg-black/70 hover:bg-black text-white rounded-full p-1.5 transition'
											>
												<FaTimes size={10} />
											</button>
										</div>
									)}

									{/* Files Attachments */}
									{draft.files.length > 0 && (
										<div className='flex flex-wrap gap-2 border border-slate-200 dark:border-slate-800/40 p-2 rounded-xl bg-slate-50 dark:bg-dark-fill-3'>
											{draft.files.map((file, fIdx) => (
												<div key={fIdx} className='flex items-center gap-1.5 bg-slate-100 dark:bg-dark-fill-3 border border-slate-200 dark:border-slate-800/40 px-2.5 py-1 rounded-full text-[10px] text-slate-600 dark:text-gray-300'>
													<FaPaperclip size={10} className='text-brand-orange' />
													<span className='truncate max-w-[80px]'>{file.name}</span>
													<button
														type='button'
														onClick={() =>
															setDrafts((prev) => {
																const copy = [...prev];
																copy[idx].files = copy[idx].files.filter((_, fI) => fI !== fIdx);
																return copy;
															})
														}
														className='text-gray-500 hover:text-red-400'
													>
														<FaTimes size={10} />
													</button>
												</div>
											))}
										</div>
									)}

									{/* Problem Submission Card */}
									{draft.submittedProblem && (
										<div className='flex items-center justify-between bg-brand-orange/5 border border-brand-orange/20 px-3.5 py-2.5 rounded-xl text-xs text-gray-300'>
											<div className='flex items-center gap-2'>
												<FaCode className='text-brand-orange' />
												<span className='font-semibold'>{draft.submittedProblem.problemTitle}</span>
												<span className='text-[10px] bg-brand-orange/15 text-brand-orange px-2 py-0.5 rounded'>
													Attempt {draft.submittedProblem.submissionIndex}
												</span>
											</div>
											<button
												type='button'
												onClick={() =>
													setDrafts((prev) => {
														const copy = [...prev];
														copy[idx].submittedProblem = null;
														return copy;
													})
												}
												className='text-gray-500 hover:text-red-400 transition'
											>
												<FaTimes size={14} />
											</button>
										</div>
									)}

									{/* Poll Builder View */}
									{draft.showPollBuilder && draft.poll && (
										<div className='bg-slate-50 dark:bg-dark-fill-3 border border-slate-200 dark:border-slate-800/40 rounded-xl p-3.5 space-y-3 max-w-sm animate-fade-in'>
											<div className='flex justify-between items-center mb-1'>
												<span className='text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider'>Create Poll</span>
												<button
													type='button'
													onClick={() => handleRemovePoll(idx)}
													className='text-[9px] font-bold text-red-400 hover:underline uppercase'
												>
													Remove Poll
												</button>
											</div>
											<input
												type='text'
												value={draft.poll.question}
												onChange={(e) => handlePollQuestionChange(idx, e.target.value)}
												placeholder='Ask a question...'
												className='w-full bg-slate-100 dark:bg-dark-fill-3 border border-slate-200 dark:border-slate-800/40 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 rounded-lg p-2 text-xs outline-none focus:border-brand-orange'
											/>
											<div className='space-y-2'>
												{draft.poll.options.map((opt, oIdx) => (
													<div key={oIdx} className='flex gap-2 items-center'>
														<input
															type='text'
															value={opt}
															onChange={(e) => handlePollOptionChange(idx, oIdx, e.target.value)}
															placeholder={`Choice ${oIdx + 1}`}
															className='flex-1 bg-slate-100 dark:bg-dark-fill-3 border border-slate-200 dark:border-slate-800/40 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 rounded-lg p-2 text-xs outline-none focus:border-brand-orange font-medium'
														/>
														{draft.poll!.options.length > 2 && (
															<button
																type='button'
																onClick={() => handleRemovePollOption(idx, oIdx)}
																className='text-gray-500 hover:text-red-400 transition'
															>
																<FaTimes size={11} />
															</button>
														)}
													</div>
												))}
											</div>
											{draft.poll.options.length < 4 && (
												<button
													type='button'
													onClick={() => handleAddPollOption(idx)}
													className='text-[10px] text-brand-orange hover:underline font-bold flex items-center gap-1 mt-1'
												>
													<FaPlus size={8} /> Add Choice
												</button>
											)}
										</div>
									)}

									{/* Inline Submission Selector */}
									{showSubmissionSelectorFor === idx && (
										<div className='bg-slate-50 dark:bg-dark-layer-2 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 space-y-3 animate-fade-in'>
											<h4 className='text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider'>Attach Problem Submission</h4>
											{loadingSubmissions ? (
												<p className='text-xs text-gray-550 italic animate-pulse'>Loading attempts...</p>
											) : userSubmissions.length === 0 ? (
												<p className='text-xs text-gray-550 italic'>No submissions found.</p>
											) : (
												<div className='grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs'>
													<div>
														<label className='block text-[10px] text-slate-500 dark:text-gray-500 font-bold mb-1 uppercase'>Select Problem</label>
														<select
															value={selectedProblemId}
															onChange={(e) => {
																setSelectedProblemId(e.target.value);
																setSelectedSubIndex(-1);
															}}
															className='w-full bg-white dark:bg-dark-layer-1 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800/80 rounded-lg p-2 transition-all duration-200 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
														>
															<option className='bg-white dark:bg-dark-layer-1 text-slate-900 dark:text-slate-200' value=''>-- Choose --</option>
															{Array.from(new Set(userSubmissions.map((s) => s.problemId))).map((pid) => (
																<option className='bg-white dark:bg-dark-layer-1 text-slate-900 dark:text-slate-200' key={pid} value={pid}>
																	{userSubmissions.find((s) => s.problemId === pid)?.problemTitle || pid}
																</option>
															))}
														</select>
													</div>
													{selectedProblemId && (
														<div>
															<label className='block text-[10px] text-slate-500 dark:text-gray-500 font-bold mb-1 uppercase'>Select Attempt</label>
															<select
																value={selectedSubIndex}
																onChange={(e) => setSelectedSubIndex(parseInt(e.target.value))}
																className='w-full bg-white dark:bg-dark-layer-1 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800/80 rounded-lg p-2 transition-all duration-200 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-mono'
															>
																<option className='bg-white dark:bg-dark-layer-1 text-slate-900 dark:text-slate-200' value={-1}>-- Choose --</option>
																{userSubmissions
																	.filter((s) => s.problemId === selectedProblemId)
																	.map((sub, sIdx) => (
																		<option className='bg-white dark:bg-dark-layer-1 text-slate-900 dark:text-slate-200' key={sub.id} value={sIdx}>
																			Attempt {sIdx + 1} ({sub.status})
																		</option>
																	))}
															</select>
														</div>
													)}
												</div>
											)}
											<div className='flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/40 text-xs'>
												<button
													type='button'
													onClick={() => {
														setShowSubmissionSelectorFor(null);
														setSelectedProblemId("");
														setSelectedSubIndex(-1);
													}}
													className='px-3.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 bg-slate-100 dark:bg-dark-fill-3 hover:bg-slate-200 dark:hover:bg-dark-fill-2 transition font-semibold'
												>
													Cancel
												</button>
												<button
													type='button'
													onClick={handleAttachSubmission}
													disabled={!selectedProblemId || selectedSubIndex === -1}
													className='px-4 py-1.5 rounded-lg text-white bg-brand-orange hover:bg-brand-orange-s transition disabled:bg-dark-fill-3 disabled:text-slate-500 font-semibold'
												>
													Attach Code
												</button>
											</div>
										</div>
									)}

									{/* Action Row */}
									<div className='flex items-center gap-3 text-slate-400 dark:text-gray-500 pt-1'>
										{/* Attach Photo Button */}
										<label className='cursor-pointer hover:text-slate-900 dark:hover:text-white transition p-1.5 hover:bg-slate-100 dark:hover:bg-dark-fill-3 rounded' title='Add Photo'>
											<FaImage size={13.5} />
											<input
												ref={(el) => {
													photoInputRefs.current[idx] = el;
												}}
												type='file'
												accept='image/*'
												multiple
												className='hidden'
												onChange={(e) => handlePhotoSelect(idx, e)}
											/>
										</label>

										{/* Attach File Button */}
										<label className='cursor-pointer hover:text-slate-900 dark:hover:text-white transition p-1.5 hover:bg-slate-100 dark:hover:bg-dark-fill-3 rounded' title='Add File'>
											<FaPaperclip size={13.5} />
											<input
												ref={(el) => {
													fileInputRefs.current[idx] = el;
												}}
												type='file'
												multiple
												className='hidden'
												onChange={(e) => handleFileSelect(idx, e)}
											/>
										</label>

										{/* GIF Picker Trigger */}
										<div className='relative'>
											<button
												type='button'
												onClick={() =>
													setDrafts((prev) => {
														const copy = [...prev];
														copy[idx].showGifPicker = !copy[idx].showGifPicker;
														return copy;
													})
												}
												className='hover:text-slate-900 dark:hover:text-white transition p-1.5 hover:bg-slate-100 dark:hover:bg-dark-fill-3 rounded'
												title='Add GIF'
											>
												<FaSmile size={13.5} />
											</button>
											{draft.showGifPicker && (
												<GifPicker
													onSelect={(url) => {
														setDrafts((prev) => {
															const copy = [...prev];
															copy[idx].gif = url;
															copy[idx].showGifPicker = false;
															return copy;
														});
													}}
													onClose={() =>
														setDrafts((prev) => {
															const copy = [...prev];
															copy[idx].showGifPicker = false;
															return copy;
														})
													}
												/>
											)}
										</div>

										{/* Poll Creator Trigger */}
										<button
											type='button'
											onClick={() => handleOpenPollBuilder(idx)}
											disabled={!!draft.poll}
											className='hover:text-slate-900 dark:hover:text-white transition disabled:opacity-30 p-1.5 hover:bg-slate-100 dark:hover:bg-dark-fill-3 rounded'
											title='Add Poll'
										>
											<FaPollH size={13.5} />
										</button>

										{/* Attach solved problem */}
										<button
											type='button'
											onClick={() => handleOpenSubmissionSelector(idx)}
											className='hover:text-slate-900 dark:hover:text-white transition p-1.5 hover:bg-slate-100 dark:hover:bg-dark-fill-3 rounded'
											title='Attach Leetcode Solution'
										>
											<FaCode size={13.5} />
										</button>
									</div>
								</div>
							</div>
						);
					})}
				</div>

				{/* Footer Options & Post Button */}
				<div className='px-6 py-4 bg-slate-50 dark:bg-dark-layer-2 border-t border-slate-200 dark:border-slate-800/60 flex justify-between items-center select-none'>
					{/* Add thread to chain button */}
					{!composer.parentThreadId ? (
						<button
							onClick={addDraftToChain}
							className='flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white transition'
						>
							<FaPlus size={10} className='text-brand-orange' />
							<span>Add to thread</span>
						</button>
					) : (
						<div />
					)}

					<div className='flex gap-3'>
						<button
							onClick={() => setComposer({ isOpen: false })}
							className='bg-slate-100 hover:bg-slate-200 dark:bg-dark-fill-3 dark:hover:bg-dark-fill-2 text-slate-700 dark:text-white text-xs font-semibold px-5 py-2.5 rounded-full transition'
						>
							Cancel
						</button>
						<button
							onClick={handlePublish}
							disabled={submitting}
							className='bg-brand-orange hover:bg-brand-orange-s text-white text-xs font-bold px-6 py-2.5 rounded-full transition shadow-lg flex items-center gap-2 disabled:opacity-50'
						>
							{submitting ? (
								<>
									<FaSpinner className='animate-spin' size={12} />
									<span>Posting...</span>
								</>
							) : (
								<span>Publish</span>
							)}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default ThreadComposer;
