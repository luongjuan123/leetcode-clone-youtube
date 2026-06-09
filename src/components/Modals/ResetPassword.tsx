import { authModalState } from "@/atoms/authModalAtom";
import { auth } from "@/firebase/firebase";
import React, { useState, useEffect } from "react";
import { useSendPasswordResetEmail } from "react-firebase-hooks/auth";
import { useSetRecoilState } from "recoil";
import { FaSpinner, FaArrowLeft } from "react-icons/fa";
import { translateFirebaseError } from "@/utils/authErrors";

type ResetPasswordProps = {};

const ResetPassword: React.FC<ResetPasswordProps> = () => {
	const setAuthModalState = useSetRecoilState(authModalState);
	const [email, setEmail] = useState("");
	const [successMsg, setSuccessMsg] = useState("");
	const [errors, setErrors] = useState<{ email?: string; general?: string }>({});
	const [shake, setShake] = useState(false);

	const [sendPasswordResetEmail, sending, error] = useSendPasswordResetEmail(auth);

	const validateForm = (): boolean => {
		if (!email) {
			setErrors({ email: "Email is required." });
			setShake(true);
			setTimeout(() => setShake(false), 500);
			return false;
		}
		if (!/\S+@\S+\.\S+/.test(email)) {
			setErrors({ email: "Please enter a valid email address." });
			setShake(true);
			setTimeout(() => setShake(false), 500);
			return false;
		}
		return true;
	};

	const handleReset = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!validateForm() || sending) return;

		setSuccessMsg("");
		setErrors({});

		try {
			const success = await sendPasswordResetEmail(email);
			if (success) {
				setSuccessMsg("Reset link successfully sent. Please check your inbox.");
			}
		} catch (err: any) {
			// Handled by useEffect matching firebase hooks state
		}
	};

	useEffect(() => {
		if (error) {
			const code = (error as any).code || "auth/unknown";
			const msg = translateFirebaseError(code);
			setErrors({ general: msg });
		}
	}, [error]);

	return (
		<form className={`space-y-5 px-4 pb-4 transition-all duration-200 ${sending ? "opacity-50 pointer-events-none" : ""}`} onSubmit={handleReset}>
			<div>
				<h3 className='text-xl font-bold text-white tracking-tight'>Reset Password</h3>
				<p className='text-xs text-slate-400 mt-1'>
					Enter your email address below, and we will send a password reset link to your inbox.
				</p>
			</div>

			<div className={shake ? "animate-shake" : ""}>
				<label htmlFor='email' className='text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1.5'>
					Your email
				</label>
				<input
					type='email'
					name='email'
					onChange={(e) => {
						setEmail(e.target.value);
						setErrors({});
						setSuccessMsg("");
					}}
					id='email'
					disabled={sending}
					className={`w-full bg-[#13141b]/90 border ${
						errors.email ? "border-rose-500/50 focus:border-rose-500" : "border-slate-800/80 focus:border-amber-500"
					} rounded-lg py-2.5 px-3.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all duration-200`}
					placeholder='name@company.com'
				/>
				{errors.email && <p className='text-rose-400 text-[10px] mt-1.5 font-medium'>{errors.email}</p>}
			</div>

			{errors.general && (
				<div className='p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs font-medium leading-relaxed'>
					{errors.general}
				</div>
			)}

			{successMsg && (
				<div className='p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs font-medium leading-relaxed'>
					{successMsg}
				</div>
			)}

			<button
				type='submit'
				disabled={sending}
				className='w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 text-slate-950 font-semibold py-2.5 px-4 rounded-lg text-xs transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98]'
			>
				{sending ? (
					<>
						<FaSpinner className='animate-spin' size={14} />
						<span>Sending Link...</span>
					</>
				) : (
					<span>Reset Password</span>
				)}
			</button>

			<div className='text-center pt-1'>
				<button
					type='button'
					disabled={sending}
					onClick={() => setAuthModalState((prev) => ({ ...prev, type: "login" }))}
					className='text-xs text-slate-500 hover:text-slate-300 flex items-center justify-center gap-1.5 mx-auto transition duration-150 focus:outline-none'
				>
					<FaArrowLeft size={10} />
					<span>Back to Sign In</span>
				</button>
			</div>
		</form>
	);
};

export default ResetPassword;
