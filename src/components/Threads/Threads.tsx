import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, firestore } from "@/firebase/firebase";
import {
	collection,
	query,
	where,
	orderBy,
	limit,
	onSnapshot,
	addDoc,
	doc,
	getDoc,
	updateDoc,
	startAfter,
	getDocs,
} from "firebase/firestore";
import { useRecoilState } from "recoil";
import { threadComposerState } from "@/atoms/threadComposerAtom";
import { threadCommentFeedbackAtom } from "@/atoms/threadCommentFeedbackAtom";
import ThreadCard from "./ThreadCard";
import ThreadComposer from "./ThreadComposer";
import Avatar from "./Avatar";
import { FaArrowLeft, FaPaperPlane, FaImage, FaSpinner, FaHeart } from "react-icons/fa";

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
}

interface Thread {
	id: string;
	uid: string;
	displayName: string;
	avatarUrl?: string;
	content: string;
	createdAt: number;
	likes: string[];
	replies: any[]; // legacy
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

interface VirtualizedThreadItemProps {
	children: React.ReactNode;
}

const VirtualizedThreadItem: React.FC<VirtualizedThreadItemProps> = ({ children }) => {
	const [isVisible, setIsVisible] = useState(true);
	const [height, setHeight] = useState<number | string>("auto");
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const intersectionObserver = new IntersectionObserver(
			(entries) => {
				const [entry] = entries;
				setIsVisible(entry.isIntersecting);
				if (entry.isIntersecting && entry.boundingClientRect.height > 0) {
					setHeight(entry.boundingClientRect.height);
				}
			},
			{
				rootMargin: "800px 0px 800px 0px",
			}
		);

		intersectionObserver.observe(container);

		const resizeObserver = new ResizeObserver((entries) => {
			const [entry] = entries;
			if (entry && entry.contentRect.height > 0) {
				setHeight(entry.target.getBoundingClientRect().height);
			}
		});

		resizeObserver.observe(container);

		return () => {
			intersectionObserver.disconnect();
			resizeObserver.disconnect();
		};
	}, []);

	return (
		<div ref={containerRef} style={{ minHeight: height }}>
			{isVisible ? children : <div style={{ height }} className='bg-white dark:bg-[#111622] border border-slate-200/80 dark:border-slate-800/70 rounded-2xl opacity-10' />}
		</div>
	);
};

interface ThreadsBoardProps {
	problemId?: string;
	problemTitle?: string;
	profileUid?: string;
	postFeedOnly?: boolean;
	repostFeedOnly?: boolean;
}

