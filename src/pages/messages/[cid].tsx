import React from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuthState } from "react-firebase-hooks/auth";
import { useSetRecoilState } from "recoil";
import { authModalState } from "@/atoms/authModalAtom";
import { auth } from "@/firebase/firebase";
import Topbar from "@/components/Topbar/Topbar";
import { ChatShell } from "@/components/Chat/ChatShell";

export default function ConversationDetailPage() {
	const router = useRouter();
	const { cid } = router.query;
	const [user, loading] = useAuthState(auth);
	const setAuthModal = useSetRecoilState(authModalState);

	if (loading) {
		return (
			<div className="min-h-screen bg-dark-layer-2 flex flex-col">
				<Topbar />
				<div className="flex-1 flex items-center justify-center">
					<div className="w-8 h-8 border-3 border-brand-orange border-t-transparent rounded-full animate-spin"></div>
				</div>
			</div>
		);
	}

	if (!user) {
		return (
			<div className="min-h-screen bg-dark-layer-2 flex flex-col">
				<Topbar />
				<div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
					<div className="w-16 h-16 rounded-3xl bg-dark-fill-3 border border-border-default flex items-center justify-center text-2xl mb-4 text-brand-orange">
						💬
					</div>
					<h1 className="text-xl font-bold text-text-primary mb-2">BeastCode Messages</h1>
					<p className="text-xs text-text-muted max-w-sm mb-6">
						Please sign in to your BeastCode account to access direct messages and organization channels.
					</p>
					<button
						type="button"
						onClick={() => setAuthModal((prev) => ({ ...prev, isOpen: true, type: "login" }))}
						className="px-6 py-2.5 rounded-xl bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold transition shadow-lg shadow-brand-orange/20"
					>
						Sign In
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-dark-layer-2 flex flex-col overflow-hidden">
			<Head>
				<title>Messages | BeastCode</title>
				<meta name="description" content="Real-time messaging for coders and organizations on BeastCode." />
			</Head>

			<Topbar />
			<main className="flex-1 overflow-hidden">
				<ChatShell initialConversationId={cid as string} />
			</main>
		</div>
	);
}
