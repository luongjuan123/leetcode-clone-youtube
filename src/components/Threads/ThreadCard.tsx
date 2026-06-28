import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, firestore } from "@/firebase/firebase";
import {
	doc,
	updateDoc,
	deleteDoc,
	getDoc,
	addDoc,
	collection,
	query,
	where,
	onSnapshot,
} from "firebase/firestore";
import {
	FaHeart,
	FaComment,
	FaRetweet,
	FaPaperPlane,
	FaEllipsisH,
	FaCheckCircle,
	FaTrash,
	FaExternalLinkAlt,
	FaCode,
	FaEye,
	FaBookmark,
} from "react-icons/fa";
import Link from "next/link";
import { useSetRecoilState, useRecoilValue } from "recoil";
import { threadComposerState } from "@/atoms/threadComposerAtom";
import { threadCommentFeedbackAtom } from "@/atoms/threadCommentFeedbackAtom";
import PollComponent from "./PollComponent";
import Avatar from "./Avatar";
import ThreadMedia from "./ThreadMedia";
import { useRouter } from "next/router";
import { useUserProfile } from "@/hooks/useUserProfile";
import { clientSendNotification } from "@/utils/clientNotificationService";


interface AttachmentFile {
	name: string;
	size: number;
	type: string;
	data: string;
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
	attempts?: number;
	solved?: number;
}

interface Thread {
	id: string;
	uid: string;
	displayName: string;
	avatarUrl?: string;
	content: string;
	createdAt: number;
	likes: string[];
	replies: any[];
	photos?: string[];
	files?: AttachmentFile[];
	gif?: string | null;
	poll?: any | null;
	submittedProblem?: AttachmentProblem;
	parentThreadId?: string;
	quotedThreadId?: string;
	repostedThreadId?: string;
	hashtags?: string[];
	mentions?: string[];
	viewCount?: number;
	bookmarkCount?: number;
}

interface ThreadCardProps {
	thread: Thread;
	isDetailView?: boolean;
	showConnectorLine?: boolean;
	highlighted?: boolean;
}

