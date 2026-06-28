import React, { useEffect, useState } from "react";
import { auth, firestore } from "@/firebase/firebase";
import { doc, getDoc, setDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { FaGraduationCap, FaSpinner, FaChevronRight, FaChevronLeft, FaCheck, FaCheckCircle, FaLaptopCode, FaRocket, FaUser } from "react-icons/fa";

interface ProfileSetupModalProps {
	isOpen: boolean;
	onClose: () => void;
}

// Procedural SVG avatar data URL generator
const generateAvatarDataUrl = (letter: string, bg: string, text: string) => {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
		<rect width="100" height="100" fill="${encodeURIComponent(bg)}"/>
		<text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, sans-serif" font-size="45" font-weight="bold" fill="${encodeURIComponent(text)}">${letter}</text>
	</svg>`;
	return `data:image/svg+xml;utf8,${svg}`;
};

const AVATAR_OPTIONS = [
	{ id: "amber", label: "Alpha Amber", value: generateAvatarDataUrl("A", "#2d1f10", "#f59e0b"), color: "#f59e0b" },
	{ id: "emerald", label: "Beta Emerald", value: generateAvatarDataUrl("E", "#0c2c1c", "#10b981"), color: "#10b981" },
	{ id: "sapphire", label: "Gamma Sapphire", value: generateAvatarDataUrl("S", "#0f1b3c", "#3b82f6"), color: "#3b82f6" },
	{ id: "crimson", label: "Delta Crimson", value: generateAvatarDataUrl("C", "#330a15", "#f43f5e"), color: "#f43f5e" },
];

const ProfileSetupModal: React.FC<ProfileSetupModalProps> = ({ isOpen, onClose }) => {
	const [user] = useAuthState(auth);
	const [step, setStep] = useState(1);

	// Form inputs
	const [username, setUsername] = useState("");
	const [avatarUrl, setAvatarUrl] = useState(AVATAR_OPTIONS[0].value);
	const [displayName, setDisplayName] = useState("");
	const [studentId, setStudentId] = useState("");
	const [school, setSchool] = useState("BeastCode University");
	const [faculty, setFaculty] = useState("");
	const [className, setClassName] = useState("");
	const [showStudentInfo, setShowStudentInfo] = useState(true);
	const [experienceLevel, setExperienceLevel] = useState<"beginner" | "intermediate" | "advanced" | null>(null);

	// Availability and validation state
	const [isValidatingUsername, setIsValidatingUsername] = useState(false);
	const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
	const [errors, setErrors] = useState<{ step1?: string; step2?: string; step3?: string }>({});
	const [submitting, setSubmitting] = useState(false);

	// Load existing fields if user doc exists
	useEffect(() => {
		if (!user || !isOpen) return;
		const loadExisting = async () => {
			try {
				const userRef = doc(firestore, "users", user.uid);
				const userSnap = await getDoc(userRef);
				if (userSnap.exists()) {
					const data = userSnap.data();
					setDisplayName(data.displayName || user.displayName || "");
					setUsername(data.username || "");
					setStudentId(data.studentId || "");
					setSchool(data.school || "BeastCode University");
					setFaculty(data.faculty || "");
					setClassName(data.class || "");
					setExperienceLevel(data.experienceLevel || null);
					setAvatarUrl(data.avatarUrl || data.avatar || AVATAR_OPTIONS[0].value);
					setShowStudentInfo(data.showStudentInfo !== false);
					
					if (data.username) {
						setIsUsernameAvailable(true);
					}
				} else {
					setDisplayName(user.displayName || "");
				}
			} catch (e) {
				console.error("Error loading user profile in setup modal:", e);
			}
		};
		loadExisting();
	}, [user, isOpen]);

	// Live username availability checker
	useEffect(() => {
		if (!username.trim()) {
			setIsUsernameAvailable(null);
			return;
		}
		
		// Basic format validation
		const regex = /^[a-zA-Z0-9_]{3,15}$/;
		if (!regex.test(username)) {
			setIsUsernameAvailable(false);
			setErrors((prev) => ({ ...prev, step1: "Username must be 3-15 characters, alphanumeric/underscores." }));
			return;
		} else {
			setErrors((prev) => ({ ...prev, step1: undefined }));
		}

		const checkUsername = async () => {
			setIsValidatingUsername(true);
			try {
				// Query collection to see if any user has this username
				const q = query(
					collection(firestore, "users"),
					where("username", "==", username.trim().toLowerCase()),
					limit(1)
				);
				const snap = await getDocs(q);
				
				// Verify if the owner is someone else (or if it's currently free)
				if (snap.empty) {
					setIsUsernameAvailable(true);
				} else {
					const existingUserDoc = snap.docs[0];
					if (user && existingUserDoc.id === user.uid) {
						setIsUsernameAvailable(true);
					} else {
						setIsUsernameAvailable(false);
					}
				}
			} catch (err) {
				console.error("Failed to query username:", err);
				setIsUsernameAvailable(false);
			} finally {
				setIsValidatingUsername(false);
			}
		};

		const delayDebounce = setTimeout(() => {
			checkUsername();
		}, 500);

		return () => clearTimeout(delayDebounce);
	}, [username, user]);

	if (!isOpen || !user) return null;

	const handleStep1Next = () => {
		if (!username.trim() || isUsernameAvailable !== true) return;
		setStep(2);
	};

	const handleStep2Next = () => {
		if (
			!displayName.trim() ||
			!studentId.trim() ||
			!school.trim() ||
			!faculty.trim() ||
			!className.trim()
		) {
			setErrors((prev) => ({ ...prev, step2: "Please fill in all mandatory fields." }));
			return;
		}
		setErrors((prev) => ({ ...prev, step2: undefined }));
		setStep(3);
	};

	const handleSubmit = async () => {
		if (!experienceLevel || submitting) return;

		setSubmitting(true);
		setErrors((prev) => ({ ...prev, step3: undefined }));
		try {
			const userRef = doc(firestore, "users", user.uid);
			await setDoc(
				userRef,
				{
					username: username.trim().toLowerCase(),
					avatarUrl: avatarUrl,
					displayName: displayName.trim(),
					studentId: studentId.trim(),
					school: school.trim(),
					faculty: faculty.trim(),
					class: className.trim(),
					showStudentInfo,
					experienceLevel,
					isOnboarded: true,
					email: user.email,
					usernameLastChangedAt: Date.now(),
					updatedAt: Date.now(),
				},
				{ merge: true }
			);
			onClose();
		} catch (error: any) {
			console.error("Error setting up profile:", error);
			setErrors((prev) => ({ ...prev, step3: "Failed to finalize profile. Please try again." }));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
			<div className="bc-modal-shell rounded-2xl w-full max-w-lg p-8 shadow-2xl relative animate-fade-in my-auto">
				
				{/* Step indicator header */}
				<div className="flex items-center justify-between border-b border-gray-850 pb-5 mb-6">
					<div className="flex items-center gap-3">
						<div className="bg-brand-orange/10 p-2.5 rounded-xl text-brand-orange shrink-0 border border-brand-orange/20">
							<FaGraduationCap size={20} />
						</div>
						<div>
							<h2 className="text-md font-bold text-dark-gray-8">Initialize Environment</h2>
							<p className="text-xs text-dark-gray-7 mt-0.5">Configure your developer profile.</p>
						</div>
					</div>
					<div className="flex items-center gap-1.5">
						<span className={`w-6 h-1 rounded-full ${step >= 1 ? "bg-brand-orange" : "bg-gray-850"}`} />
						<span className={`w-6 h-1 rounded-full ${step >= 2 ? "bg-brand-orange" : "bg-gray-850"}`} />
						<span className={`w-6 h-1 rounded-full ${step >= 3 ? "bg-brand-orange" : "bg-gray-850"}`} />
					</div>
				</div>

				{/* STEP 1: Choose Username & Avatar */}
				{step === 1 && (
					<div className="space-y-6">
						{/* Username Input */}
						<div>
							<label className="text-xs font-semibold text-dark-gray-7 uppercase tracking-wider block mb-2">
								Choose Username
							</label>
							<div className="relative">
								<input
									type="text"
									value={username}
									onChange={(e) => setUsername(e.target.value)}
									placeholder="syntax_beast"
									className="w-full bc-input-shell rounded-xl p-3.5 text-xs placeholder:text-bc-muted transition pr-10"
								/>
								<div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center">
									{isValidatingUsername && (
										<FaSpinner className="animate-spin text-brand-orange" size={14} />
									)}
									{!isValidatingUsername && isUsernameAvailable === true && (
										<FaCheckCircle className="text-bc-success" size={15} />
									)}
									{!isValidatingUsername && isUsernameAvailable === false && (
										<span className="w-2 h-2 rounded-full bg-bc-error" />
									)}
								</div>
							</div>
							{isUsernameAvailable === false && (
								<p className="text-bc-error text-xs mt-1.5 font-medium">
									{errors.step1 || "This username is unavailable."}
								</p>
							)}
							{isUsernameAvailable === true && (
								<p className="text-bc-success text-[10px] mt-1.5 font-medium">Username is available.</p>
							)}
						</div>

						{/* Avatar Selector */}
						<div>
							<label className="text-xs font-semibold text-dark-gray-7 uppercase tracking-wider block mb-2.5">
								Select Core Avatar
							</label>
							<div className="grid grid-cols-4 gap-3">
								{AVATAR_OPTIONS.map((opt) => (
									<button
										key={opt.id}
										type="button"
										onClick={() => setAvatarUrl(opt.value)}
										className={`aspect-square rounded-xl border bg-dark-surface/80 flex flex-col items-center justify-center p-2.5 transition-all hover:scale-105 active:scale-95 ${
											avatarUrl === opt.value
												? "border-brand-orange ring-2 ring-brand-orange/10"
												: "border-gray-850 hover:border-dark-hover"
										}`}
									>
										<img
											src={opt.value}
											alt={opt.label}
											className="w-12 h-12 rounded-full object-cover border"
											style={{ borderColor: opt.color }}
										/>
									</button>
								))}
							</div>
						</div>

						{/* Footer Actions */}
						<div className="flex justify-end pt-4 border-t border-gray-850">
							<button
								type="button"
								onClick={handleStep1Next}
								disabled={!username.trim() || isUsernameAvailable !== true || isValidatingUsername}
								className="bc-btn-brand disabled:opacity-40 font-bold px-5 py-2.5 rounded-lg text-xs flex items-center gap-1.5 transition"
							>
								<span>Academic Profile</span>
								<FaChevronRight size={10} />
							</button>
						</div>
					</div>
				)}

				{/* STEP 2: Academic Profile */}
				{step === 2 && (
					<div className="space-y-4">
						<div>
							<label className="text-xs font-semibold text-dark-gray-7 uppercase tracking-wider block mb-1.5">
								Full Display Name <span className="text-bc-error">*</span>
							</label>
							<input
								type="text"
								value={displayName}
								onChange={(e) => setDisplayName(e.target.value)}
								placeholder="Nguyen Van A"
								className="w-full bc-input-shell rounded-xl p-3 text-xs placeholder:text-bc-muted transition"
								required
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="text-xs font-semibold text-dark-gray-7 uppercase tracking-wider block mb-1.5">
									Student ID Code <span className="text-bc-error">*</span>
								</label>
								<input
									type="text"
									value={studentId}
									onChange={(e) => setStudentId(e.target.value)}
									placeholder="e.g. 22010234"
									className="w-full bc-input-shell rounded-xl p-3 text-xs placeholder:text-bc-muted font-mono transition"
									required
								/>
							</div>

							<div>
								<label className="text-xs font-semibold text-dark-gray-7 uppercase tracking-wider block mb-1.5">
									Class / Cohort <span className="text-bc-error">*</span>
								</label>
								<input
									type="text"
									value={className}
									onChange={(e) => setClassName(e.target.value)}
									placeholder="e.g. CSE-2026"
									className="w-full bc-input-shell rounded-xl p-3 text-xs placeholder:text-bc-muted transition"
									required
								/>
							</div>
						</div>

						<div>
							<label className="text-xs font-semibold text-dark-gray-7 uppercase tracking-wider block mb-1.5">
								School / University <span className="text-bc-error">*</span>
							</label>
							<input
								type="text"
								value={school}
								onChange={(e) => setSchool(e.target.value)}
								placeholder="BeastCode University"
								className="w-full bc-input-shell rounded-xl p-3 text-xs placeholder:text-bc-muted transition"
								required
							/>
						</div>

						<div>
							<label className="text-xs font-semibold text-dark-gray-7 uppercase tracking-wider block mb-1.5">
								Faculty / Department <span className="text-bc-error">*</span>
							</label>
							<input
								type="text"
								value={faculty}
								onChange={(e) => setFaculty(e.target.value)}
								placeholder="e.g. Computer Science & Engineering"
								className="w-full bc-input-shell rounded-xl p-3 text-xs placeholder:text-bc-muted transition"
								required
							/>
						</div>

						<div className="flex items-center justify-between p-4 border border-gray-850 rounded-xl bg-dark-surface/40 mt-2">
							<div>
								<label className="text-xs font-semibold block text-dark-gray-8">
									Public Information
								</label>
								<p className="text-[10px] text-bc-muted mt-0.5">
									Permit public viewing of student details on leaderboard.
								</p>
							</div>
							<button
								type="button"
								onClick={() => setShowStudentInfo(!showStudentInfo)}
								className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
									showStudentInfo ? "bg-brand-orange" : "bg-gray-750"
								}`}
							>
								<span
									className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-dark-layer-2 shadow ring-0 transition duration-200 ease-in-out ${
										showStudentInfo ? "translate-x-5" : "translate-x-0"
									}`}
								/>
							</button>
						</div>

						{errors.step2 && (
							<div className="p-3 bg-bc-error/10 border border-bc-error/20 rounded-lg text-bc-error text-xs font-medium">
								{errors.step2}
							</div>
						)}

						{/* Footer Actions */}
						<div className="flex justify-between pt-4 border-t border-gray-850 mt-4">
							<button
								type="button"
								onClick={() => setStep(1)}
								className="bc-btn-ghost font-bold px-4 py-2.5 rounded-lg text-xs flex items-center gap-1.5 transition"
							>
								<FaChevronLeft size={10} />
								<span>Back</span>
							</button>
							<button
								type="button"
								onClick={handleStep2Next}
								className="bc-btn-brand font-bold px-5 py-2.5 rounded-lg text-xs flex items-center gap-1.5 transition"
							>
								<span>Choose Level</span>
								<FaChevronRight size={10} />
							</button>
						</div>
					</div>
				)}

				{/* STEP 3: Experience Level Selection */}
				{step === 3 && (
					<div className="space-y-5">
						<label className="text-xs font-semibold text-dark-gray-7 uppercase tracking-wider block">
							Select Experience Tier
						</label>
						
						<div className="space-y-3">
							{/* Beginner Card */}
							<button
								type="button"
								onClick={() => setExperienceLevel("beginner")}
								className={`w-full text-left p-4 rounded-xl border bg-dark-surface transition-all flex items-center justify-between group ${
									experienceLevel === "beginner"
										? "border-brand-orange ring-2 ring-brand-orange/10"
										: "border-gray-850 hover:border-dark-hover"
								}`}
							>
								<div className="flex items-center gap-3">
									<div className="p-2 bg-bc-success/10 rounded-md text-bc-success border border-bc-success/10">
										<FaUser size={16} />
									</div>
									<div>
										<h4 className="text-xs font-bold text-dark-gray-8 group-hover:text-brand-orange transition-colors">Beginner</h4>
										<p className="text-[10px] text-dark-gray-7 mt-0.5">Focusing on fundamentals, loops, arrays & basic logic</p>
									</div>
								</div>
								{experienceLevel === "beginner" && <FaCheck className="text-brand-orange" size={12} />}
							</button>

							{/* Intermediate Card */}
							<button
								type="button"
								onClick={() => setExperienceLevel("intermediate")}
								className={`w-full text-left p-4 rounded-xl border bg-dark-surface transition-all flex items-center justify-between group ${
									experienceLevel === "intermediate"
										? "border-brand-orange ring-2 ring-brand-orange/10"
										: "border-gray-850 hover:border-dark-hover"
								}`}
							>
								<div className="flex items-center gap-3">
									<div className="p-2 bg-bc-info/10 rounded-md text-bc-info border border-bc-info/10">
										<FaLaptopCode size={16} />
									</div>
									<div>
										<h4 className="text-xs font-bold text-dark-gray-8 group-hover:text-brand-orange transition-colors">Intermediate</h4>
										<p className="text-[10px] text-dark-gray-7 mt-0.5">Focusing on standard Data Structures, DP & trees</p>
									</div>
								</div>
								{experienceLevel === "intermediate" && <FaCheck className="text-brand-orange" size={12} />}
							</button>

							{/* Advanced Card */}
							<button
								type="button"
								onClick={() => setExperienceLevel("advanced")}
								className={`w-full text-left p-4 rounded-xl border bg-dark-surface transition-all flex items-center justify-between group ${
									experienceLevel === "advanced"
										? "border-brand-orange ring-2 ring-brand-orange/10"
										: "border-gray-850 hover:border-dark-hover"
								}`}
							>
								<div className="flex items-center gap-3">
									<div className="p-2 bg-bc-error/10 rounded-md text-bc-error border border-bc-error/10">
										<FaRocket size={16} />
									</div>
									<div>
										<h4 className="text-xs font-bold text-dark-gray-8 group-hover:text-brand-orange transition-colors">Advanced</h4>
										<p className="text-[10px] text-dark-gray-7 mt-0.5">Focusing on competitive math, graphs & performance algorithms</p>
									</div>
								</div>
								{experienceLevel === "advanced" && <FaCheck className="text-brand-orange" size={12} />}
							</button>
						</div>

						{errors.step3 && (
							<div className="p-3 bg-bc-error/10 border border-bc-error/20 rounded-lg text-bc-error text-xs font-medium">
								{errors.step3}
							</div>
						)}

						{/* Footer Actions */}
						<div className="flex justify-between pt-4 border-t border-gray-850 mt-4">
							<button
								type="button"
								disabled={submitting}
								onClick={() => setStep(2)}
								className="bc-btn-ghost font-bold px-4 py-2.5 rounded-lg text-xs flex items-center gap-1.5 transition disabled:opacity-50"
							>
								<FaChevronLeft size={10} />
								<span>Back</span>
							</button>
							<button
								type="button"
								onClick={handleSubmit}
								disabled={!experienceLevel || submitting}
								className="bc-btn-brand disabled:opacity-40 font-bold px-5 py-2.5 rounded-lg text-xs flex items-center gap-1.5 transition"
							>
								{submitting ? (
									<>
										<FaSpinner className="animate-spin" size={12} />
										<span>Saving Profile...</span>
									</>
								) : (
									<span>Finalize Workspace</span>
								)}
							</button>
						</div>
					</div>
				)}

			</div>
		</div>
	);
};

export default ProfileSetupModal;