const ThreadsBoard: React.FC<ThreadsBoardProps> = ({
	problemId,
	profileUid,
	postFeedOnly = false,
	repostFeedOnly = false,
}) => {
	const [user] = useAuthState(auth);
	const router = useRouter();
	const [, setComposer] = useRecoilState(threadComposerState);
	const [commentFeedback, setCommentFeedback] = useRecoilState(threadCommentFeedbackAtom);

	// Core State
	const [threads, setThreads] = useState<Thread[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [lastDoc, setLastDoc] = useState<any>(null);
	const [hasMore, setHasMore] = useState(true);
	const [activeTab, setActiveTab] = useState<"forYou" | "following">("forYou");

	// Detailed View State
	const [focusedThreadId, setFocusedThreadId] = useState<string | null>(null);
	const [focusedThread, setFocusedThread] = useState<Thread | null>(null);
	const [conversationThreads, setConversationThreads] = useState<Thread[]>([]);

	// Following state list of uids
	const [followingUids, setFollowingUids] = useState<string[]>([]);

	// Quick inline reply state (for detail page)
	const [inlineReplyText, setInlineReplyText] = useState("");
	const [inlinePhotos, setInlinePhotos] = useState<string[]>([]);
	const [postingReply, setPostingReply] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const sentinelRef = useRef<HTMLDivElement>(null);

	// Sync deep links with router query ?threadId=XYZ
	useEffect(() => {
		if (router.query.threadId) {
			setFocusedThreadId(router.query.threadId as string);
		} else {
			setFocusedThreadId(null);
			setFocusedThread(null);
		}
	}, [router.query.threadId]);

	// Fetch target thread details when focusedThreadId changes
	useEffect(() => {
		if (!focusedThreadId) return;
		const unsub = onSnapshot(doc(firestore, "threads", focusedThreadId), (snap) => {
			if (snap.exists()) {
				setFocusedThread({ id: snap.id, ...snap.data() } as Thread);
			} else {
				setFocusedThread(null);
			}
		});
		return () => unsub();
	}, [focusedThreadId]);

	// Subscribe to followed user IDs
	useEffect(() => {
		if (!user) {
			setFollowingUids([]);
			return;
		}
		const q = query(
			collection(firestore, "follows"),
			where("followerId", "==", user.uid)
		);
		const unsub = onSnapshot(q, (snap) => {
			const uids: string[] = [];
			snap.forEach((d) => {
				uids.push(d.data().followingId);
			});
			setFollowingUids(uids);
		});
		return () => unsub();
	}, [user]);

	// Subscribe to conversation replies in detail view
	useEffect(() => {
		if (!focusedThreadId) {
			setConversationThreads([]);
			return;
		}

		const q = query(
			collection(firestore, "threads"),
			where("parentThreadId", "==", focusedThreadId)
		);

		const unsub = onSnapshot(q, (snap) => {
			const directList: Thread[] = [];
			snap.forEach((d) => {
				directList.push({ id: d.id, ...d.data() } as Thread);
			});

			if (directList.length === 0) {
				setConversationThreads([]);
				return;
			}

			const directIds = directList.map((d) => d.id);
			const targetIds = [focusedThreadId, ...directIds.slice(0, 9)];

			const qSub = query(
				collection(firestore, "threads"),
				where("parentThreadId", "in", targetIds)
			);

			const unsubCombined = onSnapshot(qSub, (subSnap) => {
				const allReplies: Thread[] = [];
				subSnap.forEach((d) => {
					allReplies.push({ id: d.id, ...d.data() } as Thread);
				});
				setConversationThreads(allReplies);
			});

			return () => unsubCombined();
		});

		return () => unsub();
	}, [focusedThreadId]);

	// Subscribe to first batch (20 items) of feed in real-time
	useEffect(() => {
		setLoading(true);
		setThreads([]);
		setLastDoc(null);
		setHasMore(true);

		let q = query(
			collection(firestore, "threads"),
			orderBy("createdAt", "desc"),
			limit(20)
		);

		if (profileUid) {
			q = query(
				collection(firestore, "threads"),
				where("uid", "==", profileUid),
				orderBy("createdAt", "desc"),
				limit(20)
			);
		} else if (problemId) {
			q = query(
				collection(firestore, "threads"),
				where("submittedProblem.problemId", "==", problemId),
				orderBy("createdAt", "desc"),
				limit(20)
			);
		} else {
			q = query(
				collection(firestore, "threads"),
				where("parentThreadId", "==", ""),
				orderBy("createdAt", "desc"),
				limit(20)
			);
		}

		const unsub = onSnapshot(
			q,
			(snapshot) => {
				const list: Thread[] = [];
				snapshot.forEach((docSnap) => {
					list.push({ id: docSnap.id, ...docSnap.data() } as Thread);
				});
				setThreads(list);
				setLoading(false);

				if (snapshot.docs.length > 0) {
					setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
					setHasMore(snapshot.docs.length === 20);
				} else {
					setLastDoc(null);
					setHasMore(false);
				}
			},
			(err) => {
				console.error("Threads subscribe error:", err);
				setLoading(false);
			}
		);

		return () => unsub();
	}, [profileUid, problemId, activeTab]);

	// Load more threads (pagination cursor)
	const loadMoreThreads = useCallback(async () => {
		if (loading || loadingMore || !hasMore || !lastDoc) return;
		setLoadingMore(true);

		try {
			let q = query(
				collection(firestore, "threads"),
				orderBy("createdAt", "desc"),
				startAfter(lastDoc),
				limit(20)
			);

			if (profileUid) {
				q = query(
					collection(firestore, "threads"),
					where("uid", "==", profileUid),
					orderBy("createdAt", "desc"),
					startAfter(lastDoc),
					limit(20)
				);
			} else if (problemId) {
				q = query(
					collection(firestore, "threads"),
					where("submittedProblem.problemId", "==", problemId),
					orderBy("createdAt", "desc"),
					startAfter(lastDoc),
					limit(20)
				);
			} else {
				q = query(
					collection(firestore, "threads"),
					where("parentThreadId", "==", ""),
					orderBy("createdAt", "desc"),
					startAfter(lastDoc),
					limit(20)
				);
			}

			const snapshot = await getDocs(q);
			const list: Thread[] = [];
			snapshot.forEach((d) => {
				list.push({ id: d.id, ...d.data() } as Thread);
			});

			if (list.length > 0) {
				setThreads((prev) => {
					const existingIds = new Set(prev.map((t) => t.id));
					const filteredNew = list.filter((t) => !existingIds.has(t.id));
					return [...prev, ...filteredNew];
				});
				setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
				setHasMore(snapshot.docs.length === 20);
			} else {
				setHasMore(false);
			}
		} catch (err) {
			console.error("Error loading more threads:", err);
		} finally {
			setLoadingMore(false);
		}
	}, [loading, loadingMore, hasMore, lastDoc, profileUid, problemId]);

	// Sentinel intersection observer for infinite scroll
	useEffect(() => {
		const sentinel = sentinelRef.current;
		if (!sentinel) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const [entry] = entries;
				if (entry.isIntersecting && hasMore && !loading && !loadingMore) {
					loadMoreThreads();
				}
			},
			{
				rootMargin: "200px",
			}
		);

		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [lastDoc, hasMore, loading, loadingMore, loadMoreThreads]);

	// Algorithmic Feed Sorting (For You Feed)
	const scoredThreads = useMemo(() => {
		return threads.map((t) => {
			const likesCount = t.likes?.length || 0;
			const repliesCount = t.replies?.length || 0;
			const viewsCount = t.viewCount || 0;
			const timeDiffHours = (Date.now() - t.createdAt) / (1000 * 60 * 60);

			// Engagement Score
			const engagement = likesCount * 10 + repliesCount * 15 + viewsCount * 1;
			// Recency Score (time decay)
			const recency = 1 / (1 + Math.pow(timeDiffHours, 1.4));

			const score = engagement * recency;
			return { thread: t, score };
		});
	}, [threads]);

	// Filter and Rank Feeds
	const filteredThreads = useMemo(() => {
		// 1. Profile Feed
		if (profileUid) {
			if (repostFeedOnly) {
				return threads.filter((t) => t.uid === profileUid && !!t.repostedThreadId);
			}
			if (postFeedOnly) {
				return threads.filter((t) => t.uid === profileUid && !t.repostedThreadId && !t.parentThreadId);
			}
			return threads.filter((t) => t.uid === profileUid && !t.parentThreadId);
		}

		// 2. Coding Problem Feed
		if (problemId) {
			return threads.filter(
				(t) => t.submittedProblem?.problemId === problemId && !t.parentThreadId
			);
		}

		// 3. Main Feed: Filter out replies (replies are viewed in subtrees)
		const topLevelOnly = threads.filter((t) => !t.parentThreadId);

		if (activeTab === "following") {
			// Show posts by followed users and the user themselves
			return topLevelOnly.filter((t) => followingUids.includes(t.uid) || t.uid === user?.uid);
		}

		// "For You" Feed: Sorted algorithmically
		const topScored = scoredThreads.filter((st) => !st.thread.parentThreadId);
		topScored.sort((a, b) => b.score - a.score);
		return topScored.map((st) => st.thread);
	}, [threads, profileUid, problemId, activeTab, followingUids, user, scoredThreads, postFeedOnly, repostFeedOnly]);

	// Get replies for focused thread (flat list inside DB)
	const directReplies = useMemo(() => {
		if (!focusedThreadId) return [];
		return conversationThreads.filter((t) => t.parentThreadId === focusedThreadId);
	}, [conversationThreads, focusedThreadId]);

	// Recursive nested replies tree rendering helper
	const renderRepliesTree = (parentId: string, depth = 0) => {
		const replies = conversationThreads.filter((t) => t.parentThreadId === parentId);
		// Sort oldest first for readability
		replies.sort((a, b) => a.createdAt - b.createdAt);

		if (replies.length === 0) return null;

		return (
			<div className={`space-y-4 ${depth > 0 ? "pl-6 border-l border-slate-200 dark:border-slate-800/70 mt-3 ml-4" : ""}`}>
				{replies.map((reply) => {
					const hasSubReplies = conversationThreads.some((t) => t.parentThreadId === reply.id);
					return (
						<div key={reply.id} className='relative group'>
							<ThreadCard
								thread={reply}
								isDetailView={false}
								showConnectorLine={hasSubReplies}
							/>
							{/* Nested level 1 */}
							{depth < 1 && renderRepliesTree(reply.id, depth + 1)}
							{/* If too deep, provide link to open as main focused thread */}
							{depth >= 1 && hasSubReplies && (
								<div className='pl-6 mt-2 text-[11px] font-semibold text-gray-500 hover:text-brand-orange transition cursor-pointer select-none'>
									<button onClick={() => router.push(`/threads?threadId=${reply.id}`)}>
										↳ View deeper replies...
									</button>
								</div>
							)}
						</div>
					);
				})}
			</div>
		);
	};

	// Inline Quick Reply submit
	const handlePostInlineReply = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user || !focusedThreadId || !focusedThread) return;
		if (!inlineReplyText.trim() && inlinePhotos.length === 0) {
			setCommentFeedback({
				isSubmitting: false,
				error: "Reply content cannot be empty.",
				justPosted: null,
			});
			return;
		}

		setPostingReply(true);
		setCommentFeedback({
			isSubmitting: true,
			error: "",
			justPosted: null,
		});

		const tempId = "temp-" + Date.now();

		try {
			// Fetch author profile
			const userSnap = await getDoc(doc(firestore, "users", user.uid));
			const profile = userSnap.exists() ? userSnap.data() : null;
			const authorName = profile?.displayName || user.displayName || user.email?.split("@")[0] || "Anonymous";
			const authorAvatar = profile?.avatarUrl || user.photoURL || "";

			// Parse hashtags & mentions
			const hashRegex = /#(\w+)/g;
			const hashtags: string[] = [];
			let match;
			while ((match = hashRegex.exec(inlineReplyText)) !== null) {
				hashtags.push(match[1].toLowerCase());
			}

			const mentionRegex = /@(\w+)/g;
			const mentions: string[] = [];
			while ((match = mentionRegex.exec(inlineReplyText)) !== null) {
				mentions.push(match[1]);
			}

			// Optimistically push the comment directly into the conversationThreads rendering list instantly
			const newReplyObj: Thread = {
				id: tempId,
				uid: user.uid,
				displayName: authorName,
				avatarUrl: authorAvatar,
				content: inlineReplyText.trim(),
				createdAt: Date.now(),
				likes: [],
				replies: [],
				photos: inlinePhotos,
				parentThreadId: focusedThreadId,
				quotedThreadId: "",
				hashtags,
				mentions,
			};
			setConversationThreads((prev) => [...prev, newReplyObj]);
			setCommentFeedback({
				isSubmitting: false,
				error: "",
				justPosted: { id: tempId, timestamp: Date.now() },
			});

			// Add doc to threads collection
			const docRef = await addDoc(collection(firestore, "threads"), {
				uid: user.uid,
				displayName: authorName,
				avatarUrl: authorAvatar,
				content: inlineReplyText.trim(),
				createdAt: Date.now(),
				likes: [],
				replies: [],
				photos: inlinePhotos,
				parentThreadId: focusedThreadId,
				quotedThreadId: "",
				hashtags,
				mentions,
			});

			// Trigger reply notification
			if (focusedThread.uid !== user.uid) {
				await addDoc(collection(firestore, "notifications"), {
					toUid: focusedThread.uid,
					fromUid: user.uid,
					fromDisplayName: authorName,
					fromAvatarUrl: authorAvatar,
					type: "reply",
					threadId: focusedThreadId,
					createdAt: Date.now(),
					read: false,
				});
			}

			// Replace the temp ID in recoil state so the flash remains matching the firebase ID
			setCommentFeedback({
				isSubmitting: false,
				error: "",
				justPosted: { id: docRef.id, timestamp: Date.now() },
			});

			// Clear text inputs
			setInlineReplyText("");
			setInlinePhotos([]);

			// Fade out the highlight after 2.5 seconds
			setTimeout(() => {
				setCommentFeedback((prev) => 
					prev.justPosted?.id === docRef.id ? { ...prev, justPosted: null } : prev
				);
			}, 2500);
		} catch (err: any) {
			console.error("Inline reply post error:", err);
			// Roll back the optimistic addition from conversationThreads
			setConversationThreads((prev) => prev.filter((t) => t.id !== tempId));
			setCommentFeedback({
				isSubmitting: false,
				error: err.message || "Failed to post reply.",
				justPosted: null,
			});
		} finally {
			setPostingReply(false);
		}
	};

	// Photo attachment inside inline reply
	const handleInlinePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files) return;
		for (const file of Array.from(files)) {
			if (!file.type.startsWith("image/")) continue;
			const reader = new FileReader();
			reader.onload = (ev) => {
				if (ev.target?.result) {
					setInlinePhotos((prev) => [...prev, ev.target!.result as string]);
				}
			};
			reader.readAsDataURL(file);
		}
	};

	// Skeletal loading markup
	if (loading) {
		return (
			<div className='max-w-2xl mx-auto space-y-6 pt-4'>
				{[1, 2, 3].map((n) => (
					<div
						key={n}
						className='border border-slate-200/80 dark:border-slate-800/70 bg-white dark:bg-[#111622] rounded-3xl p-5 flex gap-4 animate-pulse shadow-sm dark:shadow-none'
					>
						<div className='w-11 h-11 bg-slate-100 dark:bg-dark-fill-3 rounded-full shrink-0' />
						<div className='flex-1 space-y-3'>
							<div className='h-3.5 bg-slate-100 dark:bg-dark-fill-3 rounded w-1/4' />
							<div className='h-3 bg-slate-100 dark:bg-dark-fill-3 rounded w-3/4' />
							<div className='h-3 bg-slate-100 dark:bg-dark-fill-3 rounded w-5/6' />
							<div className='h-24 bg-slate-100 dark:bg-dark-fill-3 rounded-xl w-full' />
						</div>
					</div>
				))}
			</div>
		);
	}

	// ----------------------
	// 1. DETAILED VIEW RENDER
	// ----------------------
	if (focusedThreadId && focusedThread) {
		const hasReplies = directReplies.length > 0;
		return (
			<div className='w-full max-w-[700px] mx-auto space-y-6 pt-4 px-1'>
				{/* Back Button */}
				<button
					onClick={() => {
						// Clean shallow routing back to feed
						router.push("/threads", undefined, { shallow: true });
					}}
					className='flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white transition duration-150 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-dark-fill-3/5 hover:bg-slate-200 dark:hover:bg-dark-fill-3/20 select-none'
				>
					<FaArrowLeft size={10} />
					<span>Back to Feed</span>
				</button>

				{/* Parent Thread Card */}
				<ThreadCard
					thread={focusedThread}
					isDetailView={true}
					showConnectorLine={hasReplies}
					highlighted={true}
				/>

				{/* Conversation replies tree */}
				<div className='space-y-4'>
					{renderRepliesTree(focusedThreadId)}
					{!hasReplies && (
						<p className='text-center text-xs text-slate-500 italic py-6 select-none'>
							No replies yet. Be the first to reply!
						</p>
					)}
				</div>

				{/* Sticky Inline reply box at the bottom */}
				{user ? (
					<div className="sticky bottom-4 w-full z-20 flex flex-col gap-1.5 animate-fade-in">
						{commentFeedback.error && (
							<div className="bg-rose-500/10 border border-rose-500/20 text-rose-655 dark:text-rose-455 text-[11px] px-3.5 py-1.5 rounded-xl shadow-lg self-start backdrop-blur-md">
								{commentFeedback.error}
							</div>
						)}
						<form
							onSubmit={handlePostInlineReply}
							className='bg-white dark:bg-[#111622] border border-slate-200/85 dark:border-gray-850 p-3 rounded-2xl flex gap-3 items-center shadow-md dark:shadow-2xl w-full'
						>
							{/* Attach photo inside inline input */}
							<label className='cursor-pointer text-slate-400 hover:text-slate-600 dark:text-gray-500 dark:hover:text-white p-2.5 hover:bg-slate-100 dark:hover:bg-dark-fill-3/30 rounded-xl transition shrink-0'>
								<FaImage size={15} />
								<input
									ref={fileInputRef}
									type='file'
									accept='image/*'
									multiple
									className='hidden'
									onChange={handleInlinePhotoSelect}
								/>
							</label>

							<input
								type='text'
								value={inlineReplyText}
								onChange={(e) => setInlineReplyText(e.target.value)}
								placeholder={`Reply to @${focusedThread.displayName}...`}
								className='flex-grow !bg-transparent !border-0 !p-0 !ring-0 !focus:ring-0 !shadow-none text-xs text-slate-900 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-600'
							/>

							{/* Photo attachments previews in quick composer */}
							{inlinePhotos.length > 0 && (
								<div className='flex gap-1.5 shrink-0 select-none'>
									{inlinePhotos.map((photo, pIdx) => (
										<div key={pIdx} className='relative w-9 h-9 rounded-lg overflow-hidden border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-black/40'>
											<img src={photo} className='w-full h-full object-cover' />
											<button
												type='button'
												onClick={() => setInlinePhotos((p) => p.filter((_, idx) => idx !== pIdx))}
												className='absolute inset-0 bg-red-655/70 dark:bg-red-600/70 opacity-0 hover:opacity-100 flex items-center justify-center text-white text-[8px] transition'
											>
												Delete
											</button>
										</div>
									))}
								</div>
							)}

							<button
								type='submit'
								disabled={postingReply || (!inlineReplyText.trim() && inlinePhotos.length === 0)}
								className='bg-brand-orange hover:bg-brand-orange-s text-white p-2.5 rounded-xl transition disabled:opacity-40 shrink-0 shadow-md flex items-center justify-center'
							>
								{postingReply ? (
									<FaSpinner className='animate-spin' size={13} />
								) : (
									<FaPaperPlane size={12} />
								)}
							</button>
						</form>
					</div>
				) : (
					<p className='text-center text-xs text-slate-500 italic py-3 select-none bg-slate-100 dark:bg-dark-fill-3/10 rounded-xl border border-slate-200/80 dark:border-gray-850/50'>
						Please log in to join the discussion.
					</p>
				)}
				<ThreadComposer />
			</div>
		);
	}

	// ----------------------
	// 2. MAIN FEED / LIST VIEW RENDER
	// ----------------------
	return (
		<div className='w-full max-w-[700px] mx-auto space-y-6 pt-4 px-1'>
			{/* Feed Switcher Tabs (Only if not viewing profile or problem feed) */}
			{!profileUid && !problemId && (
				<div className='flex gap-3 justify-center mb-4 select-none'>
					<button
						onClick={() => setActiveTab("forYou")}
						className={`px-5 py-2 text-xs font-bold rounded-2xl border transition duration-200 ${
							activeTab === "forYou"
								? "border-brand-orange bg-brand-orange/5 text-brand-orange"
								: "border-slate-200 dark:border-slate-800/80 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white bg-transparent"
						}`}
					>
						For You
					</button>
					<button
						onClick={() => setActiveTab("following")}
						className={`px-5 py-2 text-xs font-bold rounded-2xl border transition duration-200 ${
							activeTab === "following"
								? "border-brand-orange bg-brand-orange/5 text-brand-orange"
								: "border-slate-200 dark:border-slate-800/80 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white bg-transparent"
						}`}
					>
						Following
					</button>
				</div>
			)}

			{/* Inline "What's new?" composer card at the top of the feed */}
			{user && !profileUid && !problemId && (
				<div
					onClick={() => setComposer({ isOpen: true })}
					className='flex items-center gap-4 border border-dashed border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#111622] hover:bg-slate-50 dark:hover:bg-[#151B2A] transition duration-150 rounded-2xl p-5 cursor-pointer select-none shadow-sm dark:shadow-none'
				>
					<Avatar
						src={user.photoURL}
						displayName={user.displayName || user.email?.split("@")[0] || "M"}
						size={40}
					/>
					<span className='text-xs font-semibold text-slate-500 dark:text-gray-500 flex-grow'>
						{"What's new?"}
					</span>
					<button className='bg-brand-orange hover:bg-brand-orange-s text-white text-xs font-bold px-5 py-2 rounded-full transition shadow-md'>
						Post
					</button>
				</div>
			)}

			{/* Threads Feed list */}
			<div className='space-y-4 pb-12'>
				{filteredThreads.map((thread) => (
					<VirtualizedThreadItem key={thread.id}>
						<div
							onClick={() => {
								// Open detailed view by updating router query parameters (shallow)
								router.push(`/threads?threadId=${thread.id}`, undefined, { shallow: true });
							}}
							className='cursor-pointer'
						>
							<ThreadCard thread={thread} />
						</div>
					</VirtualizedThreadItem>
				))}

				{/* Infinite scroll sentinel */}
				<div ref={sentinelRef} className='h-10 flex items-center justify-center select-none'>
					{loadingMore && (
						<FaSpinner className='animate-spin text-brand-orange' size={18} />
					)}
				</div>

				{/* Empty Feed State */}
				{filteredThreads.length === 0 && (
					<div className='flex flex-col items-center justify-center py-16 text-center select-none bg-slate-50 dark:bg-dark-fill-3/5 border border-slate-200 dark:border-slate-800/60 rounded-3xl p-6'>
						<FaHeart className='text-slate-400 dark:text-gray-600 mb-3 animate-pulse' size={28} />
						<p className='text-sm font-bold text-slate-700 dark:text-gray-400'>No threads posted here yet.</p>
						<p className='text-xs text-slate-500 dark:text-gray-600 mt-1 max-w-xs'>
							{activeTab === "following"
								? "Users you follow haven't posted yet, or you haven't followed anyone. Try following developers!"
								: "Be the first to post a thread!"}
						</p>
					</div>
				)}
			</div>

			{/* Floating composer modal */}
			<ThreadComposer />
		</div>
	);
};

export default ThreadsBoard;
