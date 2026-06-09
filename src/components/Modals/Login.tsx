import { authModalState } from "@/atoms/authModalAtom";
import { auth } from "@/firebase/firebase";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { useSignInWithEmailAndPassword, useSignInWithGoogle, useSignInWithGithub } from "react-firebase-hooks/auth";
import { useSetRecoilState } from "recoil";
import { FaGoogle, FaGithub, FaEye, FaEyeSlash, FaSpinner } from "react-icons/fa";
import { translateFirebaseError } from "@/utils/authErrors";

type LoginProps = {};

const Login: React.FC<LoginProps> = () => {
	const setAuthModalState = useSetRecoilState(authModalState);
	const [inputs, setInputs] = useState({ email: "", password: "" });
	const [showPassword, setShowPassword] = useState(false);
	const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
	const [shakeFields, setShakeFields] = useState<{ email?: boolean; password?: boolean }>({});

	const [signInWithEmailAndPassword, user, loading, error] = useSignInWithEmailAndPassword(auth);
	const [signInWithGoogle, googleUser, googleLoading, googleError] = useSignInWithGoogle(auth);
	const [signInWithGithub, githubUser, githubLoading, githubError] = useSignInWithGithub(auth);
	const router = useRouter();

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setInputs((prev) => ({ ...prev, [e.target.name]: e.target.value }));
		setErrors((prev) => ({ ...prev, [e.target.name]: undefined, general: undefined }));
	};

	const validateForm = (): boolean => {
		const nextErrors: typeof errors = {};
		const nextShake: typeof shakeFields = {};
		let isValid = true;

		if (!inputs.email) {
			nextErrors.email = "Email is required.";
			nextShake.email = true;
			isValid = false;
		} else if (!/\S+@\S+\.\S+/.test(inputs.email)) {
			nextErrors.email = "Please enter a valid email address.";
			nextShake.email = true;
			isValid = false;
		}

		if (!inputs.password) {
			nextErrors.password = "Password is required.";
			nextShake.password = true;
			isValid = false;
		} else if (inputs.password.length < 6) {
			nextErrors.password = "Password must be at least 6 characters.";
			nextShake.password = true;
			isValid = false;
		}

		setErrors(nextErrors);
		setShakeFields(nextShake);

		if (!isValid) {
			// Reset shake animation class after 500ms so it can trigger again on subsequent failures
			setTimeout(() => {
				setShakeFields({});
			}, 500);
		}

		return isValid;
	};

	const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!validateForm() || loading || googleLoading || githubLoading) return;
		
		try {
			const newUser = await signInWithEmailAndPassword(inputs.email, inputs.password);
			if (!newUser) return;
			router.push("/");
		} catch (err: any) {
			// Handled by useEffect matching firebase hooks state
		}
	};

	useEffect(() => {
		if (user || googleUser || githubUser) {
			setAuthModalState((prev) => ({ ...prev, isOpen: false }));
			router.push("/");
		}
	}, [user, googleUser, githubUser, router, setAuthModalState]);

	useEffect(() => {
		const firebaseErr = error || googleError || githubError;
		if (firebaseErr) {
			const code = (firebaseErr as any).code || "auth/unknown";
			const msg = translateFirebaseError(code);
			setErrors((prev) => ({ ...prev, general: msg }));
		}
	}, [error, googleError, githubError]);

	const isActionLoading = loading || googleLoading || githubLoading;

	return (
		<form className={`space-y-5 px-4 pb-4 transition-all duration-200 ${isActionLoading ? "opacity-50 pointer-events-none" : ""}`} onSubmit={handleLogin}>
			<div>
				<h3 className='text-xl font-bold text-white tracking-tight'>Sign in to BeastCode</h3>
				<p className='text-xs text-slate-400 mt-1'>Access your high-performance developer workspace.</p>
			</div>

			{/* Social Providers */}
			<div className='grid grid-cols-2 gap-3'>
				<button
					type='button'
					onClick={() => signInWithGoogle()}
					disabled={isActionLoading}
					className='flex items-center justify-center gap-2 bg-[#13141b] border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-slate-200 font-medium py-2.5 px-4 rounded-lg text-xs transition duration-200 disabled:opacity-50'
				>
					<FaGoogle className='text-red-400' size={14} />
					<span>Google</span>
				</button>
				<button
					type='button'
					onClick={() => signInWithGithub()}
					disabled={isActionLoading}
					className='flex items-center justify-center gap-2 bg-[#13141b] border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-slate-200 font-medium py-2.5 px-4 rounded-lg text-xs transition duration-200 disabled:opacity-50'
				>
					<FaGithub size={14} />
					<span>GitHub</span>
				</button>
			</div>

			{/* Divider */}
			<div className='flex items-center gap-3 py-1.5'>
				<div className='flex-1 h-px bg-slate-800' />
				<span className='text-[10px] font-semibold text-slate-500 uppercase tracking-wider'>or continue with email</span>
				<div className='flex-1 h-px bg-slate-800' />
			</div>

			{/* Email input */}
			<div className={shakeFields.email ? "animate-shake" : ""}>
				<label htmlFor='email' className='text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1.5'>
					Your Email
				</label>
				<input
					onChange={handleInputChange}
					value={inputs.email}
					type='email'
					name='email'
					id='email'
					disabled={isActionLoading}
					className={`w-full bg-[#13141b]/90 border ${
						errors.email ? "border-rose-500/50 focus:border-rose-500" : "border-slate-800/80 focus:border-amber-500"
					} rounded-lg py-2.5 px-3.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all duration-200`}
					placeholder='name@company.com'
				/>
				{errors.email && <p className='text-rose-400 text-[10px] mt-1.5 font-medium'>{errors.email}</p>}
			</div>

			{/* Password input */}
			<div className={shakeFields.password ? "animate-shake" : ""}>
				<div className='flex justify-between items-center mb-1.5'>
					<label htmlFor='password' className='text-xs font-semibold uppercase tracking-wider text-slate-400'>
						Your Password
					</label>
					<button
						type='button'
						disabled={isActionLoading}
						onClick={() => setAuthModalState((prev) => ({ ...prev, type: "forgotPassword" }))}
						className='text-xs text-amber-500 hover:text-amber-400 hover:underline focus:outline-none'
					>
						Forgot Password?
					</button>
				</div>
				<div className='relative'>
					<input
						onChange={handleInputChange}
						value={inputs.password}
						type={showPassword ? "text" : "password"}
						name='password'
						id='password'
						disabled={isActionLoading}
						className={`w-full bg-[#13141b]/90 border ${
							errors.password ? "border-rose-500/50 focus:border-rose-500" : "border-slate-800/80 focus:border-amber-500"
						} rounded-lg py-2.5 px-3.5 pr-10 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all duration-200`}
						placeholder='••••••••'
					/>
					<button
						type='button'
						onClick={() => setShowPassword(!showPassword)}
						disabled={isActionLoading}
						className='absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 focus:outline-none'
					>
						{showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
					</button>
				</div>
				{errors.password && <p className='text-rose-400 text-[10px] mt-1.5 font-medium'>{errors.password}</p>}
			</div>

			{errors.general && (
				<div className='p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs font-medium leading-relaxed'>
					{errors.general}
				</div>
			)}

			<button
				type='submit'
				disabled={isActionLoading}
				className='w-full mt-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 text-slate-950 font-semibold py-2.5 px-4 rounded-lg text-xs transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98]'
			>
				{isActionLoading ? (
					<>
						<FaSpinner className='animate-spin' size={14} />
						<span>Configuring Terminal...</span>
					</>
				) : (
					<span>Sign In</span>
				)}
			</button>

			<div className='text-xs text-slate-400 text-center pt-2'>
				Not Registered?{" "}
				<button
					type='button'
					disabled={isActionLoading}
					className='text-amber-500 hover:text-amber-400 hover:underline font-semibold focus:outline-none'
					onClick={() => setAuthModalState((prev) => ({ ...prev, type: "register" }))}
				>
					Create account
				</button>
			</div>
		</form>
	);
};

export default Login;
