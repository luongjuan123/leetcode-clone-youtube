import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, firestore } from "@/firebase/firebase";
import {
	collection,
	doc,
	query,
	orderBy,
	limit,
	onSnapshot,
} from "firebase/firestore";
import { ChatMessage, ChatAttachment, MessageReplyReference } from "@/types/chat";

export function useMessages(conversationId: string | null) {
	const [user] = useAuthState(auth);
	const [rawMessages, setRawMessages] = useState<ChatMessage[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadingOlder, setLoadingOlder] = useState(false);
	const [hasMoreOlder, setHasMoreOlder] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [readPointers, setReadPointers] = useState<Record<string, number>>({});
	const [participantUids, setParticipantUids] = useState<string[]>([]);
	const [initialLastReadAt, setInitialLastReadAt] = useState<number | null>(null);
	const initialReadCapturedRef = useRef<boolean>(false);

	const oldestMessageTimestampRef = useRef<number | null>(null);
	const pendingMessagesRef = useRef<Map<string, ChatMessage>>(new Map());

	// ─── Real-time Snapshot Listener for Conversation Metadata (Read Receipts) ─
	useEffect(() => {
		if (!conversationId || !user) {
			setReadPointers({});
			setParticipantUids([]);
			setInitialLastReadAt(null);
			return;
		}

		initialReadCapturedRef.current = false;
		const convRef = doc(firestore, "conversations", conversationId);
		const unsub = onSnapshot(
			convRef,
			(snap) => {
				if (snap.exists()) {
					const data = snap.data();
					const pointers = (data.readPointers as Record<string, number>) || {};
					setReadPointers(pointers);
					setParticipantUids((data.participantUids as string[]) || []);

					if (!initialReadCapturedRef.current) {
						initialReadCapturedRef.current = true;
						setInitialLastReadAt(pointers[user.uid] || 0);
					}
				}
			},
			(err) => {
				console.warn("[useMessages convRef onSnapshot warning]:", err.message);
			}
		);

		return () => unsub();
	}, [conversationId, user]);

	// ─── Real-time Snapshot Listener for Latest Messages ──────────────────────
	useEffect(() => {
		if (!conversationId || !user) {
			setRawMessages([]);
			setLoading(false);
			return;
		}

		setLoading(true);
		setError(null);

		const messagesRef = collection(firestore, "conversations", conversationId, "messages");
		const q = query(messagesRef, orderBy("createdAt", "desc"), limit(40));

		const unsub = onSnapshot(
			q,
			(snapshot) => {
				const fetched: ChatMessage[] = [];
				snapshot.forEach((doc) => {
					fetched.push({
						id: doc.id,
						...(doc.data() as Omit<ChatMessage, "id">),
						deliveryStatus: "sent",
					});
				});

				// Reverse so earliest is first
				fetched.reverse();

				if (fetched.length > 0) {
					oldestMessageTimestampRef.current = fetched[0].createdAt;
				}

				// Merge with pending optimistic messages that haven't appeared in snapshot yet
				setRawMessages((prev) => {
					const serverIds = new Set(fetched.map((m) => m.id));
					const serverClientIds = new Set(fetched.map((m) => m.clientMessageId).filter(Boolean));

					// Retain pending messages whose clientMessageId hasn't arrived on server yet
					const remainingPending = Array.from(pendingMessagesRef.current.values()).filter(
						(p) => !serverClientIds.has(p.clientMessageId) && !serverIds.has(p.id)
					);

					// Combine older loaded messages if any
					const olderMessages = prev.filter(
						(p) =>
							fetched.length > 0 &&
							p.createdAt < fetched[0].createdAt &&
							!serverIds.has(p.id)
					);

					return [...olderMessages, ...fetched, ...remainingPending];
				});

				setLoading(false);
			},
			(err) => {
				console.error("[useMessages onSnapshot error]:", err);
				setError(err.message || "Failed to load messages");
				setLoading(false);
			}
		);

		return () => unsub();
	}, [conversationId, user]);

	// ─── Load Older Messages (Backward Pagination) ─────────────────────────────
	const loadOlderMessages = useCallback(async () => {
		if (!conversationId || !user || loadingOlder || !hasMoreOlder) return;

		const oldest = oldestMessageTimestampRef.current;
		if (!oldest) return;

		setLoadingOlder(true);
		try {
			const idToken = await user.getIdToken();
			const res = await fetch(
				`/api/chat/conversations/${conversationId}/messages?before=${oldest}&limit=30`,
				{
					headers: { Authorization: `Bearer ${idToken}` },
				}
			);
			const data = await res.json();
			if (data.success) {
				const older: ChatMessage[] = data.messages || [];
				if (older.length > 0) {
					oldestMessageTimestampRef.current = older[0].createdAt;
					setRawMessages((prev) => {
						const existingIds = new Set(prev.map((m) => m.id));
						const uniqueOlder = older.filter((m) => !existingIds.has(m.id));
						return [...uniqueOlder, ...prev];
					});
				}
				if (!data.hasMore || older.length === 0) {
					setHasMoreOlder(false);
				}
			}
		} catch (err: any) {
			console.error("[loadOlderMessages error]:", err);
		} finally {
			setLoadingOlder(false);
		}
	}, [conversationId, user, loadingOlder, hasMoreOlder]);

	// ─── Optimistic Send Message ───────────────────────────────────────────────
	const sendMessage = useCallback(
		async (params: {
			text?: string;
			type?: "text" | "code" | "image" | "file" | "voice";
			code?: { language: string; content: string };
			attachments?: ChatAttachment[];
			replyTo?: MessageReplyReference;
		}) => {
			if (!conversationId || !user) return;

			const clientMessageId = `cm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
			const now = Date.now();

			const optimisticMsg: ChatMessage = {
				id: clientMessageId,
				conversationId,
				senderId: user.uid,
				senderDisplayName: user.displayName || user.email?.split("@")[0] || "Me",
				senderUsername: user.email?.split("@")[0] || "me",
				senderAvatarUrl: user.photoURL || undefined,
				type: params.type || (params.code ? "code" : params.attachments?.length ? "file" : "text"),
				text: params.text || "",
				code: params.code,
				attachments: params.attachments,
				hasAttachments: !!(params.attachments && params.attachments.length > 0),
				replyTo: params.replyTo,
				reactions: {},
				clientMessageId,
				createdAt: now,
				deliveryStatus: "sending",
			};

			// Save to pending map & optimistic state
			pendingMessagesRef.current.set(clientMessageId, optimisticMsg);
			setRawMessages((prev) => [...prev, optimisticMsg]);

			try {
				const idToken = await user.getIdToken();
				const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${idToken}`,
					},
					body: JSON.stringify({
						...params,
						clientMessageId,
					}),
				});

				const data = await res.json();
				if (!res.ok || !data.success) {
					throw new Error(data.error || "Failed to send message");
				}

				// Successfully confirmed
				pendingMessagesRef.current.delete(clientMessageId);
				setRawMessages((prev) =>
					prev.map((m) =>
						m.clientMessageId === clientMessageId
							? { ...m, id: data.message.id, deliveryStatus: "sent" }
							: m
					)
				);
			} catch (err: any) {
				console.error("[sendMessage error]:", err);
				// Mark as failed
				setRawMessages((prev) =>
					prev.map((m) =>
						m.clientMessageId === clientMessageId
							? { ...m, deliveryStatus: "failed" }
							: m
					)
				);
			}
		},
		[conversationId, user]
	);

	// ─── Retry Failed Message ──────────────────────────────────────────────────
	const retryMessage = useCallback(
		async (failedClientMessageId: string) => {
			const target = pendingMessagesRef.current.get(failedClientMessageId);
			if (!target || !conversationId || !user) return;

			setRawMessages((prev) =>
				prev.map((m) =>
					m.clientMessageId === failedClientMessageId
						? { ...m, deliveryStatus: "sending" }
						: m
				)
			);

			try {
				const idToken = await user.getIdToken();
				const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${idToken}`,
					},
					body: JSON.stringify({
						text: target.text,
						type: target.type,
						code: target.code,
						attachments: target.attachments,
						replyTo: target.replyTo,
						clientMessageId: target.clientMessageId,
					}),
				});

				const data = await res.json();
				if (!res.ok || !data.success) {
					throw new Error(data.error || "Failed to retry message");
				}

				pendingMessagesRef.current.delete(failedClientMessageId);
				setRawMessages((prev) =>
					prev.map((m) =>
						m.clientMessageId === failedClientMessageId
							? { ...m, id: data.message.id, deliveryStatus: "sent" }
							: m
					)
				);
			} catch (err: any) {
				setRawMessages((prev) =>
					prev.map((m) =>
						m.clientMessageId === failedClientMessageId
							? { ...m, deliveryStatus: "failed" }
							: m
					)
				);
			}
		},
		[conversationId, user]
	);

	// ─── Mark Conversation as Read ─────────────────────────────────────────────
	const markAsRead = useCallback(async () => {
		if (!conversationId || !user) return;
		try {
			const idToken = await user.getIdToken();
			await fetch(`/api/chat/conversations/${conversationId}/read`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${idToken}`,
				},
				body: JSON.stringify({
					readTimestamp: Date.now(),
				}),
			});
		} catch (err: any) {
			console.warn("[markAsRead error]:", err.message);
		}
	}, [conversationId, user]);

	// ─── Toggle Reaction ───────────────────────────────────────────────────────
	const toggleReaction = useCallback(
		async (messageId: string, emoji: string) => {
			if (!conversationId || !user) return;

			// Optimistic toggle
			setRawMessages((prev) =>
				prev.map((m) => {
					if (m.id !== messageId) return m;
					const reactions = { ...(m.reactions || {}) };
					const currentUids = reactions[emoji] || [];
					const hasReacted = currentUids.includes(user.uid);
					const newUids = hasReacted
						? currentUids.filter((u) => u !== user.uid)
						: [...currentUids, user.uid];

					if (newUids.length > 0) {
						reactions[emoji] = newUids;
					} else {
						delete reactions[emoji];
					}
					return { ...m, reactions };
				})
			);

			try {
				const idToken = await user.getIdToken();
				await fetch(
					`/api/chat/conversations/${conversationId}/messages/${messageId}/reactions`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${idToken}`,
						},
						body: JSON.stringify({ emoji }),
					}
				);
			} catch (err: any) {
				console.error("[toggleReaction error]:", err);
			}
		},
		[conversationId, user]
	);

	// ─── Edit Message ──────────────────────────────────────────────────────────
	const editMessage = useCallback(
		async (messageId: string, newText: string) => {
			if (!conversationId || !user) return;

			setRawMessages((prev) =>
				prev.map((m) =>
					m.id === messageId ? { ...m, text: newText, isEdited: true, editedAt: Date.now() } : m
				)
			);

			try {
				const idToken = await user.getIdToken();
				await fetch(`/api/chat/conversations/${conversationId}/messages/${messageId}`, {
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${idToken}`,
					},
					body: JSON.stringify({ text: newText }),
				});
			} catch (err: any) {
				console.error("[editMessage error]:", err);
			}
		},
		[conversationId, user]
	);

	// ─── Delete Message (Soft Delete) ──────────────────────────────────────────
	const deleteMessage = useCallback(
		async (messageId: string) => {
			if (!conversationId || !user) return;

			setRawMessages((prev) =>
				prev.map((m) =>
					m.id === messageId
						? {
								...m,
								isDeleted: true,
								deletedAt: Date.now(),
								deletedBy: user.uid,
								text: "This message was deleted",
								attachments: [],
								hasAttachments: false,
						  }
						: m
				)
			);

			try {
				const idToken = await user.getIdToken();
				await fetch(`/api/chat/conversations/${conversationId}/messages/${messageId}`, {
					method: "DELETE",
					headers: {
						Authorization: `Bearer ${idToken}`,
					},
				});
			} catch (err: any) {
				console.error("[deleteMessage error]:", err);
			}
		},
		[conversationId, user]
	);

	// ─── Pin Message ───────────────────────────────────────────────────────────
	const pinMessage = useCallback(
		async (messageId: string) => {
			if (!conversationId || !user) return;

			setRawMessages((prev) =>
				prev.map((m) =>
					m.id === messageId
						? { ...m, isPinned: !m.isPinned, pinnedAt: !m.isPinned ? Date.now() : undefined }
						: m
				)
			);

			try {
				const idToken = await user.getIdToken();
				await fetch(`/api/chat/conversations/${conversationId}/messages/${messageId}/pin`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${idToken}`,
					},
				});
			} catch (err: any) {
				console.error("[pinMessage error]:", err);
			}
		},
		[conversationId, user]
	);

	// ─── Enriched Messages with Real-Time Read Receipts ────────────────────────
	const messages = useMemo(() => {
		const otherUid = participantUids.find((u) => u !== user?.uid);
		const otherReadAt = otherUid ? readPointers[otherUid] || 0 : 0;

		return rawMessages.map((m) => {
			if (m.deliveryStatus === "sending" || m.deliveryStatus === "failed") {
				return m;
			}
			if (m.senderId === user?.uid && otherUid && otherReadAt >= m.createdAt) {
				return { ...m, deliveryStatus: "read" as const };
			}
			return { ...m, deliveryStatus: (m.deliveryStatus || "sent") as "sent" };
		});
	}, [rawMessages, participantUids, readPointers, user?.uid]);

	return {
		messages,
		initialLastReadAt,
		loading,
		loadingOlder,
		hasMoreOlder,
		error,
		sendMessage,
		retryMessage,
		loadOlderMessages,
		markAsRead,
		toggleReaction,
		editMessage,
		deleteMessage,
		pinMessage,
	};
}
