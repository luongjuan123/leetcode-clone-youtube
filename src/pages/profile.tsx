import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { auth, firestore } from "@/firebase/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { doc, getDoc, getDocs, collection, setDoc, deleteDoc, query, where, onSnapshot, limit } from "firebase/firestore";

import Topbar from "@/components/Topbar/Topbar";

import Link from "next/link";
import {
	FaGraduationCap,
	FaIdCard,
	FaSchool,
	FaBookOpen,
	FaUser,
	FaCheckCircle,
	FaSave,
	FaCamera,
	FaInfoCircle,
	FaCopy,
} from "react-icons/fa";
import ThreadsBoard from "@/components/Threads/Threads";
import SecondaryNav from "@/components/TabsNavigation/SecondaryNav";
import { calculateExperience } from "@/utils/experienceConfig";
import { getCountryName } from "@/utils/countryData";

interface UserProfile {
	displayName: string;
	username: string;
	experienceLevel: string;
	studentId: string;
	school: string;
	class: string;
	faculty: string;
	bio: string;
	solvedProblems: string[];
	avatarUrl?: string;
	email?: string;
	showStudentInfo?: boolean;
	usernameLastChangedAt?: number;
	easyCount?: number;
	mediumCount?: number;
	hardCount?: number;
	mlCount?: number;
	contestParticipation?: number;
	contestWins?: number;
	xp?: number;
	country?: string;
	createdAt?: number;
}