const ThreadCard: React.FC<ThreadCardProps> = ({
	thread,
	isDetailView = false,
	showConnectorLine = false,
	highlighted = false,
}) => {
	const [user] = useAuthState(auth);
	const setComposer = useSetRecoilState(threadComposerState);
	const commentFeedback = useRecoilValue(threadCommentFeedbackAtom);
	const router = useRouter();

	// Fetch real-time/latest profile of the author to show the newest uploaded avatar/displayName
	const { profile: authorProfile } = useUserProfile(thread.uid);
	const avatarUrl = authorProfile?.avatarUrl || thread.avatarUrl;
	const displayName = authorProfile?.displayName || thread.displayName;

	// Fetch real-time/latest profile of the logged-in user to show the newest uploaded avatar/displayName in notifications
	const { profile: loggedInProfile } = useUserProfile(user?.uid);
	const currentUserAvatar = loggedInProfile?.avatarUrl || user?.photoURL || "";
	const currentUserDisplayName = loggedInProfile?.displayName || user?.displayName || user?.email?.split("@")[0] || "Anonymous";

	const isJustPosted = commentFeedback.justPosted?.id === thread.id || thread.id.startsWith("temp-");

	// Likes Optimistic UI State
	const [isLiked, setIsLiked] = useState(false);
	const [likesCount, setLikesCount] = useState(0);

	// Accordion state
	const [showCode, setShowCode] = useState(false);

	// Dropdowns state
	const [showOptions, setShowOptions] = useState(false);
	const [showRepostDropdown, setShowRepostDropdown] = useState(false);
	const optionsRef = useRef<HTMLDivElement>(null);
	const repostRef = useRef<HTMLDivElement>(null);

	// Context Fetching
	const [quotedThread, setQuotedThread] = useState<Thread | null>(null);
	const { profile: quotedProfile } = useUserProfile(quotedThread?.uid);
	const quotedAvatarUrl = quotedProfile?.avatarUrl || quotedThread?.avatarUrl;
	const quotedDisplayName = quotedProfile?.displayName || quotedThread?.displayName;

	const [loadingQuote, setLoadingQuote] = useState(false);
	const [subReplies, setSubReplies] = useState<Thread[]>([]);

	// Bookmarks State
	const [isBookmarked, setIsBookmarked] = useState(false);
	const [bookmarksCount, setBookmarksCount] = useState(0);

	// Tooltips and status states
	const [loginTooltipTarget, setLoginTooltipTarget] = useState<"like" | "reply" | "bookmark" | "repost" | null>(null);
	const [copied, setCopied] = useState(false);
	const [repostStatus, setRepostStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
	const [deleting, setDeleting] = useState(false);

	// Sync local states
	useEffect(() => {
		if (thread) {
			const liked = user ? thread.likes?.includes(user.uid) || false : false;
			setIsLiked(liked);
			setLikesCount(thread.likes?.length || 0);
			setBookmarksCount(thread.bookmarkCount || 0);
		}
	}, [thread, user]);

	// Fetch bookmarks array for user to determine bookmark status
	useEffect(() => {
		if (user && thread.id) {
			const unsub = onSnapshot(doc(firestore, "users", user.uid), (snap) => {
				if (snap.exists()) {
					const bookmarks = snap.data().bookmarks || [];
					setIsBookmarked(bookmarks.includes(thread.id));
				}
			});
			return () => unsub();
		}
	}, [user, thread.id]);

	// Fetch quoted threads details
	useEffect(() => {
		if (thread.quotedThreadId && thread.quotedThreadId.trim() !== "") {
			const fetchQuote = async () => {
				setLoadingQuote(true);
				try {
					const docSnap = await getDoc(doc(firestore, "threads", thread.quotedThreadId!));
					if (docSnap.exists()) {
						setQuotedThread({ id: docSnap.id, ...docSnap.data() } as Thread);
					}
				} catch (e) {
					console.error(e);
				} finally {
					setLoadingQuote(false);
				}
			};
			fetchQuote();
		}
	}, [thread.quotedThreadId]);

	// Fetch active sub replies in real-time
	useEffect(() => {
		if (!thread.id) return;
		const q = query(collection(firestore, "threads"), where("parentThreadId", "==", thread.id));
		const unsub = onSnapshot(q, (snap) => {
			const list: Thread[] = [];
			snap.forEach((d) => {
				list.push({ id: d.id, ...d.data() } as Thread);
			});
			setSubReplies(list);
		});
		return () => unsub();
	}, [thread.id]);

	// Click listeners for dropdowns
	useEffect(() => {
		const handleOutside = (e: MouseEvent) => {
			if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) {
				setShowOptions(false);
			}
			if (repostRef.current && !repostRef.current.contains(e.target as Node)) {
				setShowRepostDropdown(false);
			}
		};
		document.addEventListener("mousedown", handleOutside);
		return () => document.removeEventListener("mousedown", handleOutside);
	}, []);

	// Format timestamp
	const timeAgo = useMemo(() => {
		const diff = Date.now() - thread.createdAt;
		const secs = Math.floor(diff / 1000);
		const mins = Math.floor(secs / 60);
		const hours = Math.floor(mins / 60);
		const days = Math.floor(hours / 24);

		if (secs < 60) return "now";
		if (mins < 60) return `${mins}m`;
		if (hours < 24) return `${hours}h`;
		if (days < 7) return `${days}d`;
		return `${Math.floor(days / 7)}w`;
	}, [thread.createdAt]);

	const totalRepliesCount = useMemo(() => {
		return (thread.replies?.length || 0) + subReplies.length;
	}, [thread.replies, subReplies]);

	const replyAvatars = useMemo(() => {
		const list: string[] = [];
		thread.replies?.forEach((r) => {
			if (r.avatarUrl && !list.includes(r.avatarUrl)) list.push(r.avatarUrl);
		});
		subReplies.forEach((r) => {
			if (r.avatarUrl && !list.includes(r.avatarUrl)) list.push(r.avatarUrl);
		});
		return list.slice(0, 3);
	}, [thread.replies, subReplies]);

	// Clickable Hashtags / Mentions Parser
	const parseText = (text: string) => {
		if (!text) return "";
		const parts = text.split(/(\s+)/);
		return parts.map((part, idx) => {
			if (part.startsWith("#") && part.length > 1) {
				const tag = part.substring(1).replace(/[^\w]/g, "");
				return (
					<Link key={idx} href={`/tags/${tag.toLowerCase()}`}>
						<span className='text-brand-orange hover:underline font-semibold cursor-pointer break-all'>
							{part}
						</span>
					</Link>
				);
			}
			if (part.startsWith("@") && part.length > 1) {
				const username = part.substring(1).replace(/[^\w]/g, "");
				return (
					<Link key={idx} href={`/profile?username=${username}`}>
						<span className='text-brand-orange hover:underline font-semibold cursor-pointer break-all'>
							{part}
						</span>
					</Link>
				);
			}
			return (
				<span key={idx} className='break-words'>
					{part}
				</span>
			);
		});
	};

	// Toggle Like
	const handleLikeToggle = async (e?: React.MouseEvent) => {
		e?.stopPropagation();
		if (!user) {
			setLoginTooltipTarget("like");
			setTimeout(() => setLoginTooltipTarget(null), 2000);
			return;
		}

		const newLiked = !isLiked;
		const newCount = likesCount + (newLiked ? 1 : -1);

		setIsLiked(newLiked);
		setLikesCount(newCount);

		try {
			const threadRef = doc(firestore, "threads", thread.id);
			const freshDoc = await getDoc(threadRef);
			if (freshDoc.exists()) {
				const currentLikes = freshDoc.data().likes || [];
				let updatedLikes = [...currentLikes];
				const userIdx = updatedLikes.indexOf(user.uid);

				if (newLiked && userIdx === -1) {
					updatedLikes.push(user.uid);
				} else if (!newLiked && userIdx > -1) {
					updatedLikes.splice(userIdx, 1);
				}

				await updateDoc(threadRef, { likes: updatedLikes });

				if (newLiked && thread.uid !== user.uid) {
					await clientSendNotification("THREAD_LIKE", thread.uid, {
						placeholders: {
							threadTitle: thread.content ? (thread.content.length > 30 ? thread.content.substring(0, 30) + "..." : thread.content) : "Thread",
							replierName: currentUserDisplayName,
						},
						ctaUrl: `/threads?threadId=${thread.id}`,
						metadata: { threadId: thread.id }
					});
				}
			}
		} catch (error) {
			console.error(error);
			setIsLiked(!newLiked);
			setLikesCount(likesCount);
		}
	};

	// Toggle Bookmark
	const handleBookmarkToggle = async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!user) {
			setLoginTooltipTarget("bookmark");
			setTimeout(() => setLoginTooltipTarget(null), 2000);
			return;
		}
		const newBookmarked = !isBookmarked;
		const newCount = bookmarksCount + (newBookmarked ? 1 : -1);

		setIsBookmarked(newBookmarked);
		setBookmarksCount(newCount);

		try {
			await updateDoc(doc(firestore, "threads", thread.id), {
				bookmarkCount: newCount,
			});

			const userRef = doc(firestore, "users", user.uid);
			const userSnap = await getDoc(userRef);
			if (userSnap.exists()) {
				const currentBookmarks = userSnap.data().bookmarks || [];
				let updated = [...currentBookmarks];
				if (newBookmarked && !updated.includes(thread.id)) {
					updated.push(thread.id);
				} else if (!newBookmarked && updated.includes(thread.id)) {
					updated = updated.filter((id) => id !== thread.id);
				}
				await updateDoc(userRef, { bookmarks: updated });
			}
		} catch (err) {
			console.error(err);
			setIsBookmarked(!newBookmarked);
			setBookmarksCount(bookmarksCount);
		}
	};

	// Repost handlers
	const handleSimpleRepost = async () => {
		if (!user) {
			setLoginTooltipTarget("repost");
			setTimeout(() => setLoginTooltipTarget(null), 2000);
			return;
		}
		setShowRepostDropdown(false);
		setRepostStatus("loading");
		try {
			await addDoc(collection(firestore, "threads"), {
				uid: user.uid,
				displayName: currentUserDisplayName,
				avatarUrl: currentUserAvatar,
				content: "",
				createdAt: Date.now(),
				likes: [],
				replies: [],
				repostedThreadId: thread.id,
				parentThreadId: "",
				quotedThreadId: "",
			});

			if (thread.uid !== user.uid) {
				await clientSendNotification("THREAD_QUOTE", thread.uid, {
					placeholders: {
						threadTitle: thread.content ? (thread.content.length > 30 ? thread.content.substring(0, 30) + "..." : thread.content) : "Thread",
						replierName: currentUserDisplayName,
					},
					ctaUrl: `/threads?threadId=${thread.id}`,
					metadata: { threadId: thread.id }
				});
			}

			setRepostStatus("success");
			setTimeout(() => setRepostStatus("idle"), 2000);
		} catch (e) {
			console.error(e);
			setRepostStatus("error");
			setTimeout(() => setRepostStatus("idle"), 2000);
		}
	};

	const handleQuoteRepost = () => {
		if (!user) {
			setLoginTooltipTarget("repost");
			setTimeout(() => setLoginTooltipTarget(null), 2000);
			return;
		}
		setShowRepostDropdown(false);
		setComposer({
			isOpen: true,
			parentThreadId: "",
			replyToDisplayName: displayName,
		});
		sessionStorage.setItem("pendingQuoteId", thread.id);
	};

	// Delete
	const handleDeleteThread = async () => {
		if (!user) return;
		if (!confirm("Delete this thread?")) return;

		setDeleting(true);
		try {
			await deleteDoc(doc(firestore, "threads", thread.id));
			if (isDetailView) {
				router.push("/threads");
			}
		} catch (e) {
			console.error(e);
			setDeleting(false);
		}
	};

	const handleShare = () => {
		const shareUrl = `${window.location.origin}/threads?threadId=${thread.id}`;
		navigator.clipboard.writeText(shareUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	// View Count tracker
	useEffect(() => {
		if (thread.id) {
			const viewedKey = `viewed_${thread.id}`;
			if (!sessionStorage.getItem(viewedKey)) {
				sessionStorage.setItem(viewedKey, "true");
				updateDoc(doc(firestore, "threads", thread.id), {
					viewCount: (thread.viewCount || 0) + 1,
				}).catch(() => {});
			}
		}
	}, [thread.id]);
	return (
		<div
			className={`w-full max-w-[700px] mx-auto bc-surface border-gray-850 hover:bg-dark-hover transition-all duration-300 ease-out rounded-2xl p-5 relative select-none box-sizing-border-box overflow-hidden ${
				isJustPosted ? "border-brand-orange/30 bg-brand-orange/5 shadow-lg" : "shadow-sm dark:shadow-none"
			} ${
				highlighted && !isJustPosted ? "border-brand-orange bg-brand-orange/5" : ""
			} ${deleting ? "opacity-40 pointer-events-none" : ""}`}
		>
			<div className='flex gap-4 items-start w-full'>
				{/* Avatar Left Column (Fixed Width 48px) */}
				<div className='flex flex-col items-center shrink-0 w-12 self-stretch relative'>
					<Link href={`/profile?uid=${thread.uid}`}>
						<div className='cursor-pointer'>
							<Avatar
								src={avatarUrl}
								displayName={displayName}
								size={48}
							/>
						</div>
					</Link>

					{/* Reply Connector Line */}
					{showConnectorLine && (
						<div className='w-[2px] bg-dark-fill-3 absolute top-14 bottom-0 left-1/2 -translate-x-1/2 z-0 opacity-40' />
					)}
				</div>

				{/* Content Right Column (Flexible flex:1, min-width:0 to prevent overflow) */}
				<div className='flex-grow flex-1 min-w-0 space-y-3'>
					{/* Header line */}
					<div className='flex items-center justify-between min-w-0 select-none'>
						<div className='flex items-center gap-1.5 min-w-0'>
							<Link href={`/profile?uid=${thread.uid}`}>
								<span className='font-bold text-[14.5px] text-dark-gray-8 hover:text-brand-orange hover:underline cursor-pointer transition truncate block max-w-[160px] md:max-w-[220px]'>
									{displayName}
								</span>
							</Link>
							<FaCheckCircle className='text-brand-orange shrink-0' size={12} title='Verified Developer' />
						</div>

						<div className='flex items-center gap-2.5 text-bc-muted text-xs shrink-0 font-mono'>
							<span>{timeAgo}</span>

							{/* Options trigger */}
							<div className='relative' ref={optionsRef}>
								<button
									onClick={(e) => {
										e.stopPropagation();
										setShowOptions(!showOptions);
									}}
									className='p-1.5 hover:bg-dark-fill-3 text-bc-muted hover:text-dark-gray-8 rounded-full transition relative'
								>
									<FaEllipsisH size={13} />
									{loginTooltipTarget === "bookmark" && (
										<span className='absolute -top-7 right-0 bg-dark-elevated text-dark-gray-8 text-[10px] px-2 py-0.5 rounded shadow border border-gray-850 font-semibold whitespace-nowrap z-10 animate-fade-in'>
											Sign in first
										</span>
									)}
								</button>
								{showOptions && (
									<div className='absolute right-0 top-7 z-50 bc-surface border-gray-850 rounded-2xl shadow-lg dark:shadow-2xl p-1.5 w-40 animate-fade-in'>
										<button
											onClick={(e) => {
												e.stopPropagation();
												handleShare();
												setShowOptions(false);
											}}
											className='flex items-center gap-2 px-3 py-2 text-xs font-semibold text-dark-gray-7 hover:text-dark-gray-8 hover:bg-dark-hover rounded-xl w-full text-left'
										>
											<FaExternalLinkAlt size={11} /> Copy Link
										</button>
										<button
											onClick={(e) => {
												e.stopPropagation();
												handleBookmarkToggle(e);
												setShowOptions(false);
											}}
											className='flex items-center gap-2 px-3 py-2 text-xs font-semibold text-dark-gray-7 hover:text-dark-gray-8 hover:bg-dark-hover rounded-xl w-full text-left'
										>
											<FaBookmark size={11} /> {isBookmarked ? "Unbookmark" : "Bookmark"}
										</button>
										{(user?.uid === thread.uid || user?.email === "admin@leetcode.com") && (
											<button
												onClick={(e) => {
													e.stopPropagation();
													handleDeleteThread();
													setShowOptions(false);
												}}
												className='flex items-center gap-2 px-3 py-2 text-xs font-semibold text-bc-error hover:text-bc-error hover:bg-bc-error/10 rounded-xl w-full text-left border-t border-gray-850 mt-1'
											>
												<FaTrash size={11} /> Delete
											</button>
										)}
									</div>
								)}
							</div>
						</div>
					</div>

					{/* Main Text Content */}
					{thread.content && (
						<p className='text-[14.5px] leading-relaxed text-dark-gray-8 select-text whitespace-pre-wrap break-words overflow-hidden max-w-full'>
							{parseText(thread.content)}
						</p>
					)}

					{/* Reusable ThreadMedia handles aspect-ratios & responsive constraints */}
					<ThreadMedia
						photos={thread.photos}
						gif={thread.gif}
						onDoubleTap={handleLikeToggle}
					/>

					{/* Poll view */}
					{thread.poll && (
						<PollComponent
							threadId={thread.id}
							poll={thread.poll}
							isReply={false}
							repliesList={thread.replies}
						/>
					)}

					{/* Quoted Post Embed */}
					{thread.quotedThreadId && (
						<Link href={`/threads?threadId=${thread.quotedThreadId}`} className='block w-full'>
							<div className='border border-gray-850 rounded-xl p-4 bg-dark-layer-2 hover:border-gray-750 transition w-full mt-1 overflow-hidden cursor-pointer'>
								{loadingQuote ? (
									<div className='h-12 bg-dark-fill-3/10 rounded animate-pulse w-full' />
								) : quotedThread ? (
									<div className='space-y-2 w-full'>
										<div className='flex items-center gap-2 min-w-0'>
											<Avatar src={quotedAvatarUrl} displayName={quotedDisplayName} size={20} />
											<span className='font-bold text-xs text-dark-gray-8 truncate'>{quotedDisplayName}</span>
											<FaCheckCircle className='text-brand-orange shrink-0' size={10} />
										</div>
										<p className='text-xs text-dark-gray-7 line-clamp-2 leading-relaxed select-text break-words max-w-full'>
											{quotedThread.content}
										</p>
									</div>
								) : (
									<p className='text-xs text-bc-muted italic select-none'>Quoted content deleted.</p>
								)}
							</div>
						</Link>
					)}

					{/* Simple Repost Embed */}
					{thread.repostedThreadId && (
						<Link href={`/threads?threadId=${thread.repostedThreadId}`} className='block w-full'>
							<div className='bg-dark-green-s/10 border border-dark-green-s/30 rounded-xl p-4 mt-1 w-full hover:border-dark-green-s/50 transition overflow-hidden cursor-pointer'>
								<div className='flex items-center gap-1.5 text-[11px] text-dark-green-s font-semibold mb-2 select-none'>
									<FaRetweet size={12} />
									<span>Reposted</span>
								</div>
								<RepostEmbed threadId={thread.repostedThreadId} />
							</div>
						</Link>
					)}

					{/* Solved Code Submissions */}
					{thread.submittedProblem && (
						<div className='border border-gray-850 rounded-xl bg-dark-layer-2 overflow-hidden w-full mt-1'>
							<div
								onClick={() => setShowCode(!showCode)}
								className='flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-dark-hover transition select-none'
							>
								<div className='flex items-center gap-2 text-xs text-dark-gray-7 min-w-0'>
									<FaCode className='text-brand-orange shrink-0' size={13} />
									<span className='font-bold truncate'>{thread.submittedProblem.problemTitle}</span>
									<span className='text-[10px] bg-brand-orange/15 text-brand-orange px-2 py-0.5 rounded font-mono shrink-0 font-bold'>
										{thread.submittedProblem.language}
									</span>
									{thread.submittedProblem.attempts !== undefined && thread.submittedProblem.attempts > 0 && (
										<span className='text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-mono shrink-0 font-bold'>
											{Math.round(((thread.submittedProblem.solved ?? 0) / thread.submittedProblem.attempts) * 100)}% success
										</span>
									)}
								</div>
								<span className='text-[10px] text-brand-orange font-bold hover:underline shrink-0'>
									{showCode ? "Hide Code" : "Show Code"}
								</span>
							</div>
							{showCode && (
								<pre className='p-4 text-xs font-mono bg-dark-layer-2 text-dark-gray-7 overflow-x-auto border-t border-gray-850 max-h-56 select-text whitespace-pre scrollbar-thin'>
									<code>{thread.submittedProblem.code}</code>
								</pre>
							)}
						</div>
					)}

					{/* Actions row: Icons size 20x20, gap 20px, aligned vertically */}
					<div className='flex items-center gap-[20px] text-bc-muted select-none pt-1 min-h-[32px]'>
						{/* Like */}
						<button
							onClick={handleLikeToggle}
							className={`flex items-center gap-1.5 hover:text-red-500 hover:scale-105 transition duration-150 p-1.5 rounded-full hover:bg-red-500/5 shrink-0 relative ${
								isLiked ? "text-red-500" : ""
							}`}
							title='Like'
						>
							<FaHeart size={20} className={isLiked ? "scale-105" : ""} />
							{likesCount > 0 && <span className='text-xs font-bold font-mono self-center'>{likesCount}</span>}
							{loginTooltipTarget === "like" && (
								<span className='absolute -top-7 left-1/2 -translate-x-1/2 bg-dark-elevated text-dark-gray-8 text-[10px] px-2 py-0.5 rounded shadow border border-gray-850 font-semibold whitespace-nowrap z-10 animate-fade-in'>
									Sign in first
								</span>
							)}
						</button>

						{/* Reply */}
						<button
							onClick={(e) => {
								e.stopPropagation();
								if (!user) {
									setLoginTooltipTarget("reply");
									setTimeout(() => setLoginTooltipTarget(null), 2000);
									return;
								}
								setComposer({
									isOpen: true,
									parentThreadId: thread.id,
									replyToDisplayName: displayName,
								});
							}}
							className='flex items-center gap-1.5 hover:text-brand-orange hover:scale-105 transition duration-150 p-1.5 rounded-full hover:bg-brand-orange/5 shrink-0 relative'
							title='Reply'
						>
							<FaComment size={20} />
							{loginTooltipTarget === "reply" && (
								<span className='absolute -top-7 left-1/2 -translate-x-1/2 bg-dark-elevated text-dark-gray-8 text-[10px] px-2 py-0.5 rounded shadow border border-gray-850 font-semibold whitespace-nowrap z-10 animate-fade-in'>
									Sign in first
								</span>
							)}
						</button>

						{/* Repost */}
						<div className='relative' ref={repostRef}>
							<button
								onClick={(e) => {
									e.stopPropagation();
									setShowRepostDropdown(!showRepostDropdown);
								}}
								className={`flex items-center gap-1 hover:text-dark-green-s hover:scale-105 transition duration-150 p-1.5 rounded-full hover:bg-dark-green-s/5 shrink-0 relative ${
									repostStatus === "success" ? "text-dark-green-s" : repostStatus === "error" ? "text-bc-error" : ""
								}`}
								title='Repost / Quote'
							>
								{repostStatus === "loading" ? (
									<svg className='animate-spin w-5 h-5 text-dark-green-s' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<circle cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='2' opacity='0.3' />
										<path d='M12 2a10 10 0 0110 10' strokeWidth='2' strokeLinecap='round' />
									</svg>
								) : (
									<FaRetweet size={20} className={repostStatus === "success" ? "scale-110" : ""} />
								)}
								{repostStatus === "success" && (
									<span className='absolute -top-7 left-1/2 -translate-x-1/2 bg-dark-elevated text-dark-gray-8 text-[10px] px-2 py-0.5 rounded shadow border border-gray-850 font-semibold whitespace-nowrap z-10 animate-fade-in'>
										Reposted!
									</span>
								)}
								{repostStatus === "error" && (
									<span className='absolute -top-7 left-1/2 -translate-x-1/2 bg-bc-error text-dark-gray-8 text-[10px] px-2 py-0.5 rounded shadow border border-bc-error/50 font-semibold whitespace-nowrap z-10 animate-fade-in'>
										Failed!
									</span>
								)}
								{loginTooltipTarget === "repost" && (
									<span className='absolute -top-7 left-1/2 -translate-x-1/2 bg-dark-elevated text-dark-gray-8 text-[10px] px-2 py-0.5 rounded shadow border border-gray-850 font-semibold whitespace-nowrap z-10 animate-fade-in'>
										Sign in first
									</span>
								)}
							</button>
							{showRepostDropdown && (
								<div className='absolute left-0 bottom-7 z-50 bc-surface border-gray-850 rounded-2xl shadow-lg dark:shadow-2xl p-1.5 w-36 animate-fade-in'>
									<button
										onClick={(e) => {
											e.stopPropagation();
											handleSimpleRepost();
										}}
										className='flex items-center gap-2 px-3 py-2 text-xs font-semibold text-dark-gray-7 hover:text-dark-gray-8 hover:bg-dark-hover rounded-xl w-full text-left'
									>
										<FaRetweet size={12} /> Simple Repost
									</button>
									<button
										onClick={(e) => {
											e.stopPropagation();
											handleQuoteRepost();
										}}
										className='flex items-center gap-2 px-3 py-2 text-xs font-semibold text-dark-gray-7 hover:text-dark-gray-8 hover:bg-dark-hover rounded-xl w-full text-left'
									>
										<FaComment size={12} /> Quote Post
									</button>
								</div>
							)}
						</div>

						{/* Share */}
						<button
							onClick={(e) => {
								e.stopPropagation();
								handleShare();
							}}
							className='hover:text-dark-blue-s hover:scale-105 transition duration-150 p-1.5 rounded-full hover:bg-dark-blue-s/5 shrink-0 relative'
							title='Share'
						>
							<FaPaperPlane size={20} />
							{copied && (
								<span className='absolute -top-7 left-1/2 -translate-x-1/2 bg-dark-elevated text-dark-gray-8 text-[10px] px-2 py-0.5 rounded shadow border border-gray-850 font-semibold whitespace-nowrap z-10 animate-fade-in'>
									Copied!
								</span>
							)}
						</button>
					</div>

					{/* View count */}
					{thread.viewCount !== undefined && thread.viewCount > 0 && (
						<div className='flex items-center gap-1 text-[10px] text-bc-muted font-mono select-none pt-0.5'>
							<FaEye size={9} />
							<span>{thread.viewCount} {thread.viewCount === 1 ? "view" : "views"}</span>
						</div>
					)}

					{/* Conversation Footer details: Nested directly under the actions inside card padding */}
					{!isDetailView && totalRepliesCount > 0 && (
						<div className='flex items-center gap-2.5 pt-1.5 select-none'>
							{/* Small overlapping replies avatar pile */}
							<div className='flex items-center shrink-0 -space-x-1.5 min-w-[24px]'>
								{replyAvatars.map((url, idx) => (
									<img
										key={idx}
										src={url}
										alt='Replier avatar'
										className='w-5 h-5 rounded-full object-cover border border-dark-layer-2 shadow-sm relative'
										style={{ zIndex: 10 - idx }}
									/>
								))}
							</div>

							<Link href={`/threads?threadId=${thread.id}`}>
								<span className='text-[12px] text-dark-gray-7 hover:text-brand-orange hover:underline font-semibold cursor-pointer transition'>
									{totalRepliesCount} {totalRepliesCount === 1 ? "reply" : "replies"} · View conversation
								</span>
							</Link>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

const RepostEmbed: React.FC<{ threadId: string }> = ({ threadId }) => {
	const [thread, setThread] = useState<Thread | null>(null);
	const [loading, setLoading] = useState(true);

	const { profile: repostProfile } = useUserProfile(thread?.uid);
	const avatarUrl = repostProfile?.avatarUrl || thread?.avatarUrl;
	const displayName = repostProfile?.displayName || thread?.displayName;

	useEffect(() => {
		const fetchThread = async () => {
			try {
				const docSnap = await getDoc(doc(firestore, "threads", threadId));
				if (docSnap.exists()) {
					setThread({ id: docSnap.id, ...docSnap.data() } as Thread);
				}
			} catch (e) {
				console.error(e);
			} finally {
				setLoading(false);
			}
		};
		fetchThread();
	}, [threadId]);

	if (loading) {
		return <div className='h-12 bg-dark-fill-3/10 rounded animate-pulse w-full' />;
	}

	if (!thread) {
		return <p className='text-xs text-bc-muted italic select-none'>Repost unavailable.</p>;
	}

	return (
		<div className='space-y-1.5 w-full'>
			<div className='flex items-center gap-2 min-w-0'>
				<Avatar src={avatarUrl} displayName={displayName} size={20} />
				<span className='font-bold text-xs text-dark-gray-8 truncate'>{displayName}</span>
				<FaCheckCircle className='text-brand-orange shrink-0' size={10} />
			</div>
			{thread.content && (
				<p className='text-xs text-dark-gray-7 line-clamp-3 leading-relaxed select-text break-words max-w-full'>
					{thread.content}
				</p>
			)}
		</div>
	);
};

export default ThreadCard;
