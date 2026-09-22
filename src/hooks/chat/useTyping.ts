import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, firestore } from "@/firebase/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { TypingState } from "@/types/chat";

export function useTyping(conversationId: string | null) {
	const [user] = useAuthState(auth);
	const [typingUsers, setTypingUsers] = useState<TypingState[]>([]);
	const lastSentTypingRef = useRef<number>(0);

	// Real-time listener for typing users
	useEffect(() => {
		if (!conversationId || !user) {
			setTypingUsers([]);
			return;
		}

		const typingCol = collection(firestore, "conversations", conversationId, "typing");
		const unsub = onSnapshot(
			typingCol,
			(snap) => {
				const now = Date.now();
				const active: TypingState[] = [];
				snap.forEach((doc) => {
					if (doc.id !== user.uid) {
						const data = doc.data() as TypingState;
						if (data.expiresAt && data.expiresAt > now) {
							active.push(data);
						}
					}
				});
				setTypingUsers(active);
			},
			(err) => {
				console.warn("[useTyping onSnapshot warning]:", err.message);
			}
		);

		return () => unsub();
	}, [conversationId, user]);

	// Active sweep timer every 1000ms to clear expired typers even without new Firestore writes
	useEffect(() => {
		if (typingUsers.length === 0) return;

		const interval = setInterval(() => {
			const now = Date.now();
			setTypingUsers((prev) => {
				const filtered = prev.filter((t) => t.expiresAt && t.expiresAt > now);
				return filtered.length === prev.length ? prev : filtered;
			});
		}, 1000);

		return () => clearInterval(interval);
	}, [typingUsers.length]);

	// Send throttled typing heartbeat (max once every 3000ms)
	const sendTypingHeartbeat = useCallback(async () => {
		if (!conversationId || !user) return;
		const now = Date.now();
		if (now - lastSentTypingRef.current < 3000) return;

		lastSentTypingRef.current = now;
		try {
			const idToken = await user.getIdToken();
			await fetch(`/api/chat/conversations/${conversationId}/typing`, {
				method: "POST",
				headers: { Authorization: `Bearer ${idToken}` },
			});
		} catch (err: any) {
			console.warn("[sendTypingHeartbeat error]:", err.message);
		}
	}, [conversationId, user]);

	// Clear typing indicator immediately (e.g. on message submit or blur)
	const clearTyping = useCallback(async () => {
		if (!conversationId || !user) return;
		lastSentTypingRef.current = 0;
		try {
			const idToken = await user.getIdToken();
			await fetch(`/api/chat/conversations/${conversationId}/typing`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${idToken}` },
			});
		} catch (err: any) {
			console.warn("[clearTyping error]:", err.message);
		}
	}, [conversationId, user]);

	return {
		typingUsers,
		sendTypingHeartbeat,
		clearTyping,
	};
}
