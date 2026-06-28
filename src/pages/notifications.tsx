import React from "react";
import Topbar from "@/components/Topbar/Topbar";
import useHasMounted from "@/hooks/useHasMounted";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/firebase/firebase";
import NotificationCenter from "@/components/Notification/NotificationCenter";

export default function NotificationsPage() {
	const hasMounted = useHasMounted();
	const [user] = useAuthState(auth);

	if (!hasMounted) return null;

	return (
		<main className="bg-dark-layer-2 min-h-screen pb-20">
			<Topbar />
			{!user ? (
				<div className="max-w-[760px] mx-auto px-4 mt-8">
					<div
						className="text-center py-16 rounded-2xl p-6"
						style={{ background: "var(--bg-dark-layer-1)", border: "1px solid var(--border-subtle)" }}
					>
						<p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
							Please sign in to access your notification workspace.
						</p>
					</div>
				</div>
			) : (
				<NotificationCenter />
			)}
		</main>
	);
}
