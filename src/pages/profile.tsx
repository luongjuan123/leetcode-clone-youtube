import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { auth, firestore } from "@/firebase/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { doc, getDoc, getDocs, collection, setDoc, deleteDoc, query, where, onSnapshot } from "firebase/firestore";

import Topbar from "@/components/Topbar/Topbar";
import TabsNavigation from "@/components/TabsNavigation/TabsNavigation";
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
} from "react-icons/fa";
import ThreadsBoard from "@/components/Threads/Threads";

interface UserProfile {
	displayName: string;
	studentId: string;
	school: string;
	class: string;
	faculty: string;
	bio: string;
	solvedProblems: string[];
	avatarUrl?: string;
	email?: string;
	showStudentInfo?: boolean;
}

const ProfilePage: React.FC = () => {
	const [user, loadingAuth] = useAuthState(auth);
	const router = useRouter();
	const { uid } = router.query;
	const isReadOnly = !!uid && uid !== user?.uid;
	const avatarInputRef = useRef<HTMLInputElement>(null);

	const [loadingProfile, setLoadingProfile] = useState(true);
	const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
	const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
	const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
	const [saving, setSaving] = useState(false);
	const [profile, setProfile] = useState<UserProfile>({
		displayName: "",
		studentId: "",
		school: "BeastCode University",
		class: "",
		faculty: "",
		bio: "",
		solvedProblems: [],
		avatarUrl: "",
		email: "",
		showStudentInfo: true,
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
					studentId: "",
					school: "BeastCode University",
					class: "",
					faculty: "",
					bio: "",
					solvedProblems: [],
					avatarUrl: "",
					email: "",
					showStudentInfo: true,
				};

				if (userSnap.exists()) {
					const data = userSnap.data();
					fetchedProfile = {
						displayName: data.displayName || "",
						studentId: data.studentId || "",
						school: data.school || "BeastCode University",
						class: data.class || "",
						faculty: data.faculty || "",
						bio: data.bio || "",
						solvedProblems: data.solvedProblems || [],
						avatarUrl: data.avatarUrl || "",
						email: data.email || "",
						showStudentInfo: data.showStudentInfo !== false,
					};
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

		setSaving(true);
		setFeedback(null);
		try {
			const userRef = doc(firestore, "users", user.uid);
			const updateData: any = {
				displayName: profile.displayName.trim(),
				studentId: profile.studentId.trim(),
				school: profile.school.trim(),
				class: profile.class.trim(),
				faculty: profile.faculty.trim(),
				bio: profile.bio.trim(),
				showStudentInfo: profile.showStudentInfo !== false,
				updatedAt: Date.now(),
			};
			// Only update avatar if a new one was selected
			if (avatarBase64) {
				updateData.avatarUrl = avatarBase64;
			}
			await setDoc(userRef, updateData, { merge: true });
			if (avatarBase64) {
				setProfile((prev) => ({ ...prev, avatarUrl: avatarBase64 }));
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

	if (loadingAuth || loadingProfile || (!user && !isReadOnly)) {
		return (
			<div className='bg-dark-layer-2 min-h-screen text-slate-900 dark:text-white flex items-center justify-center'>
				<div className='flex flex-col items-center gap-4'>
					<div className='w-12 h-12 border-4 border-brand-orange border-t-transparent rounded-full animate-spin'></div>
					<div className='text-xl font-semibold text-slate-655 dark:text-gray-300 animate-pulse'>Loading profile...</div>
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
		<div className='pt-2 border-t border-slate-200 dark:border-gray-800/60'>
			<div className='flex justify-between text-xs mb-1'>
				<span className={`font-semibold ${color}`}>{label}</span>
				<span className='text-slate-600 dark:text-gray-300'>{solved} / {total}</span>
			</div>
			<div className='w-full bg-slate-100 dark:bg-dark-fill-3 h-2 rounded-full overflow-hidden'>
				<div
					className={`h-full rounded-full transition-all duration-700 ${color === "text-green-500" ? "bg-green-500" : color === "text-yellow-500" ? "bg-yellow-500" : "bg-red-500"}`}
					style={{ width: `${total > 0 ? (solved / total) * 100 : 0}%` }}
				/>
			</div>
		</div>
	);

	return (
		<main className='bg-dark-layer-2 min-h-screen text-slate-800 dark:text-white pb-16'>
			<Topbar />
			<TabsNavigation />
			<div className='max-w-[1100px] mx-auto px-6 mt-8'>
				<h1 className='text-2xl font-bold mb-4' style={{ color: "var(--text-primary)" }}>
					{isReadOnly ? `${profile.displayName}'s Profile` : "My Profile Dashboard"}
				</h1>

				{/* Follow Button & Social counts block */}
				<div className='flex items-center gap-5 mb-8 select-none bg-white dark:bg-dark-layer-1 border border-slate-200/80 dark:border-slate-800/60 px-5 py-3 rounded-2xl max-w-sm shadow-sm dark:shadow-none'>
					{isReadOnly && (
						<button
							onClick={handleFollowToggle}
							className={`px-6 py-2 rounded-xl text-xs font-bold transition duration-200 shadow-md ${isFollowing
								? "bg-slate-100 hover:bg-slate-200 dark:bg-dark-fill-3 dark:hover:bg-dark-fill-2 text-slate-700 dark:text-gray-300 border border-slate-200 dark:border-slate-800/60"
								: "bg-brand-orange hover:bg-brand-orange-s text-white"
								}`}
						>
							{isFollowing ? "Following" : "Follow"}
						</button>
					)}
					<div className='flex gap-4 text-xs font-semibold text-slate-500 dark:text-gray-400'>
						<div>
							<span className='text-slate-800 dark:text-gray-250 font-bold font-mono mr-1'>{followerCount}</span>
							<span>Followers</span>
						</div>
						<div>
							<span className='text-slate-800 dark:text-gray-250 font-bold font-mono mr-1'>{followingCount}</span>
							<span>Following</span>
						</div>
					</div>
				</div>

				<div className='grid grid-cols-1 lg:grid-cols-12 gap-8'>
					{/* Left Column */}
					<div className='col-span-1 lg:col-span-5 space-y-6'>
						{/* BeastCode Student Card */}
						<div className='relative overflow-hidden bg-gradient-to-br from-white via-white to-brand-orange/10 dark:from-dark-layer-1 dark:via-dark-layer-1 dark:to-brand-orange/20 border border-slate-200/80 dark:border-slate-800/60 rounded-2xl p-6 shadow-md dark:shadow-2xl hover:border-brand-orange/30 transition duration-300'>
							<div className='flex justify-between items-start mb-6'>
								<div>
									<h2 className='text-xs font-bold tracking-widest text-brand-orange uppercase'>User ID Card</h2>
									<p className='text-[10px] text-slate-500 dark:text-gray-500'>Online Judge Portal</p>
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
											<div className='w-16 h-16 rounded-full border-2 border-brand-orange/30 bg-slate-100 dark:bg-dark-layer-2 flex items-center justify-center shadow-inner'>
												<FaUser size={28} className='text-slate-400 dark:text-gray-400' />
											</div>
										)}
									</div>
									<div>
										<h3 className='text-xl font-bold text-slate-900 dark:text-gray-100 truncate max-w-[200px]'>
											{profile.displayName || "Unset Display Name"}
										</h3>
										<p className='text-xs text-slate-500 dark:text-gray-400 truncate max-w-[200px]'>{isReadOnly && profile.showStudentInfo === false ? "••••••••@•••••.••" : isReadOnly ? profile.email : user?.email}</p>
									</div>
								</div>

								{isReadOnly && profile.showStudentInfo === false ? (
									<div className='border-t border-slate-200 dark:border-slate-800/60 pt-4 text-center text-xs text-slate-500 dark:text-gray-500 italic py-2'>
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
										<div className='border-t border-slate-200 dark:border-slate-800/60 pt-4 grid grid-cols-2 gap-y-3 gap-x-2 text-xs'>
											<div className='flex items-center gap-2 text-slate-600 dark:text-gray-400'>
												<FaSchool className='text-brand-orange shrink-0' />
												<span className='truncate' title={profile.school}>{profile.school || "BeastCode"}</span>
											</div>
											<div className='flex items-center gap-2 text-slate-600 dark:text-gray-400'>
												<FaIdCard className='text-brand-orange shrink-0' />
												<span className='truncate'>{profile.studentId || "Student ID Unset"}</span>
											</div>
											<div className='flex items-center gap-2 text-slate-600 dark:text-gray-400'>
												<FaBookOpen className='text-brand-orange shrink-0' />
												<span className='truncate' title={profile.faculty}>{profile.faculty || "Faculty Unset"}</span>
											</div>
											<div className='flex items-center gap-2 text-slate-600 dark:text-gray-400'>
												<FaGraduationCap className='text-brand-orange shrink-0' />
												<span className='truncate'>{profile.class || "Class Unset"}</span>
											</div>
										</div>
									</>
								)}

								{profile.bio && (
									<div className='mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/40'>
										<p className='text-xs text-slate-500 dark:text-gray-400 italic line-clamp-3'>&ldquo;{profile.bio}&rdquo;</p>
									</div>
								)}
							</div>
							<div className='absolute -right-10 -bottom-10 w-40 h-40 bg-brand-orange/5 rounded-full blur-2xl pointer-events-none' />
						</div>

						{/* Solved Stats */}
						<div className='bg-white dark:bg-dark-layer-1 border border-slate-200/80 dark:border-slate-800/60 rounded-2xl p-6 shadow-md dark:shadow-2xl space-y-4'>
							<h3 className='text-lg font-bold text-slate-900 dark:text-gray-200 border-b border-slate-200 dark:border-slate-800/60 pb-3 flex items-center gap-2'>
								<FaCheckCircle className='text-green-500' />
								Solved Statistics
							</h3>
							<div>
								<div className='flex justify-between text-sm mb-1.5'>
									<span className='text-slate-500 dark:text-gray-400 font-medium'>Overall Solved</span>
									<span className='text-slate-900 dark:text-gray-200 font-bold'>{stats.total.solved} / {stats.total.total}</span>
								</div>
								<div className='w-full bg-slate-100 dark:bg-dark-layer-2 h-2.5 rounded-full overflow-hidden'>
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
						<form onSubmit={handleSave} className='bg-white dark:bg-dark-layer-1 border border-slate-200/80 dark:border-slate-800/60 rounded-2xl p-8 shadow-md dark:shadow-2xl space-y-6'>
							<h3 className='text-xl font-bold text-slate-900 dark:text-gray-200 border-b border-slate-200 dark:border-slate-800/60 pb-3'>
								{isReadOnly ? "Profile Details" : "Edit Profile Details"}
							</h3>

							{/* Avatar Upload */}
							{!isReadOnly ? (
								<div className='flex flex-col items-center gap-3 p-4 border border-dashed border-slate-350 dark:border-slate-850 rounded-xl bg-slate-50 dark:bg-dark-layer-2/50'>
									<p className='text-xs text-slate-500 dark:text-gray-400 font-semibold uppercase tracking-wider'>Profile Avatar</p>
									<div className='relative group cursor-pointer' onClick={() => avatarInputRef.current?.click()}>
										{avatarPreview ? (
											<img
												src={avatarPreview}
												alt='Avatar preview'
												className='w-24 h-24 rounded-full object-cover border-2 border-brand-orange/60 shadow-lg'
											/>
										) : (
											<div className='w-24 h-24 rounded-full bg-slate-200 dark:bg-dark-layer-2 border-2 border-slate-300 dark:border-slate-800 flex items-center justify-center'>
												<FaUser size={36} className='text-slate-400 dark:text-gray-500' />
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
									<p className='text-[10px] text-slate-500 dark:text-gray-500'>JPG, PNG or GIF · Max 5MB</p>
									<input
										ref={avatarInputRef}
										type='file'
										accept='image/*'
										className='hidden'
										onChange={handleAvatarChange}
									/>
									{avatarBase64 && (
										<span className='text-[10px] text-green-400 font-medium'>✓ New photo ready — save to apply</span>
									)}
								</div>
							) : (
								<div className='flex flex-col items-center gap-2 p-4 border border-slate-200 dark:border-slate-800/60 rounded-xl bg-slate-50 dark:bg-dark-layer-2/50'>
									{avatarPreview ? (
										<img
											src={avatarPreview}
											alt='Avatar'
											className='w-24 h-24 rounded-full object-cover border-2 border-brand-orange/40 shadow-lg animate-fade-in'
										/>
									) : (
										<div className='w-24 h-24 rounded-full bg-slate-100 dark:bg-dark-layer-2 border border-slate-200 dark:border-slate-800/40 flex items-center justify-center'>
											<FaUser size={36} className='text-slate-400 dark:text-gray-600' />
										</div>
									)}
									<span className='text-xs text-slate-500 dark:text-gray-500 font-medium'>BeastCode Registered Member</span>
								</div>
							)}

							{/* Form Fields */}
							<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
								<div className='col-span-1 md:col-span-2'>
									<label htmlFor='displayName' className='text-sm font-semibold block mb-2 text-slate-700 dark:text-gray-300'>
										Display Name {!isReadOnly && <span className='text-red-500'>*</span>}
									</label>
									<input
										value={profile.displayName}
										onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
										type='text'
										id='displayName'
										disabled={isReadOnly}
										className='border border-slate-200 dark:border-slate-800 outline-none sm:text-sm rounded-lg focus:ring-1 focus:ring-brand-orange focus:border-brand-orange block w-full p-3 bg-slate-50 dark:bg-dark-layer-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 disabled:opacity-60 disabled:cursor-not-allowed'
										placeholder='Nguyen Van A'
										required
									/>
								</div>

								{isReadOnly && profile.showStudentInfo === false ? (
									<div className='col-span-1 md:col-span-2 flex flex-col items-center justify-center py-10 gap-3 text-center'>
										<div className='w-14 h-14 rounded-full bg-slate-100 dark:bg-dark-layer-2 flex items-center justify-center border border-slate-200 dark:border-slate-800/60'>
											<svg xmlns='http://www.w3.org/2000/svg' className='w-7 h-7 text-slate-400 dark:text-gray-500' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
												<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' />
											</svg>
										</div>
										<p className='text-sm font-semibold text-slate-700 dark:text-gray-400'>Profile details are private</p>
										<p className='text-xs text-slate-500 dark:text-gray-600 max-w-xs'>This user has chosen to keep their student information hidden from other users.</p>
									</div>
								) : (
									<>
										<div>
											<label htmlFor='studentId' className='text-sm font-semibold block mb-2 text-slate-700 dark:text-gray-300'>
												Student ID Code
											</label>
											<input
												value={profile.studentId}
												onChange={(e) => setProfile((p) => ({ ...p, studentId: e.target.value }))}
												type='text'
												id='studentId'
												disabled={isReadOnly}
												className='border border-slate-200 dark:border-slate-800 outline-none sm:text-sm rounded-lg focus:ring-1 focus:ring-brand-orange focus:border-brand-orange block w-full p-3 bg-slate-50 dark:bg-dark-layer-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 font-mono disabled:opacity-60 disabled:cursor-not-allowed'
												placeholder='e.g. 22010234'
											/>
										</div>

										<div>
											<label htmlFor='school' className='text-sm font-semibold block mb-2 text-slate-700 dark:text-gray-300'>
												School / University
											</label>
											<input
												value={profile.school}
												onChange={(e) => setProfile((p) => ({ ...p, school: e.target.value }))}
												type='text'
												id='school'
												disabled={isReadOnly}
												className='border border-slate-200 dark:border-slate-800 outline-none sm:text-sm rounded-lg focus:ring-1 focus:ring-brand-orange focus:border-brand-orange block w-full p-3 bg-slate-50 dark:bg-dark-layer-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 disabled:opacity-60 disabled:cursor-not-allowed'
												placeholder='BeastCode University'
											/>
										</div>

										<div>
											<label htmlFor='faculty' className='text-sm font-semibold block mb-2 text-slate-700 dark:text-gray-300'>
												Faculty / Department
											</label>
											<input
												value={profile.faculty}
												onChange={(e) => setProfile((p) => ({ ...p, faculty: e.target.value }))}
												type='text'
												id='faculty'
												disabled={isReadOnly}
												className='border border-slate-200 dark:border-slate-800 outline-none sm:text-sm rounded-lg focus:ring-1 focus:ring-brand-orange focus:border-brand-orange block w-full p-3 bg-slate-50 dark:bg-dark-layer-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 disabled:opacity-60 disabled:cursor-not-allowed'
												placeholder='e.g. Computer Science & Engineering'
											/>
										</div>

										<div>
											<label htmlFor='class' className='text-sm font-semibold block mb-2 text-slate-700 dark:text-gray-300'>
												Class
											</label>
											<input
												value={profile.class}
												onChange={(e) => setProfile((p) => ({ ...p, class: e.target.value }))}
												type='text'
												id='class'
												disabled={isReadOnly}
												className='border border-slate-200 dark:border-slate-800 outline-none sm:text-sm rounded-lg focus:ring-1 focus:ring-brand-orange focus:border-brand-orange block w-full p-3 bg-slate-50 dark:bg-dark-layer-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 disabled:opacity-60 disabled:cursor-not-allowed'
												placeholder='e.g. CSE-2026'
											/>
										</div>

										<div className='col-span-1 md:col-span-2'>
											<label htmlFor='bio' className='text-sm font-semibold block mb-2 text-slate-700 dark:text-gray-300'>
												Short Bio
											</label>
											<textarea
												value={profile.bio}
												onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
												id='bio'
												disabled={isReadOnly}
												rows={4}
												className='border border-slate-200 dark:border-slate-800 outline-none sm:text-sm rounded-lg focus:ring-1 focus:ring-brand-orange block w-full p-3 bg-slate-50 dark:bg-dark-layer-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 disabled:opacity-60 disabled:cursor-not-allowed'
												placeholder='Tell us a bit about yourself...'
											/>
										</div>
									</>
								)}

								{!isReadOnly && (
									<div className='col-span-1 md:col-span-2 flex items-center justify-between p-4 border border-slate-200/80 dark:border-slate-800/60 rounded-xl bg-slate-50/50 dark:bg-dark-layer-2/50 mt-2'>
										<div>
											<label className='text-sm font-semibold block text-slate-800 dark:text-gray-200'>
												Public Student Information
											</label>
											<p className='text-xs text-slate-550 dark:text-gray-500 mt-0.5'>
												Allow other users to see your Student ID, school, class, and faculty.
											</p>
										</div>
										<button
											type='button'
											onClick={() => setProfile((p) => ({ ...p, showStudentInfo: p.showStudentInfo !== false ? false : true }))}
											className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${profile.showStudentInfo !== false ? "bg-brand-orange" : "bg-slate-300 dark:bg-slate-700"
												}`}
										>
											<span
												className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${profile.showStudentInfo !== false ? "translate-x-5" : "translate-x-0"
													}`}
											/>
										</button>
									</div>
								)}
							</div>

							<div className='border-t border-slate-200 dark:border-slate-800/60 pt-6 flex justify-between items-center gap-4'>
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
												className='bg-slate-100 hover:bg-slate-200 dark:bg-dark-layer-2 dark:hover:bg-dark-hover border border-slate-200 dark:border-slate-800/40 text-slate-800 dark:text-white px-6 py-2.5 rounded-lg font-medium transition'
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
					<div className='flex space-x-1 pb-0 mb-6' style={{ borderBottom: "1px solid var(--border-subtle)" }}>
						<button
							onClick={() => {
								router.push(
									{
										pathname: router.pathname,
										query: { ...router.query, tab: "posted" },
									},
									undefined,
									{ shallow: true }
								);
							}}
							className={`py-3 px-4 font-bold text-sm border-b-2 transition duration-200 ${(router.query.tab !== "reposted")
								? "border-brand-orange text-brand-orange"
								: "border-transparent text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-gray-200"
								}`}
						>
							Posted Threads
						</button>
						<button
							onClick={() => {
								router.push(
									{
										pathname: router.pathname,
										query: { ...router.query, tab: "reposted" },
									},
									undefined,
									{ shallow: true }
								);
							}}
							className={`py-3 px-4 font-bold text-sm border-b-2 transition duration-200 ${(router.query.tab === "reposted")
								? "border-brand-orange text-brand-orange"
								: "border-transparent text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-gray-200"
								}`}
						>
							Reposted Threads
						</button>
					</div>

					<div className='pb-12'>
						{router.query.tab === "reposted" ? (
							<ThreadsBoard profileUid={(uid || user?.uid) as string} repostFeedOnly={true} />
						) : (
							<ThreadsBoard profileUid={(uid || user?.uid) as string} postFeedOnly={true} />
						)}
					</div>
				</div>
			</div>
		</main>
	);
};

export default ProfilePage;