const ProfilePage: React.FC = () => {
	const [user, loadingAuth] = useAuthState(auth);
	const router = useRouter();
	const { uid } = router.query;
	const isReadOnly = !!uid && uid !== user?.uid;
	const avatarInputRef = useRef<HTMLInputElement>(null);

	const [copyToast, setCopyToast] = useState<string | null>(null);
	const triggerCopyToast = (msg: string) => {
		setCopyToast(msg);
		setTimeout(() => {
			setCopyToast((prev) => prev === msg ? null : prev);
		}, 3000);
	};

	const [loadingProfile, setLoadingProfile] = useState(true);
	const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
	const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
	const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
	const [saving, setSaving] = useState(false);
	const [originalUsername, setOriginalUsername] = useState("");
	const [profile, setProfile] = useState<UserProfile>({
		displayName: "",
		username: "",
		experienceLevel: "",
		studentId: "",
		school: "BeastCode University",
		class: "",
		faculty: "",
		bio: "",
		solvedProblems: [],
		avatarUrl: "",
		email: "",
		showStudentInfo: true,
		usernameLastChangedAt: 0,
	});

	// Stats counts
	const [stats, setStats] = useState({
		easy: { solved: 0, total: 0 },
		medium: { solved: 0, total: 0 },
		hard: { solved: 0, total: 0 },
		total: { solved: 0, total: 0 },
	});

	// Follow System States
	const [followerCount, setFollowerCount] = useState(0);
	const [followingCount, setFollowingCount] = useState(0);
	const [isFollowing, setIsFollowing] = useState(false);

	// Trust & Safety Report States
	const [showReportModal, setShowReportModal] = useState(false);
	const [reportReason, setReportReason] = useState("");
	const [reportDesc, setReportDesc] = useState("");
	const [reportFiles, setReportFiles] = useState<{ name: string; base64: string }[]>([]);
	const [reportFeedback, setReportFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
	const [submittingReport, setSubmittingReport] = useState(false);
	const [acceptReportTerms, setAcceptReportTerms] = useState(false);

	const handleReportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files) return;
		if (reportFiles.length + files.length > 3) {
			setReportFeedback({ type: "error", text: "You can upload a maximum of 3 evidence files." });
			return;
		}

		Array.from(files).forEach((file) => {
			if (file.size > 5 * 1024 * 1024) {
				setReportFeedback({ type: "error", text: `${file.name} is too large. Max size is 5MB per file.` });
				return;
			}

			const reader = new FileReader();
			reader.onload = (ev) => {
				const base64 = ev.target?.result as string;
				setReportFiles((prev) => [...prev, { name: file.name, base64 }]);
			};
			reader.readAsDataURL(file);
		});
	};

	const handleReportSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (submittingReport) return;
		if (!reportReason) {
			setReportFeedback({ type: "error", text: "Please select a reason." });
			return;
		}
		if (reportDesc.length < 30) {
			setReportFeedback({ type: "error", text: "Description must be at least 30 characters." });
			return;
		}
		if (!acceptReportTerms) {
			setReportFeedback({ type: "error", text: "You must accept the terms to submit a report." });
			return;
		}

		setSubmittingReport(true);
		setReportFeedback(null);

		try {
			const idToken = await auth.currentUser?.getIdToken(true);
			const res = await fetch("/api/moderation/report", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${idToken}`
				},
				body: JSON.stringify({
					targetUid: uid,
					reason: reportReason,
					description: reportDesc,
					files: reportFiles,
				}),
			});

			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error?.message || data.message || "Failed to submit report.");
			}

			setReportFeedback({ type: "success", text: "Report submitted successfully." });
			setTimeout(() => {
				setShowReportModal(false);
				setReportReason("");
				setReportDesc("");
				setReportFiles([]);
				setReportFeedback(null);
				setAcceptReportTerms(false);
			}, 3000);
		} catch (err: any) {
			setReportFeedback({ type: "error", text: err.message });
		} finally {
			setSubmittingReport(false);
		}
	};

	useEffect(() => {
		if (!loadingAuth && !user && !isReadOnly) {
			router.push("/");
		}
	}, [user, loadingAuth, router, isReadOnly]);

	useEffect(() => {
		const loadProfileAndStats = async () => {
			const targetUid = isReadOnly ? uid : user?.uid;
			if (!targetUid) return;
			setLoadingProfile(true);
			try {
				const userRef = doc(firestore, "users", targetUid as string);
				const userSnap = await getDoc(userRef);

				let fetchedProfile: UserProfile = {
					displayName: "",
					username: "",
					experienceLevel: "",
					studentId: "",
					school: "BeastCode University",
					class: "",
					faculty: "",
					bio: "",
					solvedProblems: [],
					avatarUrl: "",
					email: "",
					showStudentInfo: true,
					usernameLastChangedAt: 0,
					easyCount: 0,
					mediumCount: 0,
					hardCount: 0,
					mlCount: 0,
					contestParticipation: 0,
					contestWins: 0,
					xp: 0,
				};

				if (userSnap.exists()) {
					const data = userSnap.data();
					fetchedProfile = {
						displayName: data.displayName || "",
						username: data.username || "",
						experienceLevel: data.experienceLevel || "",
						studentId: data.studentId || "",
						school: data.school || "BeastCode University",
						class: data.class || "",
						faculty: data.faculty || "",
						bio: data.bio || "",
						solvedProblems: data.solvedProblems || [],
						avatarUrl: data.avatarUrl || "",
						email: data.email || "",
						showStudentInfo: data.showStudentInfo !== false,
						usernameLastChangedAt: data.usernameLastChangedAt || 0,
						easyCount: data.easyCount || 0,
						mediumCount: data.mediumCount || 0,
						hardCount: data.hardCount || 0,
						mlCount: data.mlCount || 0,
						contestParticipation: data.contestParticipation || 0,
						contestWins: data.contestWins || 0,
						xp: data.xp || 0,
						country: data.country || "",
						createdAt: data.createdAt || 0,
					};
					setOriginalUsername(data.username || "");
					if (data.avatarUrl) {
						setAvatarPreview(data.avatarUrl);
					} else {
						setAvatarPreview(null);
					}
				} else {
					if (!isReadOnly && user) {
						fetchedProfile.displayName = user.displayName || "";
						fetchedProfile.email = user.email || "";
					}
				}
				setProfile(fetchedProfile);

				// Compute stats — Firestore is the single source of truth.
				// Only problems that currently exist in the DB count toward totals.
				const querySnapshot = await getDocs(collection(firestore, "problems"));
				const allProblemsMap = new Map<string, string>();
				querySnapshot.forEach((doc) => {
					const data = doc.data();
					if (data.difficulty) {
						allProblemsMap.set(doc.id, data.difficulty);
					}
				});

				let totalEasy = 0, totalMedium = 0, totalHard = 0;
				let solvedEasy = 0, solvedMedium = 0, solvedHard = 0;

				allProblemsMap.forEach((difficulty, id) => {
					const isSolved = fetchedProfile.solvedProblems.includes(id);
					const diffLower = difficulty.toLowerCase();
					if (diffLower === "easy") { totalEasy++; if (isSolved) solvedEasy++; }
					else if (diffLower === "medium") { totalMedium++; if (isSolved) solvedMedium++; }
					else if (diffLower === "hard") { totalHard++; if (isSolved) solvedHard++; }
				});

				setStats({
					easy: { solved: solvedEasy, total: totalEasy },
					medium: { solved: solvedMedium, total: totalMedium },
					hard: { solved: solvedHard, total: totalHard },
					total: { solved: solvedEasy + solvedMedium + solvedHard, total: totalEasy + totalMedium + totalHard },
				});
			} catch (error: any) {
				console.error("Error loading profile:", error);
				setFeedback({ type: "error", text: "Failed to load profile. Please refresh the page." });
			} finally {
				setLoadingProfile(false);
			}
		};

		if (isReadOnly ? !!uid : !!user) {
			loadProfileAndStats();
		}
	}, [user, uid, isReadOnly]);

	// Subscribe to Follower/Following counts and current Follow status
	useEffect(() => {
		const targetUid = isReadOnly ? uid : user?.uid;
		if (!targetUid) return;

		// Listen to followers count
		const followerQuery = query(collection(firestore, "follows"), where("followingId", "==", targetUid));
		const unsubFollowers = onSnapshot(followerQuery, (snap) => {
			setFollowerCount(snap.size);
		});

		// Listen to following count
		const followingQuery = query(collection(firestore, "follows"), where("followerId", "==", targetUid));
		const unsubFollowing = onSnapshot(followingQuery, (snap) => {
			setFollowingCount(snap.size);
		});

		// Listen to if current user follows target user
		let unsubFollowStatus = () => { };
		if (user && isReadOnly) {
			const followRef = doc(firestore, "follows", `${user.uid}_${targetUid}`);
			unsubFollowStatus = onSnapshot(followRef, (snap) => {
				setIsFollowing(snap.exists());
			});
		}

		return () => {
			unsubFollowers();
			unsubFollowing();
			unsubFollowStatus();
		};
	}, [user, uid, isReadOnly]);

	const handleFollowToggle = async () => {
		if (!user) return;
		const targetUid = uid as string;
		const followId = `${user.uid}_${targetUid}`;
		const followRef = doc(firestore, "follows", followId);

		try {
			if (isFollowing) {
				await deleteDoc(followRef);
			} else {
				await setDoc(followRef, {
					followerId: user.uid,
					followingId: targetUid,
					createdAt: Date.now(),
				});
			}
		} catch (error) {
			console.error("Follow toggle error:", error);
		}
	};

	// Handle avatar file selection — compress & convert to base64
	const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (isReadOnly) return;
		const file = e.target.files?.[0];
		if (!file) return;

		if (file.size > 5 * 1024 * 1024) {
			setFeedback({ type: "error", text: "Image is too large. Please choose an image under 5MB." });
			return;
		}

		const reader = new FileReader();
		reader.onload = (ev) => {
			const dataUrl = ev.target?.result as string;
			// Compress using canvas
			const img = new Image();
			img.onload = () => {
				const canvas = document.createElement("canvas");
				const MAX = 200;
				const ratio = Math.min(MAX / img.width, MAX / img.height);
				canvas.width = img.width * ratio;
				canvas.height = img.height * ratio;
				const ctx = canvas.getContext("2d");
				ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
				const compressed = canvas.toDataURL("image/jpeg", 0.8);
				setAvatarPreview(compressed);
				setAvatarBase64(compressed);
				setFeedback(null);
			};
			img.src = dataUrl;
		};
		reader.readAsDataURL(file);
	};

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user || isReadOnly || saving) return;

		if (!profile.displayName.trim()) {
			setFeedback({ type: "error", text: "Display Name is required." });
			return;
		}

		if (!profile.username.trim()) {
			setFeedback({ type: "error", text: "Username is required." });
			return;
		}

		setSaving(true);
		setFeedback(null);
		try {
			const newUsername = profile.username.trim().toLowerCase();
			const usernameChanged = newUsername !== originalUsername;
			
			if (usernameChanged) {
				const regex = /^[a-zA-Z0-9_]{3,15}$/;
				if (!regex.test(newUsername)) {
					setFeedback({ type: "error", text: "Username must be 3-15 characters, alphanumeric/underscores." });
					setSaving(false);
					return;
				}

				// Check 3 months cooldown rule (90 days)
				const lastChanged = profile.usernameLastChangedAt || 0;
				const cooldownPeriod = 90 * 24 * 60 * 60 * 1000; // 90 days
				if (lastChanged > 0 && Date.now() - lastChanged < cooldownPeriod) {
					const daysLeft = Math.ceil((cooldownPeriod - (Date.now() - lastChanged)) / (24 * 60 * 60 * 1000));
					setFeedback({
						type: "error",
						text: `Username cannot be changed yet. You must wait ${daysLeft} more day(s).`,
					});
					setSaving(false);
					return;
				}

				// Check uniqueness
				const q = query(
					collection(firestore, "users"),
					where("username", "==", newUsername),
					limit(1)
				);
				const snap = await getDocs(q);
				if (!snap.empty && snap.docs[0].id !== user.uid) {
					setFeedback({ type: "error", text: "Username is already taken." });
					setSaving(false);
					return;
				}
			}

			const userRef = doc(firestore, "users", user.uid);
			const updateData: any = {
				displayName: profile.displayName.trim(),
				username: newUsername,
				studentId: profile.studentId.trim(),
				school: profile.school.trim(),
				class: profile.class.trim(),
				faculty: profile.faculty.trim(),
				bio: profile.bio.trim(),
				showStudentInfo: profile.showStudentInfo !== false,
				updatedAt: Date.now(),
			};
			if (usernameChanged) {
				updateData.usernameLastChangedAt = Date.now();
			}
			// Only update avatar if a new one was selected
			if (avatarBase64) {
				updateData.avatarUrl = avatarBase64;
			}
			await setDoc(userRef, updateData, { merge: true });
			if (avatarBase64) {
				setProfile((prev) => ({ ...prev, avatarUrl: avatarBase64 }));
			}
			if (usernameChanged) {
				setProfile((prev) => ({ ...prev, usernameLastChangedAt: Date.now() }));
				setOriginalUsername(newUsername);
			}
			setAvatarBase64(null); // reset pending upload
			setFeedback({ type: "success", text: "Profile updated successfully!" });
			setTimeout(() => setFeedback(null), 4000);
		} catch (error: any) {
			console.error("Error saving profile:", error);
			setFeedback({ type: "error", text: "Failed to save changes. Please try again." });
		} finally {
			setSaving(false);
		}
	};

	const lastChanged = profile.usernameLastChangedAt || 0;
	const cooldownPeriod = 90 * 24 * 60 * 60 * 1000;
	const isUsernameLocked = !isReadOnly && lastChanged > 0 && (Date.now() - lastChanged < cooldownPeriod);
	const usernameDaysLeft = isUsernameLocked ? Math.ceil((cooldownPeriod - (Date.now() - lastChanged)) / (24 * 60 * 60 * 1000)) : 0;

	if (loadingAuth || loadingProfile || (!user && !isReadOnly)) {
		return (
			<div className='bg-dark-layer-2 min-h-screen text-dark-gray-8 flex items-center justify-center'>
				<div className='flex flex-col items-center gap-4'>
					<div className='w-12 h-12 border-4 border-brand-orange border-t-transparent rounded-full animate-spin'></div>
					<div className='text-xl font-semibold text-dark-gray-7 animate-pulse'>Loading profile...</div>
				</div>
			</div>
		);
	}

	const StatBar = ({
		label,
		solved,
		total,
		color,
	}: {
		label: string;
		solved: number;
		total: number;
		color: string;
	}) => (
		<div className='pt-2 border-t border-gray-850'>
			<div className='flex justify-between text-xs mb-1'>
				<span className={`font-semibold ${color}`}>{label}</span>
				<span className='text-dark-gray-7'>{solved} / {total}</span>
			</div>
			<div className='w-full bg-dark-fill-3 h-2 rounded-full overflow-hidden'>
				<div
					className={`h-full rounded-full transition-all duration-700 ${color === "text-green-500" ? "bg-green-500" : color === "text-yellow-500" ? "bg-yellow-500" : "bg-red-500"}`}
					style={{ width: `${total > 0 ? (solved / total) * 100 : 0}%` }}
				/>
			</div>
		</div>
	);

	return (
		<main className='bg-dark-layer-2 min-h-screen text-dark-gray-8 pb-16'>
			<Topbar />

			<div className='max-w-[1100px] mx-auto px-6 mt-8'>
				<h1 className='text-2xl font-bold mb-4 text-shadow-glow' style={{ color: "var(--text-primary)" }}>
					{isReadOnly ? `${profile.displayName}'s Profile` : "My Profile Dashboard"}
				</h1>

				{/* Follow Button & Social counts block */}
				<div className='flex items-center gap-5 mb-8 select-none bg-dark-surface border border-gray-850 px-5 py-3 rounded-2xl max-w-sm shadow-sm dark:shadow-none'>
					{isReadOnly && (
						<div className="flex gap-2">
							<button
								onClick={handleFollowToggle}
								className={`px-6 py-2 rounded-xl text-xs font-bold transition duration-200 shadow-md ${isFollowing
									? "bg-dark-fill-3 hover:bg-dark-fill-2 text-dark-gray-8 border border-gray-850"
									: "bg-brand-orange hover:bg-brand-orange-s bc-btn-brand"
									}`}
							>
								{isFollowing ? "Following" : "Follow"}
							</button>
							<button
								type="button"
								onClick={() => setShowReportModal(true)}
								className="px-6 py-2 rounded-xl text-xs font-bold transition duration-200 shadow-md bg-red-600 hover:bg-red-700 text-white border border-red-700/20"
							>
								Report User
							</button>
						</div>
					)}
					<div className='flex gap-4 text-xs font-semibold text-dark-gray-7'>
						<div>
							<span className='text-dark-gray-8 font-bold font-mono mr-1'>{followerCount}</span>
							<span>Followers</span>
						</div>
						<div>
							<span className='text-dark-gray-8 font-bold font-mono mr-1'>{followingCount}</span>
							<span>Following</span>
						</div>
					</div>
				</div>

				<div className='grid grid-cols-1 lg:grid-cols-12 gap-8'>
					{/* Left Column */}
					<div className='col-span-1 lg:col-span-5 space-y-6'>
						{/* BeastCode Student Card */}
						<div className='relative overflow-hidden bg-gradient-to-br from-white via-white to-brand-orange/10 dark:from-dark-layer-1 dark:via-dark-layer-1 dark:to-brand-orange/20 border border-gray-850 rounded-2xl p-6 shadow-md dark:shadow-2xl hover:border-brand-orange/30 transition duration-300'>
							<div className='flex justify-between items-start mb-6'>
								<div>
									<h2 className='text-xs font-bold tracking-widest text-brand-orange uppercase'>User ID Card</h2>
									<p className='text-[10px] text-dark-gray-7'>Online Judge Portal</p>
								</div>
								<div className='bg-brand-orange/10 p-2.5 rounded-lg border border-brand-orange/20 text-brand-orange'>
									<FaGraduationCap size={24} />
								</div>
							</div>

							<div className='space-y-4 relative z-10'>
								{/* Avatar in card */}
								<div className='flex items-center gap-4'>
									<div className='relative shrink-0'>
										{avatarPreview ? (
											<img
												src={avatarPreview}
												alt='Avatar'
												className='w-16 h-16 rounded-full border-2 border-brand-orange/50 object-cover shadow-lg'
											/>
										) : (
											<div className='w-16 h-16 rounded-full border-2 border-brand-orange/30 bg-dark-layer-2 flex items-center justify-center shadow-inner'>
												<FaUser size={28} className='text-dark-gray-7' />
											</div>
										)}
									</div>
									<div>
										<h3 className='text-xl font-bold text-dark-gray-8 truncate max-w-[200px]'>
											{profile.displayName || "Unset Display Name"}
										</h3>
										{profile.username && (
											<p className='text-xs text-brand-orange font-semibold font-mono truncate max-w-[200px]'>
												@{profile.username}
											</p>
										)}
										<p className='text-xs text-dark-gray-7 truncate max-w-[200px] mt-0.5'>{isReadOnly && profile.showStudentInfo === false ? "••••••••@•••••.••" : isReadOnly ? profile.email : user?.email}</p>
										{(() => {
											const expInfo = calculateExperience({
												easySolved: profile.easyCount || 0,
												mediumSolved: profile.mediumCount || 0,
												hardSolved: profile.hardCount || 0,
												mlSolved: profile.mlCount || 0,
												contestParticipation: profile.contestParticipation || 0,
												contestWins: profile.contestWins || 0,
											});

											return (
												<div className="mt-3 space-y-2">
													{/* Tier badge & XP Info */}
													<div className="flex items-center gap-1.5">
														<span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${expInfo.currentTier.colorClass}`}>
															{expInfo.currentTier.name}
														</span>
														<span className="text-[10px] font-semibold text-dark-gray-7">
															{expInfo.score} XP
														</span>

														{/* Tooltip */}
														<div className="relative group inline-block cursor-pointer align-middle">
															<FaInfoCircle className="text-gray-500 hover:text-brand-orange transition-colors" size={11} />
															<div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-3 bg-dark-layer-1 border border-gray-800 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[100] text-[10px] text-gray-300 pointer-events-none">
																<div className="font-bold text-white mb-1.5 border-b border-gray-800 pb-1 flex justify-between items-center">
																	<span>Experience Formula</span>
																	<span className="text-[8px] text-brand-orange uppercase">Weights</span>
																</div>
																<div className="space-y-1 font-mono text-[9px]">
																	<div className="flex justify-between"><span>Easy Solved:</span> <span className="text-white">+1 XP</span></div>
																	<div className="flex justify-between"><span>Medium Solved:</span> <span className="text-white">+3 XP</span></div>
																	<div className="flex justify-between"><span>Hard Solved:</span> <span className="text-white">+7 XP</span></div>
																	<div className="flex justify-between"><span>ML Solved:</span> <span className="text-white">+10 XP</span></div>
																	<div className="flex justify-between"><span>Contest Participation:</span> <span className="text-white">+5 XP</span></div>
																	<div className="flex justify-between"><span>Contest Win:</span> <span className="text-white">+20 XP</span></div>
																</div>
																<div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-dark-layer-1" />
															</div>
														</div>
													</div>

													{/* Progress bar */}
													<div className="w-44">
														<div className="w-full h-1 rounded-full bg-gray-800 overflow-hidden">
															<div
																className="h-full rounded-full transition-all duration-300"
																style={{
																	width: `${expInfo.percent}%`,
																	backgroundColor: expInfo.currentTier.accentColor,
																}}
															/>
														</div>
														{expInfo.nextTier && (
															<div className="flex justify-between items-center mt-1 text-[8px] text-dark-gray-6">
																<span>{expInfo.pointsToNext} XP to {expInfo.nextTier.name}</span>
																<span>{Math.round(expInfo.percent)}%</span>
															</div>
														)}
													</div>
												</div>
											);
										})()}
									</div>
								</div>

								{isReadOnly && profile.showStudentInfo === false ? (
									<div className='border-t border-gray-850 pt-4 text-center text-xs text-dark-gray-7 italic py-2'>
										Student card details are hidden by the user.
									</div>
								) : (
									<>
										{!isReadOnly && (
											<div className='text-[10px] text-right font-semibold -mt-2 mb-1'>
												Card Status:{" "}
												<span className={profile.showStudentInfo !== false ? "text-green-400" : "text-yellow-400"}>
													{profile.showStudentInfo !== false ? "Public" : "Private"}
												</span>
											</div>
										)}
										<div className='border-t border-gray-850 pt-4 grid grid-cols-2 gap-y-3 gap-x-2 text-xs'>
											<div className='flex items-center gap-2 text-dark-gray-7'>
												<FaSchool className='text-brand-orange shrink-0' />
												<span className='truncate' title={profile.school}>{profile.school || "BeastCode"}</span>
											</div>
											<div className='flex items-center gap-2 text-dark-gray-7'>
												<FaIdCard className='text-brand-orange shrink-0' />
												<span className='truncate'>{profile.studentId || "Student ID Unset"}</span>
											</div>
											<div className='flex items-center gap-2 text-dark-gray-7'>
												<FaBookOpen className='text-brand-orange shrink-0' />
												<span className='truncate' title={profile.faculty}>{profile.faculty || "Faculty Unset"}</span>
											</div>
											<div className='flex items-center gap-2 text-dark-gray-7'>
												<FaGraduationCap className='text-brand-orange shrink-0' />
												<span className='truncate'>{profile.class || "Class Unset"}</span>
											</div>
										</div>
									</>
								)}

								{profile.bio && (
									<div className='mt-4 pt-3 border-t border-gray-850/40'>
										<p className='text-xs text-dark-gray-7 italic line-clamp-3'>&ldquo;{profile.bio}&rdquo;</p>
									</div>
								)}
							</div>
							<div className='absolute -right-10 -bottom-10 w-40 h-40 bg-brand-orange/5 rounded-full blur-2xl pointer-events-none' />
						</div>

						{/* User Information Card */}
						<div className='bg-dark-surface border border-gray-850 rounded-2xl p-6 shadow-md dark:shadow-2xl space-y-4 relative overflow-hidden'>
							<div className='absolute top-0 right-0 w-24 h-24 bg-brand-orange/5 rounded-full blur-xl pointer-events-none' />
							<h3 className='text-lg font-bold text-dark-gray-8 border-b border-gray-850 pb-3 flex items-center gap-2'>
								<FaUser className='text-brand-orange shrink-0' />
								User Information
							</h3>
							
							<div className='space-y-3.5 text-xs'>
								{/* UID Section */}
								<div className='flex justify-between items-center bg-dark-layer-2/30 p-2.5 rounded-xl border border-gray-850/50'>
									<div className='space-y-0.5'>
										<span className='text-gray-500 font-bold uppercase tracking-wider block text-[10px]'>User UID</span>
										<span className='font-mono text-gray-300 select-all truncate max-w-[190px] block' title={isReadOnly ? (uid as string) : user?.uid}>
											{isReadOnly ? (uid as string) : user?.uid}
										</span>
									</div>
									<button
										onClick={() => {
											const copyText = isReadOnly ? (uid as string) : user?.uid;
											if (copyText) {
												navigator.clipboard.writeText(copyText);
												triggerCopyToast("UID copied to clipboard!");
											}
										}}
										className='text-gray-400 hover:text-white transition p-2 hover:bg-gray-800 rounded-lg shrink-0'
										title='Copy UID'
									>
										<FaCopy size={13} />
									</button>
								</div>

								{/* Country Section */}
								<div className='flex justify-between items-center py-1 border-b border-gray-850/30'>
									<span className='text-gray-500 font-bold uppercase tracking-wider block text-[10px]'>Country</span>
									<span className='text-gray-300 font-semibold'>
										{profile.country ? getCountryName(profile.country) : "Not Specified"}
									</span>
								</div>

								{/* Joined Date Section */}
								<div className='flex justify-between items-center py-1 border-b border-gray-850/30'>
									<span className='text-gray-500 font-bold uppercase tracking-wider block text-[10px]'>Joined Date</span>
									<span className='text-gray-300 font-semibold'>
										{profile.createdAt ? new Date(profile.createdAt).toLocaleDateString(undefined, {
											year: 'numeric',
											month: 'long',
											day: 'numeric'
										}) : "Join date not available"}
									</span>
								</div>

								{/* Experience Tier Section */}
								<div className='flex justify-between items-center py-1'>
									<span className='text-gray-500 font-bold uppercase tracking-wider block text-[10px]'>Experience Tier</span>
									{(() => {
										const expInfo = calculateExperience({
											easySolved: profile.easyCount || 0,
											mediumSolved: profile.mediumCount || 0,
											hardSolved: profile.hardCount || 0,
											mlSolved: profile.mlCount || 0,
											contestParticipation: profile.contestParticipation || 0,
											contestWins: profile.contestWins || 0,
										});
										return (
											<span className='font-bold uppercase px-2 py-0.5 rounded text-[10px]' style={{
												color: expInfo.currentTier.accentColor,
												backgroundColor: `color-mix(in srgb, ${expInfo.currentTier.accentColor} 12%, transparent)`,
												border: `1px solid color-mix(in srgb, ${expInfo.currentTier.accentColor} 30%, transparent)`
											}}>
												{expInfo.currentTier.name}
											</span>
										);
									})()}
								</div>
							</div>
						</div>

						{/* Solved Stats */}
						<div className='bg-dark-surface border border-gray-850 rounded-2xl p-6 shadow-md dark:shadow-2xl space-y-4'>
							<h3 className='text-lg font-bold text-dark-gray-8 border-b border-gray-850 pb-3 flex items-center gap-2'>
								<FaCheckCircle className='text-green-500' />
								Solved Statistics
							</h3>
							<div>
								<div className='flex justify-between text-sm mb-1.5'>
									<span className='text-dark-gray-7 font-medium'>Overall Solved</span>
									<span className='text-dark-gray-8 font-bold'>{stats.total.solved} / {stats.total.total}</span>
								</div>
								<div className='w-full bg-dark-layer-2 h-2.5 rounded-full overflow-hidden'>
									<div
										className='bg-gradient-to-r from-brand-orange to-yellow-500 h-full rounded-full transition-all duration-700'
										style={{ width: `${stats.total.total > 0 ? (stats.total.solved / stats.total.total) * 100 : 0}%` }}
									/>
								</div>
							</div>
							<StatBar label='Easy' solved={stats.easy.solved} total={stats.easy.total} color='text-green-500' />
							<StatBar label='Medium' solved={stats.medium.solved} total={stats.medium.total} color='text-yellow-500' />
							<StatBar label='Hard' solved={stats.hard.solved} total={stats.hard.total} color='text-red-500' />
						</div>
					</div>

					{/* Right Column: Edit Form */}
					<div className='col-span-1 lg:col-span-7'>
						<form onSubmit={handleSave} className='rounded-2xl p-8 space-y-6' style={{ background: "var(--bg-dark-layer-1)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-md)" }}>
							<h3 className='text-xl font-bold pb-3 text-shadow-glow' style={{ color: "var(--text-primary)", borderBottom: "1px solid var(--border-subtle)" }}>
								{isReadOnly ? "Profile Details" : "Edit Profile Details"}
							</h3>

							{/* Avatar Upload */}
							{!isReadOnly ? (
								<div className='flex flex-col items-center gap-3 p-4 rounded-xl' style={{ background: "var(--bg-dark-layer-2)", border: "1px dashed var(--border-default)" }}>
									<p className='text-xs font-semibold uppercase tracking-wider' style={{ color: "var(--text-secondary)" }}>Profile Avatar</p>
									<div className='relative group cursor-pointer' onClick={() => avatarInputRef.current?.click()}>
										{avatarPreview ? (
											<img
												src={avatarPreview}
												alt='Avatar preview'
												className='w-24 h-24 rounded-full object-cover border-2 border-brand-orange/60 shadow-lg'
											/>
										) : (
											<div className='w-24 h-24 rounded-full flex items-center justify-center' style={{ background: "var(--bg-dark-fill-3)", border: "2px solid var(--border-default)" }}>
												<FaUser size={36} style={{ color: "var(--text-muted)" }} />
											</div>
										)}
										<div className='absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center'>
											<FaCamera size={20} className='text-white' />
										</div>
									</div>
									<button
										type='button'
										onClick={() => avatarInputRef.current?.click()}
										className='text-xs text-brand-orange hover:underline font-medium'
									>
										{avatarPreview ? "Change photo" : "Upload photo"}
									</button>
									<p className='text-[10px]' style={{ color: "var(--text-muted)" }}>JPG, PNG or GIF · Max 5MB</p>
									<input
										ref={avatarInputRef}
										type='file'
										accept='image/*'
										className='hidden'
										onChange={handleAvatarChange}
									/>
									{avatarBase64 && (
										<span className='text-[10px] text-green-400 font-medium flex items-center gap-1'><FaCheckCircle size={10} /> New photo ready — save to apply</span>
									)}
								</div>
							) : (
								<div className='flex flex-col items-center gap-2 p-4 rounded-xl' style={{ background: "var(--bg-dark-layer-2)", border: "1px solid var(--border-subtle)" }}>
									{avatarPreview ? (
										<img
											src={avatarPreview}
											alt='Avatar'
											className='w-24 h-24 rounded-full object-cover border-2 border-brand-orange/40 shadow-lg animate-fade-in'
										/>
									) : (
										<div className='w-24 h-24 rounded-full bg-dark-layer-2 border border-gray-850/40 flex items-center justify-center'>
											<FaUser size={36} className='text-dark-gray-7' />
										</div>
									)}
									<span className='text-xs text-dark-gray-7 font-medium'>BeastCode Registered Member</span>
								</div>
							)}

							{/* Form Fields */}
							<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
								<div className='col-span-1 md:col-span-2'>
									<label htmlFor='displayName' className='text-sm font-semibold block mb-2 text-dark-gray-8'>
										Display Name {!isReadOnly && <span className='text-red-500'>*</span>}
									</label>
									<input
										value={profile.displayName}
										onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
										type='text'
										id='displayName'
										disabled={isReadOnly}
										className='border border-gray-850 outline-none sm:text-sm rounded-lg focus:ring-1 focus:ring-brand-orange focus:border-brand-orange block w-full p-3 bg-dark-layer-2 text-dark-gray-8 placeholder:text-bc-muted disabled:opacity-60 disabled:cursor-not-allowed'
										placeholder='Nguyen Van A'
										required
									/>
								</div>

								<div>
									<label htmlFor='username' className='text-sm font-semibold block mb-2 text-dark-gray-8'>
										Username {!isReadOnly && <span className='text-red-500'>*</span>}
									</label>
									<input
										value={profile.username}
										onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))}
										type='text'
										id='username'
										disabled={isReadOnly || isUsernameLocked}
										className='border border-gray-850 outline-none sm:text-sm rounded-lg focus:ring-1 focus:ring-brand-orange focus:border-brand-orange block w-full p-3 bg-dark-layer-2 text-dark-gray-8 placeholder:text-bc-muted font-mono disabled:opacity-60 disabled:cursor-not-allowed'
										placeholder='username'
										required
									/>
									{isUsernameLocked && (
										<p className='text-[10px] text-yellow-500 mt-1.5 font-medium'>
											Locked. Can be changed again in {usernameDaysLeft} day(s).
										</p>
									)}
								</div>

								<div>
									<label className='text-sm font-semibold block mb-2 text-dark-gray-8'>
										Experience Tier (Calculated Automatically)
									</label>
									<div className="border border-gray-850 rounded-lg p-3 bg-dark-layer-2 flex items-center justify-between">
										{(() => {
											const expInfo = calculateExperience({
												easySolved: profile.easyCount || 0,
												mediumSolved: profile.mediumCount || 0,
												hardSolved: profile.hardCount || 0,
												mlSolved: profile.mlCount || 0,
												contestParticipation: profile.contestParticipation || 0,
												contestWins: profile.contestWins || 0,
											});

											return (
												<div className="w-full space-y-2">
													<div className="flex items-center gap-1.5 justify-between">
														<div className="flex items-center gap-1.5">
															<span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${expInfo.currentTier.colorClass}`}>
																{expInfo.currentTier.name}
															</span>
															<span className="text-[11px] font-semibold text-text-secondary" style={{ color: "var(--text-secondary)" }}>
																{expInfo.score} XP
															</span>
														</div>

														{/* Tooltip */}
														<div className="relative group inline-block cursor-pointer align-middle">
															<FaInfoCircle className="text-gray-500 hover:text-brand-orange transition-colors" size={13} />
															<div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-dark-layer-1 border border-gray-800 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[100] text-xs text-gray-300 pointer-events-none">
																<div className="font-bold text-white mb-1.5 border-b border-gray-800 pb-1 flex justify-between items-center">
																	<span>Experience Calculation</span>
																	<span className="text-[9px] text-brand-orange uppercase">Weights System</span>
																</div>
																<div className="space-y-1 font-mono text-[10px]">
																	<div className="flex justify-between"><span>Easy Solved:</span> <span className="text-white">+1 XP</span></div>
																	<div className="flex justify-between"><span>Medium Solved:</span> <span className="text-white">+3 XP</span></div>
																	<div className="flex justify-between"><span>Hard Solved:</span> <span className="text-white">+7 XP</span></div>
																	<div className="flex justify-between"><span>ML Solved:</span> <span className="text-white">+10 XP</span></div>
																	<div className="flex justify-between"><span>Contest Participation:</span> <span className="text-white">+5 XP</span></div>
																	<div className="flex justify-between"><span>Contest Win:</span> <span className="text-white">+20 XP</span></div>
																</div>
																<div className="absolute top-full right-1.5 border-4 border-transparent border-t-dark-layer-1" />
															</div>
														</div>
													</div>

													<div className="w-full">
														<div className="w-full h-1.5 rounded-full bg-gray-800 overflow-hidden">
															<div
																className="h-full rounded-full transition-all duration-300"
																style={{
																	width: `${expInfo.percent}%`,
																	backgroundColor: expInfo.currentTier.accentColor,
																}}
															/>
														</div>
														{expInfo.nextTier && (
															<div className="flex justify-between items-center mt-1 text-[9px] text-dark-gray-7">
																<span>{expInfo.pointsToNext} XP to {expInfo.nextTier.name}</span>
																<span>{Math.round(expInfo.percent)}%</span>
															</div>
														)}
													</div>
												</div>
											);
										})()}
									</div>
								</div>

								{isReadOnly && profile.showStudentInfo === false ? (
									<div className='col-span-1 md:col-span-2 flex flex-col items-center justify-center py-10 gap-3 text-center'>
										<div className='w-14 h-14 rounded-full bg-dark-layer-2 flex items-center justify-center border border-gray-850'>
											<svg xmlns='http://www.w3.org/2000/svg' className='w-7 h-7 text-dark-gray-7' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
												<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' />
											</svg>
										</div>
										<p className='text-sm font-semibold text-dark-gray-7'>Profile details are private</p>
										<p className='text-xs text-dark-gray-7 max-w-xs'>This user has chosen to keep their student information hidden from other users.</p>
									</div>
								) : (
									<>
										<div>
											<label htmlFor='studentId' className='text-sm font-semibold block mb-2 text-dark-gray-8'>
												Student ID Code
											</label>
											<input
												value={profile.studentId}
												onChange={(e) => setProfile((p) => ({ ...p, studentId: e.target.value }))}
												type='text'
												id='studentId'
												disabled={isReadOnly}
												className='border border-gray-850 outline-none sm:text-sm rounded-lg focus:ring-1 focus:ring-brand-orange focus:border-brand-orange block w-full p-3 bg-dark-layer-2 text-dark-gray-8 placeholder:text-bc-muted font-mono disabled:opacity-60 disabled:cursor-not-allowed'
												placeholder='e.g. 22010234'
											/>
										</div>

										<div>
											<label htmlFor='school' className='text-sm font-semibold block mb-2 text-dark-gray-8'>
												School / University
											</label>
											<input
												value={profile.school}
												onChange={(e) => setProfile((p) => ({ ...p, school: e.target.value }))}
												type='text'
												id='school'
												disabled={isReadOnly}
												className='border border-gray-850 outline-none sm:text-sm rounded-lg focus:ring-1 focus:ring-brand-orange focus:border-brand-orange block w-full p-3 bg-dark-layer-2 text-dark-gray-8 placeholder:text-bc-muted disabled:opacity-60 disabled:cursor-not-allowed'
												placeholder='BeastCode University'
											/>
										</div>

										<div>
											<label htmlFor='faculty' className='text-sm font-semibold block mb-2 text-dark-gray-8'>
												Faculty / Department
											</label>
											<input
												value={profile.faculty}
												onChange={(e) => setProfile((p) => ({ ...p, faculty: e.target.value }))}
												type='text'
												id='faculty'
												disabled={isReadOnly}
												className='border border-gray-850 outline-none sm:text-sm rounded-lg focus:ring-1 focus:ring-brand-orange focus:border-brand-orange block w-full p-3 bg-dark-layer-2 text-dark-gray-8 placeholder:text-bc-muted disabled:opacity-60 disabled:cursor-not-allowed'
												placeholder='e.g. Computer Science & Engineering'
											/>
										</div>

										<div>
											<label htmlFor='class' className='text-sm font-semibold block mb-2 text-dark-gray-8'>
												Class
											</label>
											<input
												value={profile.class}
												onChange={(e) => setProfile((p) => ({ ...p, class: e.target.value }))}
												type='text'
												id='class'
												disabled={isReadOnly}
												className='border border-gray-850 outline-none sm:text-sm rounded-lg focus:ring-1 focus:ring-brand-orange focus:border-brand-orange block w-full p-3 bg-dark-layer-2 text-dark-gray-8 placeholder:text-bc-muted disabled:opacity-60 disabled:cursor-not-allowed'
												placeholder='e.g. CSE-2026'
											/>
										</div>

										<div className='col-span-1 md:col-span-2'>
											<label htmlFor='bio' className='text-sm font-semibold block mb-2 text-dark-gray-8'>
												Short Bio
											</label>
											<textarea
												value={profile.bio}
												onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
												id='bio'
												disabled={isReadOnly}
												rows={4}
												className='border border-gray-850 outline-none sm:text-sm rounded-lg focus:ring-1 focus:ring-brand-orange block w-full p-3 bg-dark-layer-2 text-dark-gray-8 placeholder:text-bc-muted disabled:opacity-60 disabled:cursor-not-allowed'
												placeholder='Tell us a bit about yourself...'
											/>
										</div>
									</>
								)}

								{!isReadOnly && (
									<div className='col-span-1 md:col-span-2 flex items-center justify-between p-4 border border-gray-850 rounded-xl bg-dark-fill-3 mt-2'>
										<div>
											<label className='text-sm font-semibold block text-dark-gray-8'>
												Public Student Information
											</label>
											<p className='text-xs text-dark-gray-7 mt-0.5'>
												Allow other users to see your Student ID, school, class, and faculty.
											</p>
										</div>
										<button
											type='button'
											onClick={() => setProfile((p) => ({ ...p, showStudentInfo: p.showStudentInfo !== false ? false : true }))}
											className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${profile.showStudentInfo !== false ? "bg-brand-orange" : "bg-dark-fill-3"
												}`}
										>
											<span
												className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-dark-surface shadow ring-0 transition duration-200 ease-in-out ${profile.showStudentInfo !== false ? "translate-x-5" : "translate-x-0"
													}`}
											/>
										</button>
									</div>
								)}
							</div>

							<div className='border-t border-gray-850 pt-6 flex justify-between items-center gap-4'>
								<div>
									{feedback && (
										<span className={`text-xs font-semibold ${feedback.type === "success" ? "text-green-400" : "text-rose-450"
											}`}>
											{feedback.text}
										</span>
									)}
								</div>
								<div className='flex gap-3'>
									{isReadOnly ? (
										<button
											type='button'
											onClick={() => router.push("/")}
											className='bg-brand-orange hover:bg-brand-orange-s text-white px-8 py-2.5 rounded-lg font-bold transition shadow-lg'
										>
											Back to Leaderboard
										</button>
									) : (
										<>
											<Link
												href='/'
												className='bg-dark-fill-3 hover:bg-dark-fill-2 border border-gray-850/40 text-dark-gray-8 px-6 py-2.5 rounded-lg font-medium transition'
											>
												Cancel
											</Link>
											<button
												type='submit'
												disabled={saving}
												className='bg-brand-orange hover:bg-brand-orange-s text-white px-8 py-2.5 rounded-lg font-bold transition shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'
											>
												<FaSave size={14} />
												{saving ? "Saving..." : "Save Changes"}
											</button>
										</>
									)}
								</div>
							</div>
						</form>
					</div>
				</div>

				{/* User Threads Section */}
				<div className='mt-10 border-t pt-8 max-w-4xl mx-auto animate-fade-in' style={{ borderColor: "var(--border-subtle)" }}>
					<SecondaryNav
						tabs={[
							{ id: "posted", label: "Posted Threads" },
							{ id: "reposted", label: "Reposted Threads" },
						]}
						activeTab={router.query.tab === "reposted" ? "reposted" : "posted"}
						onChange={(tabId) => {
							router.push(
								{
									pathname: router.pathname,
									query: { ...router.query, tab: tabId },
								},
								undefined,
								{ shallow: true }
							);
						}}
						className="mb-6"
					/>

					<div className='pb-12'>
						{router.query.tab === "reposted" ? (
							<ThreadsBoard profileUid={(uid || user?.uid) as string} repostFeedOnly={true} />
						) : (
							<ThreadsBoard profileUid={(uid || user?.uid) as string} postFeedOnly={true} />
						)}
					</div>
				</div>
			</div>

			{/* Premium Glassmorphism Report User Modal */}
			{showReportModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
					<div className="bg-dark-layer-1 border border-gray-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-scale-up">
						{/* Header */}
						<div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-red-950/20">
							<div className="flex items-center gap-2 text-red-500">
								<span className="text-xl">🚨</span>
								<h3 className="text-lg font-bold text-white">Report User: @{profile.username}</h3>
							</div>
							<button
								onClick={() => {
									setShowReportModal(false);
									setReportFeedback(null);
								}}
								className="text-gray-400 hover:text-white transition duration-150"
							>
								✕
							</button>
						</div>

						{/* Form */}
						<form onSubmit={handleReportSubmit} className="p-6 space-y-4">
							<div>
								<label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
									Violation Category <span className="text-red-500">*</span>
								</label>
								<select
									value={reportReason}
									onChange={(e) => setReportReason(e.target.value)}
									required
									className="w-full bg-dark-layer-2 border border-gray-850 text-white rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-brand-orange"
								>
									<option value="">Select a reason...</option>
									<option value="Cheating / Plagiarism">Cheating / Plagiarism (copying code/solutions)</option>
									<option value="Abusive Behavior">Abusive Behavior (toxic posts/comments)</option>
									<option value="Spam">Spam (advertising/flooding the leaderboard)</option>
									<option value="Impersonation">Impersonation (pretending to be another user/org)</option>
									<option value="Harassment">Harassment (stalking/hate speech)</option>
									<option value="Other">Other (specify below)</option>
								</select>
							</div>

							<div>
								<div className="flex justify-between items-center mb-2">
									<label className="block text-xs font-bold uppercase tracking-wider text-gray-400">
										Detailed Description <span className="text-red-500">*</span>
									</label>
									<span className={`text-[10px] ${reportDesc.length < 30 ? "text-yellow-500" : "text-gray-500"}`}>
										{reportDesc.length} / 3000 chars (min 30)
									</span>
								</div>
								<textarea
									value={reportDesc}
									onChange={(e) => setReportDesc(e.target.value)}
									required
									minLength={30}
									maxLength={3000}
									rows={4}
									placeholder="Describe the violation in detail, referencing specific submissions, threads, or dates where appropriate..."
									className="w-full bg-dark-layer-2 border border-gray-850 text-white rounded-lg p-3 outline-none focus:ring-1 focus:ring-brand-orange text-sm placeholder:text-gray-600 resize-none"
								/>
							</div>

							{/* File Upload / Evidence */}
							<div>
								<label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
									Evidence & Attachments (Optional)
								</label>
								<div className="border border-dashed border-gray-850 rounded-lg p-4 bg-dark-layer-2 flex flex-col items-center justify-center gap-2">
									<span className="text-2xl">📁</span>
									<p className="text-xs text-gray-400 text-center">
										Drag & drop or <label className="text-brand-orange cursor-pointer hover:underline">browse<input type="file" multiple accept="image/*,.pdf,.txt,.zip" onChange={handleReportFileChange} className="hidden" /></label>
									</p>
									<p className="text-[9px] text-gray-500">Supports: JPG, PNG, PDF, TXT, ZIP · Max 3 files · Max 5MB each</p>
								</div>

								{reportFiles.length > 0 && (
									<div className="mt-3 space-y-1.5">
										{reportFiles.map((file, idx) => (
											<div key={idx} className="flex justify-between items-center bg-dark-fill-3 border border-gray-850 rounded-md px-3 py-1.5 text-xs text-gray-300">
												<span className="truncate max-w-[250px] font-mono">{file.name}</span>
												<button
													type="button"
													onClick={() => setReportFiles(prev => prev.filter((_, i) => i !== idx))}
													className="text-red-400 hover:text-red-500 transition ml-2 font-bold"
												>
													✕
												</button>
											</div>
										))}
									</div>
								)}
							</div>

							{/* Terms */}
							<label className="flex gap-2.5 items-start cursor-pointer select-none">
								<input
									type="checkbox"
									checked={acceptReportTerms}
									onChange={(e) => setAcceptReportTerms(e.target.checked)}
									className="mt-0.5 accent-brand-orange"
								/>
								<span className="text-[10px] text-gray-400 leading-tight">
									I declare under penalty of perjury that this report is true, accurate, and submitted in good faith. I understand that submitting false reports may result in action against my account.
								</span>
							</label>

							{/* Status Feedback */}
							{reportFeedback && (
								<div className={`p-3 rounded-lg text-xs font-semibold ${
									reportFeedback.type === "success" ? "bg-green-950/40 text-green-400 border border-green-900/35" : "bg-red-950/40 text-red-400 border border-red-900/35"
								}`}>
									{reportFeedback.text}
								</div>
							)}

							{/* Footer Actions */}
							<div className="flex justify-end gap-2.5 pt-2 border-t border-gray-850">
								<button
									type="button"
									onClick={() => {
										setShowReportModal(false);
										setReportFeedback(null);
									}}
									className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={submittingReport}
									className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-800 disabled:text-gray-500 rounded-lg transition shadow-md flex items-center gap-1.5"
								>
									{submittingReport ? "Submitting..." : "Submit Report"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{copyToast && (
				<div className="fixed bottom-5 right-5 bg-dark-layer-1 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 z-50 animate-bounce">
					<FaCheckCircle className="text-emerald-500" />
					<span className="text-xs font-semibold">{copyToast}</span>
				</div>
			)}
		</main>
	);
};

export default ProfilePage;
