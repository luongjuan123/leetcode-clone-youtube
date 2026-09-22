import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/firebase/firebase";
import { signOut } from "firebase/auth";
import { FaBan, FaSignOutAlt, FaEnvelope } from "react-icons/fa";

export default function SuspendedPage() {
	const [user, loading] = useAuthState(auth);
	const router = useRouter();
	const [checking, setChecking] = useState(true);
	const [banDetails, setBanDetails] = useState<{
		reason: string;
		duration: string;
		referenceId: string;
	} | null>(null);

	useEffect(() => {
		if (loading) return;

		if (!user) {
			router.replace("/");
			return;
		}

		const verifyStatus = async () => {
			try {
				const idToken = await user.getIdToken(true);
				const res = await fetch("/api/auth/check-status", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"Authorization": `Bearer ${idToken}`
					}
				});

				if (res.ok) {
					// The user is not banned (or ban expired), send back to home page
					router.replace("/");
				} else if (res.status === 403) {
					const data = await res.json();
					if (data.error && data.error.code === "BANNED") {
						setBanDetails({
							reason: data.error.reason || "Violation of community guidelines",
							duration: data.error.duration || "Permanent",
							referenceId: data.error.referenceId || user.uid.substring(0, 8).toUpperCase()
						});
					} else {
						// Other authorization issues, log out
						await signOut(auth);
						router.replace("/");
					}
					setChecking(false);
				} else {
					// Server error or other, default to generic ban details for safety
					setBanDetails({
						reason: "Violation of community guidelines",
						duration: "Permanent",
						referenceId: user.uid.substring(0, 8).toUpperCase()
					});
					setChecking(false);
				}
			} catch (err) {
				console.error("Error verifying suspension status:", err);
				setChecking(false);
			}
		};

		verifyStatus();
	}, [user, loading, router]);

	const handleLogout = async () => {
		try {
			await signOut(auth);
			router.replace("/");
		} catch (err) {
			console.error("Logout error:", err);
		}
	};

	if (loading || checking) {
		return (
			<div className="min-h-screen bg-dark-layer-2 flex flex-col items-center justify-center text-white">
				<div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-orange mb-4"></div>
				<p className="text-gray-400 text-sm font-mono">Verifying account credentials...</p>
			</div>
		);
	}

	return (
		<div
			className="min-h-screen bg-dark-layer-2 flex items-center justify-center p-4 text-white font-sans"
			style={{
				backgroundImage: `
					radial-gradient(circle at top right, rgba(239, 143, 0, 0.05), transparent 50%),
					linear-gradient(rgba(255,255,255,0.007) 1px, transparent 1px),
					linear-gradient(90deg, rgba(255,255,255,0.007) 1px, transparent 1px)
				`,
				backgroundSize: "auto, 24px 24px, 24px 24px",
			}}
		>
			<div className="w-full max-w-lg bg-dark-layer-1/90 backdrop-blur-xl rounded-xl border border-gray-850 shadow-2xl p-8 relative overflow-hidden">
				{/* Top Red-Orange glow bar */}
				<div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-red-600 to-brand-orange" />

				{/* Header */}
				<div className="flex flex-col items-center text-center mt-4">
					<div className="p-4 bg-red-950/20 border border-red-500/30 text-red-500 rounded-full mb-4 animate-pulse">
						<FaBan size={36} />
					</div>
					<h1 className="text-2xl font-extrabold text-white tracking-tight">Access Suspended</h1>
					<p className="text-sm text-gray-400 mt-2 max-w-md">
						Your account has been flagged and suspended for violating our platform policy.
					</p>
				</div>

				{/* Suspension Details */}
				<div className="mt-8 bg-dark-layer-2/60 border border-gray-850 rounded-lg p-5 space-y-4 font-mono text-xs">
					<div className="flex justify-between items-center py-1.5 border-b border-gray-850/50">
						<span className="text-gray-400 font-bold uppercase tracking-wider">Status</span>
						<span className="text-red-500 font-bold px-2 py-0.5 bg-red-950/30 rounded border border-red-900/40">SUSPENDED</span>
					</div>
					<div className="flex justify-between items-start py-1.5 border-b border-gray-850/50">
						<span className="text-gray-400 font-bold uppercase tracking-wider">Reason</span>
						<span className="text-gray-200 text-right max-w-[240px] break-words font-sans">{banDetails?.reason}</span>
					</div>
					<div className="flex justify-between items-center py-1.5 border-b border-gray-850/50">
						<span className="text-gray-400 font-bold uppercase tracking-wider">Duration</span>
						<span className="text-amber-500 font-bold">{banDetails?.duration}</span>
					</div>
					<div className="flex justify-between items-center py-1.5">
						<span className="text-gray-400 font-bold uppercase tracking-wider">Reference ID</span>
						<span className="text-gray-300 font-bold tracking-widest">{banDetails?.referenceId}</span>
					</div>
				</div>

				{/* Footer Info */}
				<div className="mt-6 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-2">
					<div className="flex items-center gap-2 text-brand-orange hover:underline cursor-pointer">
						<FaEnvelope size={12} />
						<a href="mailto:support@beastcode.codes?subject=Suspension Appeal">
							Contact Support / Appeal Decision
						</a>
					</div>
					<p className="text-[10px] text-gray-500 mt-1">
						Please quote your Reference ID in any correspondence.
					</p>
				</div>

				{/* Actions */}
				<div className="mt-8 flex justify-center border-t border-gray-850/60 pt-6">
					<button
						onClick={handleLogout}
						className="flex items-center gap-2 px-6 py-2.5 bg-dark-layer-2 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white rounded-lg transition duration-200 text-xs font-semibold"
					>
						<FaSignOutAlt size={14} />
						Logout & Switch Account
					</button>
				</div>
			</div>
		</div>
	);
}
