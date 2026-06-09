import React, { useState, useEffect } from "react";
import { auth, firestore } from "@/firebase/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { sendEmailVerification, signOut, updateEmail } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { FaEnvelopeOpenText, FaSync, FaSignOutAlt, FaPaperPlane, FaPen, FaArrowLeft, FaSpinner } from "react-icons/fa";
import { translateFirebaseError } from "@/utils/authErrors";

interface EmailVerificationModalProps {
	isOpen: boolean;
	onClose: () => void;
}

const EmailVerificationModal: React.FC<EmailVerificationModalProps> = ({ isOpen, onClose }) => {
	const [user] = useAuthState(auth);
	const [resending, setResending] = useState(false);
	const [checking, setChecking] = useState(false);
	const [isEditingEmail, setIsEditingEmail] = useState(false);
	const [newEmail, setNewEmail] = useState("");
	const [updatingEmail, setUpdatingEmail] = useState(false);
	
	// Cooldown and local message boxes
	const [cooldown, setCooldown] = useState(0);
	const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

	useEffect(() => {
		if (user?.email) {
			setNewEmail(user.email);
		}
	}, [user?.email]);

	useEffect(() => {
		if (cooldown === 0) return;
		const interval = setInterval(() => {
			setCooldown((prev) => prev - 1);
		}, 1000);
		return () => clearInterval(interval);
	}, [cooldown]);

	if (!isOpen || !user) return null;

	const handleResend = async () => {
		if (cooldown > 0 || resending) return;
		setResending(true);
		setFeedback(null);
		try {
			await sendEmailVerification(user);
			setFeedback({
				type: "success",
				text: "Verification link successfully dispatched! Please check your inbox and spam folder.",
			});
			setCooldown(60);
		} catch (error: any) {
			console.error("Error sending verification email:", error);
			const msg = translateFirebaseError(error.code || "auth/unknown");
			setFeedback({ type: "error", text: msg });
		} finally {
			setResending(false);
		}
	};

	const handleCheckStatus = async () => {
		setChecking(true);
		setFeedback(null);
		try {
			if (auth.currentUser) {
				await auth.currentUser.reload();
				if (auth.currentUser.emailVerified) {
					onClose();
				} else {
					setFeedback({
						type: "info",
						text: "Email is not verified yet. Please click the link we sent to your address, then try again.",
					});
				}
			}
		} catch (error: any) {
			console.error("Error reloading user status:", error);
			setFeedback({ type: "error", text: "Failed to reload user status. Please try again." });
		} finally {
			setChecking(false);
		}
	};

	const handleUpdateEmail = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newEmail.trim() || newEmail.trim() === user.email) {
			setIsEditingEmail(false);
			return;
		}

		setUpdatingEmail(true);
		setFeedback(null);
		try {
			await updateEmail(user, newEmail.trim());

			const userRef = doc(firestore, "users", user.uid);
			await updateDoc(userRef, {
				email: newEmail.trim(),
				updatedAt: Date.now(),
			});

			await sendEmailVerification(user);
			setFeedback({
				type: "success",
				text: "Email updated successfully. Verification link has been dispatched to your new address.",
			});
			setCooldown(60);
			setIsEditingEmail(false);
		} catch (error: any) {
			console.error("Error updating email:", error);
			if (error.code === "auth/requires-recent-login") {
				setFeedback({
					type: "error",
					text: "Re-authentication required. Please log out, sign in again, and update your email.",
				});
			} else {
				const msg = translateFirebaseError(error.code);
				setFeedback({ type: "error", text: msg });
			}
		} finally {
			setUpdatingEmail(false);
		}
	};

	const handleLogout = async () => {
		try {
			await signOut(auth);
		} catch (error: any) {
			console.error("Logout failed:", error);
		}
	};

	return (
		<div className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4'>
			<div className='bg-[#0D0E12] border border-slate-800 rounded-2xl w-full max-w-md p-8 shadow-2xl relative animate-fade-in my-auto text-center'>
				{isEditingEmail ? (
					<form onSubmit={handleUpdateEmail} className='space-y-4 mb-6 text-left'>
						<div className='text-center mb-4'>
							<h2 className='text-lg font-bold text-white'>Update Email address</h2>
							<p className='text-xs text-slate-400 mt-1'>
								Enter your new email address. We will dispatch a verification link to it.
							</p>
						</div>
						<div>
							<label className='text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5'>New Email Address</label>
							<input
								type='email'
								value={newEmail}
								onChange={(e) => setNewEmail(e.target.value)}
								required
								disabled={updatingEmail}
								className='w-full bg-[#13141b] text-xs text-white placeholder-slate-600 border border-slate-800 rounded-xl py-3 px-4 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition'
								placeholder='Enter new email'
							/>
						</div>
						<div className='flex gap-3 pt-2'>
							<button
								type='submit'
								disabled={updatingEmail}
								className='flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50'
							>
								{updatingEmail ? (
									<FaSpinner className='animate-spin' size={14} />
								) : (
									<span>Save & Resend</span>
								)}
							</button>
							<button
								type='button'
								onClick={() => {
									setIsEditingEmail(false);
									setNewEmail(user.email || "");
									setFeedback(null);
								}}
								disabled={updatingEmail}
								className='flex-1 bg-slate-900 hover:bg-slate-850 text-slate-300 py-2.5 rounded-lg text-xs font-bold transition border border-slate-800'
							>
								Cancel
							</button>
						</div>
					</form>
				) : (
					<div className='flex flex-col items-center mb-6'>
						<div className='bg-amber-500/10 p-4 rounded-full text-amber-500 mb-4 border border-amber-500/20 relative animate-pulse'>
							<FaEnvelopeOpenText size={32} />
						</div>
						<h2 className='text-xl font-bold text-white'>Verify Your Identity</h2>
						<p className='text-xs text-slate-400 mt-2 px-4 leading-relaxed'>
							We have dispatched a verification email to <span className='text-amber-500 font-semibold font-mono'>{user.email}</span>.
							Please click the link inside it to proceed.
						</p>
						<button
							onClick={() => {
								setIsEditingEmail(true);
								setFeedback(null);
							}}
							className='mt-3.5 text-xs text-amber-500 hover:text-amber-400 font-semibold transition flex items-center gap-1.5 focus:outline-none'
						>
							<FaPen size={10} />
							<span>Change email address</span>
						</button>
					</div>
				)}

				{feedback && (
					<div className={`mb-5 p-3 rounded-lg text-xs font-medium leading-relaxed border ${
						feedback.type === "success" 
							? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
							: feedback.type === "error" 
								? "bg-rose-500/10 border-rose-500/20 text-rose-400" 
								: "bg-amber-500/10 border-amber-500/20 text-amber-400"
					}`}>
						{feedback.text}
					</div>
				)}

				<div className='space-y-3'>
					<button
						onClick={handleCheckStatus}
						disabled={checking || isEditingEmail}
						className='w-full bg-amber-500 hover:bg-amber-600 text-slate-950 py-2.5 rounded-lg text-xs font-bold transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]'
					>
						{checking ? (
							<FaSpinner className='animate-spin' size={14} />
						) : (
							<FaSync size={12} className={checking ? "animate-spin" : ""} />
						)}
						<span>I have verified my email</span>
					</button>

					<button
						onClick={handleResend}
						disabled={resending || cooldown > 0 || isEditingEmail}
						className='w-full bg-[#13141b] hover:bg-slate-850 text-slate-300 py-2.5 rounded-lg text-xs font-bold transition border border-slate-800 flex items-center justify-center gap-2 disabled:opacity-50'
					>
						{resending ? (
							<FaSpinner className='animate-spin' size={14} />
						) : cooldown > 0 ? (
							<span>Resend in {cooldown}s</span>
						) : (
							<>
								<FaPaperPlane size={11} />
								<span>Resend Verification Email</span>
							</>
						)}
					</button>

					<div className='pt-4 border-t border-slate-800/80 mt-4'>
						<button
							onClick={handleLogout}
							className='text-xs text-slate-500 hover:text-rose-400 font-semibold transition flex items-center justify-center gap-1.5 mx-auto focus:outline-none'
						>
							<FaSignOutAlt size={12} />
							<span>Log Out</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default EmailVerificationModal;
